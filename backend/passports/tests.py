import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase

from passports.battery_api import BatteryApiError
from passports.models import Project, UserProjectAccess

VEHICLE = {"id": 1, "registration_number": "KA01AB1234", "model": "X", "battery_pack_a": "EVE12345"}


def post(c, path, body, token=None):
    h = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
    return c.post(path, json.dumps(body), content_type="application/json", **h)


class ApiTests(TestCase):
    def setUp(self):
        cache.clear()
        user = get_user_model().objects.create_user("tech", password="pw12345!")
        self.project = Project.objects.create(name="Ultratech", slug="ultratech", depot="ULTRATECH")
        self.other = Project.objects.create(name="Star Cement", slug="star-cement", depot="STAR_CEMENT")
        UserProjectAccess.objects.create(user=user, project=self.project)
        self.tokens = post(self.client, "/api/auth/login/", {"username": "tech", "password": "pw12345!"}).json()
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {self.tokens['access']}"}

    # -- auth ---------------------------------------------------------------
    def test_login_bad_password_and_lockout(self):
        for _ in range(5):
            self.assertEqual(post(self.client, "/api/auth/login/", {"username": "tech", "password": "no"}).status_code, 401)
        self.assertEqual(post(self.client, "/api/auth/login/", {"username": "tech", "password": "pw12345!"}).status_code, 429)

    def test_requires_token(self):
        self.assertEqual(self.client.get("/api/ultratech/scan/?code=ABC123").status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/", **self.auth).json()["username"], "tech")

    def test_refresh_rotates_and_logout_revokes(self):
        r = post(self.client, "/api/auth/refresh/", {"refresh": self.tokens["refresh"]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(post(self.client, "/api/auth/refresh/", {"refresh": self.tokens["refresh"]}).status_code, 401)
        new = r.json()["refresh"]
        self.assertEqual(post(self.client, "/api/auth/logout/", {"refresh": new}).status_code, 204)
        self.assertEqual(post(self.client, "/api/auth/refresh/", {"refresh": new}).status_code, 401)

    def test_access_token_not_accepted_as_refresh(self):
        self.assertEqual(post(self.client, "/api/auth/refresh/", {"refresh": self.tokens["access"]}).status_code, 401)

    # -- project access -----------------------------------------------------
    def test_projects_list_only_granted(self):
        r = self.client.get("/api/auth/projects/", **self.auth)
        self.assertEqual([p["slug"] for p in r.json()], ["ultratech"])

    @mock.patch("passports.api.client")
    def test_no_access_to_other_project(self, bc):
        self.assertEqual(self.client.get("/api/star-cement/scan/?code=EVE12345", **self.auth).status_code, 403)
        self.assertEqual(self.client.get("/api/star-cement/vehicles/?q=KA", **self.auth).status_code, 403)
        body = {"registration_number": "KA01AB1234", "pack_slot": "a", "serial": "EVE12345"}
        self.assertEqual(post(self.client, "/api/star-cement/mappings/", body, self.tokens["access"]).status_code, 403)
        bc.resolve_serial.assert_not_called()
        bc.assign_serial.assert_not_called()

    def test_access_revoked_takes_effect_immediately(self):
        UserProjectAccess.objects.all().delete()
        self.assertEqual(self.client.get("/api/ultratech/scan/?code=EVE12345", **self.auth).status_code, 403)

    def test_superuser_sees_all_projects(self):
        get_user_model().objects.create_superuser("boss", password="pw12345!")
        t = post(self.client, "/api/auth/login/", {"username": "boss", "password": "pw12345!"}).json()["access"]
        r = self.client.get("/api/auth/projects/", HTTP_AUTHORIZATION=f"Bearer {t}")
        self.assertEqual(len(r.json()), 2)

    # -- scan / map, scoped to the project's depot ---------------------------
    @mock.patch("passports.api.client")
    def test_scan_found_and_not_found(self, bc):
        bc.resolve_serial.return_value = VEHICLE
        r = self.client.get("/api/ultratech/scan/?code=eve12345", **self.auth)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["vehicle"]["model"], "X")
        bc.resolve_serial.assert_called_with("ULTRATECH", "eve12345", "tech")
        bc.resolve_serial.return_value = None
        self.assertEqual(self.client.get("/api/ultratech/scan/?code=NOPE123", **self.auth).status_code, 404)

    @mock.patch("passports.api.client")
    def test_scan_upstream_down(self, bc):
        bc.resolve_serial.side_effect = BatteryApiError(502, "down")
        self.assertEqual(self.client.get("/api/ultratech/scan/?code=EVE12345", **self.auth).status_code, 502)

    @mock.patch("passports.api.client")
    def test_map_sends_depot_and_acting_user(self, bc):
        bc.assign_serial.return_value = VEHICLE
        body = {"registration_number": "KA01AB1234", "pack_slot": "A", "serial": "EVE12345"}
        r = post(self.client, "/api/ultratech/mappings/", body, self.tokens["access"])
        self.assertEqual(r.status_code, 201, r.content)
        bc.assign_serial.assert_called_once_with(
            "ULTRATECH", {"registration_number": "KA01AB1234", "pack_slot": "a", "serial": "EVE12345", "force": False}, "tech")

    @mock.patch("passports.api.client")
    def test_map_conflict_and_unknown_vehicle_pass_through(self, bc):
        body = {"registration_number": "KA01AB1234", "pack_slot": "a", "serial": "EVE12345"}
        bc.assign_serial.side_effect = BatteryApiError(409, "Serial is on KA02", "SERIAL_ON_OTHER_VEHICLE")
        r = post(self.client, "/api/ultratech/mappings/", body, self.tokens["access"])
        self.assertEqual((r.status_code, r.json()["detail"]), (409, "Serial is on KA02"))
        bc.assign_serial.side_effect = BatteryApiError(404, "No such vehicle")
        self.assertEqual(post(self.client, "/api/ultratech/mappings/", body, self.tokens["access"]).status_code, 404)
        bc.assign_serial.side_effect = BatteryApiError(500, "boom")
        self.assertEqual(post(self.client, "/api/ultratech/mappings/", body, self.tokens["access"]).status_code, 502)

    @mock.patch("passports.api.client")
    def test_map_validates_input_before_calling_api(self, bc):
        for body in ({"registration_number": "K", "pack_slot": "z", "serial": "EVE12345"},
                     {"registration_number": "K", "pack_slot": "a", "serial": "a b"},
                     {"registration_number": " ", "pack_slot": "a", "serial": "EVE12345"}):
            self.assertEqual(post(self.client, "/api/ultratech/mappings/", body, self.tokens["access"]).status_code, 400)
        bc.assign_serial.assert_not_called()


class BatteryClientTests(TestCase):
    """The upstream client against a fake battery-passport service (no network)."""

    ROWS = {
        "MH40DC2629": {"registration_number": "MH40DC2629", "depot": "NAGPUR", "battery_pack_a": "A00801",
                       "battery_pack_b": "           A00807", "battery_pack_c": None},
        "MH40DC2622": {"registration_number": "MH40DC2622", "depot": "NAGPUR", "battery_pack_a": None,
                       "battery_pack_b": None, "battery_pack_c": None},
        "MH12AB1234": {"registration_number": "MH12AB1234", "depot": "UMT", "battery_pack_a": "U1", "battery_pack_b": None,
                       "battery_pack_c": None},
    }

    def setUp(self):
        from django.test import override_settings
        cache.clear()
        self.calls = []
        o = override_settings(BATTERY_API_BASE_URL="http://up/api/v1", BATTERY_API_KEY="k")
        o.enable()
        self.addCleanup(o.disable)
        p = mock.patch("passports.battery_api.requests.request", side_effect=self.fake)
        p.start()
        self.addCleanup(p.stop)
        from passports.battery_api import BatteryApiClient
        self.c = BatteryApiClient()

    def fake(self, method, url, headers=None, params=None, json=None, timeout=None):
        self.calls.append((method, url, headers, params, json))
        resp = mock.Mock()
        resp.status_code, resp.json.return_value = 200, {}
        if method == "PATCH":
            self.ROWS_ = getattr(self, "ROWS_", {k: dict(v) for k, v in self.ROWS.items()})
            self.ROWS_[url.rsplit("/", 1)[1]].update(json)
            return resp
        rows = getattr(self, "ROWS_", self.ROWS)
        reg = (params or {}).get("registration_number")
        data = [dict(v) for v in rows.values()
                if (not params.get("depot") or v["depot"] == params["depot"]) and (not reg or v["registration_number"] == reg.upper())]
        resp.json.return_value = {"data": data, "count": len(data), "total": len(data)}
        return resp

    def test_sends_api_key_header(self):
        self.c.resolve_serial("NAGPUR", "A00801")
        self.assertEqual(self.calls[0][2]["x-api-key"], "k")

    def test_resolve_matches_padded_pack_case_insensitively_and_scopes_to_depot(self):
        self.assertEqual(self.c.resolve_serial("NAGPUR", "a00807")["registration_number"], "MH40DC2629")
        self.assertIsNone(self.c.resolve_serial("NAGPUR", "U1"))

    def test_assign_to_free_slot_patches_only_that_pack(self):
        self.c.assign_serial("NAGPUR", {"registration_number": "mh40dc2622", "pack_slot": "a", "serial": "NEW123"})
        patches = [x for x in self.calls if x[0] == "PATCH"]
        self.assertEqual([(p[1], p[4]) for p in patches], [("http://up/api/v1/battery-passport/MH40DC2622", {"battery_pack_a": "NEW123"})])

    def test_assign_conflicts_need_force(self):
        with self.assertRaises(BatteryApiError) as e:
            self.c.assign_serial("NAGPUR", {"registration_number": "MH40DC2622", "pack_slot": "a", "serial": "A00801"})
        self.assertEqual((e.exception.status, e.exception.code), (409, "SERIAL_ON_OTHER_VEHICLE"))
        with self.assertRaises(BatteryApiError) as e:
            self.c.assign_serial("NAGPUR", {"registration_number": "MH40DC2629", "pack_slot": "a", "serial": "NEW123"})
        self.assertEqual(e.exception.code, "SLOT_TAKEN")
        self.assertFalse([x for x in self.calls if x[0] == "PATCH"])

    def test_force_releases_old_holder_then_assigns(self):
        self.c.assign_serial("NAGPUR", {"registration_number": "MH40DC2622", "pack_slot": "a", "serial": "A00801", "force": True})
        self.assertEqual([(p[1][-10:], p[4]) for p in self.calls if p[0] == "PATCH"],
                         [("MH40DC2629", {"battery_pack_a": None}), ("MH40DC2622", {"battery_pack_a": "A00801"})])

    def test_force_cannot_take_serial_from_another_depot(self):
        with self.assertRaises(BatteryApiError) as e:
            self.c.assign_serial("NAGPUR", {"registration_number": "MH40DC2622", "pack_slot": "a", "serial": "U1", "force": True})
        self.assertEqual(e.exception.status, 409)

    def test_assign_to_vehicle_outside_depot_is_404(self):
        with self.assertRaises(BatteryApiError) as e:
            self.c.assign_serial("NAGPUR", {"registration_number": "MH12AB1234", "pack_slot": "b", "serial": "X123"})
        self.assertEqual(e.exception.status, 404)

    def test_unconfigured_is_502(self):
        from django.test import override_settings
        with override_settings(BATTERY_API_KEY=""), self.assertRaises(BatteryApiError) as e:
            self.c.search_vehicles("NAGPUR", "MH")
        self.assertEqual(e.exception.status, 502)
