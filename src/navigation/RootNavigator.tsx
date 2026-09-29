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

  // Deep-link entry (a scanned QR opening the app directly) always routes
  // through Scanner's manual-entry/back path rather than a bespoke deep-link
  // screen — the initial route below only decides where a *cold app open*
  // lands, based on how far through auth/project-selection this device is.
  let initialRoute: keyof RootStackParamList = "Login";
  if (auth.accessToken && auth.project) initialRoute = "Scanner";
  else if (auth.accessToken) initialRoute = "ProjectPicker";

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} options={{ title: "Select Project" }} />
      <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PassportDetail" component={PassportDetailScreen} options={{ title: "Battery Passport" }} />
      <Stack.Screen name="MapBattery" component={MapBatteryScreen} options={{ title: "Map Battery" }} />
      <Stack.Screen name="UsageHistory" component={UsageHistoryScreen} options={{ title: "Usage History" }} />
      <Stack.Screen name="ScanHistory" component={ScanHistoryScreen} options={{ title: "Scan History" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </Stack.Navigator>
  );
}
