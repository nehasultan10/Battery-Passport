export type RootStackParamList = {
  Login: undefined;
  ProjectPicker: undefined;
  Scanner: undefined;
  PassportDetail: { code: string };
  MapBattery: { code: string };
  UsageHistory: { batteryId: number; registrationNumber: string };
  ScanHistory: undefined;
  Settings: undefined;
};
