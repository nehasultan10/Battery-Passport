import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatFieldLabel, formatFieldValue } from "../passportSections";

export default function FieldRow({ field, value }: { field: string; value: unknown }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{formatFieldLabel(field)}</Text>
      <Text style={styles.value}>{formatFieldValue(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  label: { flex: 1, fontSize: 13, color: "#64748b", marginRight: 12 },
  value: { flex: 1, fontSize: 13, color: "#0f172a", textAlign: "right", fontWeight: "500" },
});
