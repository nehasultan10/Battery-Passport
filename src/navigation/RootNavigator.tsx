import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import MapBatteryScreen from "../screens/MapBatteryScreen";
import PassportDetailScreen from "../screens/PassportDetailScreen";
import ProjectPickerScreen from "../screens/ProjectPickerScreen";
import ScanHistoryScreen from "../screens/ScanHistoryScreen";
import ScannerScreen from "../screens/ScannerScreen";
import SettingsScreen from "../screens/SettingsScreen";
import UsageHistoryScreen from "../screens/UsageHistoryScreen";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Which screens exist is driven by auth state, so signing out (or an expired
  // session) lands on Login automatically and a project-less session can only
  // reach the picker - no manual navigation.reset() needed for those cases.
  const signedIn = !!auth.accessToken;
  const hasProject = signedIn && !!auth.project;

  // Keyed by group so crossing a boundary (logout, session expiry, project
  // chosen) remounts the stack at that group's first screen instead of
  // leaving a stale stack behind (e.g. Settings with no Login under it).
  const groupKey = !signedIn ? "signed-out" : !hasProject ? "no-project" : "ready";

  return (
    <Stack.Navigator key={groupKey}>
      {!signedIn ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        </>
      ) : !hasProject ? (
        <>
          <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} options={{ title: "Select Project" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PassportDetail" component={PassportDetailScreen} options={{ title: "Battery Passport" }} />
          <Stack.Screen name="MapBattery" component={MapBatteryScreen} options={{ title: "Map Battery" }} />
          <Stack.Screen name="UsageHistory" component={UsageHistoryScreen} options={{ title: "Usage History" }} />
          <Stack.Screen name="ScanHistory" component={ScanHistoryScreen} options={{ title: "Scan History" }} />
          <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} options={{ title: "Select Project" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
