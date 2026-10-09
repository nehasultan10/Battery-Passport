// Groups mirror the section comments in battery/models/battery_master.py and
// PRD section 5's field ordering, so the mobile accordion reads the same way
// the EU Battery Regulation data dictionary is organized there — not a flat
// dump of all ~90 columns at once.
export interface PassportSection {
  title: string;
  fields: string[];
}

export const PASSPORT_SECTIONS: PassportSection[] = [
  {
    title: "Identity",
    fields: [
      "registration_number",
      "chassis_no",
      "model",
      "depot",
      "status",
      "battery_category",
      "manufacturer",
      "chemistry",
      "manufacturing_date",
      "manufacturing_batch",
      "manufacturing_place",
      "battery_serial_number",
      "battery_passport_id",
      "battery_identification_code",
      "responsible_economic_operator_id",
      "battery_weight_kg",
    ],
  },
  {
    title: "Battery Packs & Physical Check",
    fields: [
      "battery_pack_a",
      "physical_check_pack_a",
      "battery_pack_b",
      "physical_check_pack_b",
      "battery_pack_c",
      "physical_check_pack_c",
    ],
  },
  {
    title: "Specifications",
    fields: [
      "nominal_voltage_v",
      "nominal_capacity_ah",
      "nominal_energy_kwh",
      "usable_energy_kwh",
    ],
  },
  {
    title: "Compliance & Labels",
    fields: [
      "eu_declaration_of_conformity",
      "eu_declaration_of_conformity_id",
      "test_reports_results",
      "separate_collection_symbol",
      "labels_symbols_meaning",
      "cadmium_lead_symbol",
    ],
  },
  {
    title: "Materials & Hazardous Substances",
    fields: [
      "critical_raw_materials",
      "component_materials_name",
      "component_materials_cas_number",
      "component_materials_composition_percent",
      "hazardous_substances_name",
      "hazardous_substances_hazard_class",
      "hazardous_substances_identifiers",
      "hazardous_substances_location",
      "hazardous_substances_concentration_range",
      "substances_impact_statement",
    ],
  },
  {
    title: "Carbon Footprint",
    fields: [
      "carbon_footprint_kg_per_kwh",
      "carbon_footprint_share_raw_material",
      "carbon_footprint_share_manufacturing",
      "carbon_footprint_share_distribution",
      "carbon_footprint_share_end_of_life",
      "carbon_footprint_performance_class",
      "carbon_footprint_study_link",
    ],
  },
  {
    title: "Supply Chain & Sustainability",
    fields: [
      "due_diligence_report_info",
      "third_party_supply_chain_assurances",
      "eu_taxonomy_disclosure_statement",
      "sustainability_report",
    ],
  },
  {
    title: "Circularity & Resource Efficiency",
    fields: [
      "removal_manual",
      "disassembly_dismantling_manual",
      "spare_parts_supplier_address",
      "spare_parts_supplier_email",
      "spare_parts_supplier_web",
      "component_part_numbers",
      "extinguishing_agent",
      "safety_measures_instructions",
      "recycled_nickel_preconsumer_percent",
      "recycled_cobalt_preconsumer_percent",
      "recycled_lithium_preconsumer_percent",
      "recycled_lead_preconsumer_percent",
      "recycled_nickel_postconsumer_percent",
      "recycled_cobalt_postconsumer_percent",
      "recycled_lithium_postconsumer_percent",
      "recycled_lead_postconsumer_percent",
      "renewable_content_percent",
      "eol_role_waste_prevention",
      "eol_role_separate_collection",
      "eol_collection_takeback_info",
    ],
  },
  {
    title: "Performance & Durability",
    fields: [
      "certified_usable_battery_energy_kwh",
      "initial_self_discharge_rate_percent_per_month",
      "rated_capacity_ah",
      "minimum_voltage_v",
      "maximum_voltage_v",
      "original_power_capability_w",
      "max_permitted_battery_power_w",
      "power_to_energy_ratio_percent",
      "initial_round_trip_efficiency_percent",
      "round_trip_efficiency_at_50pct_cycle_life_percent",
      "initial_internal_resistance_cell_ohm",
      "initial_internal_resistance_pack_ohm",
      "initial_internal_resistance_module_ohm",
      "expected_cycle_life",
      "cycle_life_reference_test",
      "cycle_life_test_c_rate",
      "capacity_threshold_for_exhaustion_percent",
      "soce_threshold_for_exhaustion_percent",
      "warranty_period_years",
      "date_put_into_service",
      "temp_range_idle_lower_c",
      "temp_range_idle_upper_c",
    ],
  },
];

// Fields a depot technician acts on immediately — shown above the accordion,
// unconditionally expanded (PRD flow A, step 3).
export const HEADLINE_FIELDS = [
  "status",
  "depot",
  "physical_check_pack_a",
  "physical_check_pack_b",
  "physical_check_pack_c",
];

// "c" is deliberately NOT mapped to °C here — it collides with pack-slot
// labels ("battery_pack_c" -> ".. C", not ".. °C"). The two temperature
// fields that actually end in "_c" for Celsius get an explicit full-label
// override below instead.
const ACRONYMS: Record<string, string> = {
  eu: "EU",
  cas: "CAS",
  soce: "SOCE",
  id: "ID",
  kwh: "kWh",
  ah: "Ah",
  w: "W",
  v: "V",
};

const LABEL_OVERRIDES: Record<string, string> = {
  temp_range_idle_lower_c: "Idle Temp Range — Lower (°C)",
  temp_range_idle_upper_c: "Idle Temp Range — Upper (°C)",
};

export function formatFieldLabel(field: string): string {
  if (LABEL_OVERRIDES[field]) return LABEL_OVERRIDES[field];
  return field
    .split("_")
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
