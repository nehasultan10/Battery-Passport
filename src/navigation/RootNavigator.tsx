import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import MapBatteryScreen from "../screens/MapBatteryScreen";
import CreateRecordScreen from "../screens/CreateRecordScreen";
import PassportDetailScreen from "../screens/PassportDetailScreen";
import PassportsScreen from "../screens/PassportsScreen";
import ProjectPickerScreen from "../screens/ProjectPickerScreen";
import ScannerScreen from "../screens/ScannerScreen";
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
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : !hasProject ? (
        <>
          <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} options={{ title: "Select Project" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Passports" component={PassportsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreateRecord" component={CreateRecordScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="PassportDetail" component={PassportDetailScreen} options={{ title: "Battery Passport" }} />
          <Stack.Screen name="MapBattery" component={MapBatteryScreen} options={{ title: "Map Battery" }} />
          <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} options={{ title: "Select Project" }} />
        </>
      )}
    </Stack.Navigator>
  );
}
