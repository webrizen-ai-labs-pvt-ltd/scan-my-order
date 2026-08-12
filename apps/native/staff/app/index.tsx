import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { UserRole, OrderStatus } from "@repo/types";

interface WaiterAlert {
  id: string;
  table: string;
  type: "pickup" | "bill" | "call";
  message: string;
  time: string;
}

const initialAlerts: WaiterAlert[] = [
  {
    id: "a1",
    table: "Table 2",
    type: "pickup",
    message: "2 items ready in Kitchen Station 1",
    time: "Just now",
  },
  {
    id: "a2",
    table: "Table 4",
    type: "bill",
    message: "Guest requested bill payment ($75.50)",
    time: "2m ago",
  },
  {
    id: "a3",
    table: "Table 12",
    type: "call",
    message: "Water refill & dessert menu requested",
    time: "5m ago",
  },
];

export default function StaffScreen() {
  const [alerts, setAlerts] = useState<WaiterAlert[]>(initialAlerts);
  const [activeTab, setActiveTab] = useState<"tables" | "alerts">("alerts");

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-violet-400">
            Scan My Order - Staff POS
          </Text>
          <Text className="text-xs text-slate-400 mt-0.5">
            Port 8082 • Waiter Handheld • Alex M. ({UserRole.WAITER})
          </Text>
        </View>

        <View className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 items-center justify-center">
          <Text className="text-violet-300 font-bold text-xs">AM</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-5 py-3 flex-row gap-2 bg-slate-950">
        <TouchableOpacity
          onPress={() => setActiveTab("alerts")}
          className={`flex-1 py-2.5 rounded-xl items-center border ${
            activeTab === "alerts"
              ? "bg-violet-600 border-violet-500"
              : "bg-slate-900 border-slate-800"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              activeTab === "alerts" ? "text-white" : "text-slate-400"
            }`}
          >
            Live Alerts ({alerts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("tables")}
          className={`flex-1 py-2.5 rounded-xl items-center border ${
            activeTab === "tables"
              ? "bg-violet-600 border-violet-500"
              : "bg-slate-900 border-slate-800"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              activeTab === "tables" ? "text-white" : "text-slate-400"
            }`}
          >
            My Tables (4 Active)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Alert List */}
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12 }}
        className="flex-1"
      >
        {alerts.length === 0 ? (
          <View className="py-16 items-center justify-center">
            <Text className="text-sm font-semibold text-slate-400">
              No active waiter alerts. All tables satisfied!
            </Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View
              key={alert.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center justify-between"
            >
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-extrabold text-white">
                    {alert.table}
                  </Text>
                  <Text className="text-xs text-slate-500 font-mono">
                    • {alert.time}
                  </Text>
                </View>
                <Text className="text-xs text-slate-300 mt-1 font-medium">
                  {alert.message}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => dismissAlert(alert.id)}
                className="px-3 py-2 rounded-xl bg-violet-600 active:bg-violet-500 items-center justify-center"
              >
                <Text className="text-white text-xs font-bold">Accept</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Quick Action Button */}
        <TouchableOpacity className="mt-4 p-4 rounded-2xl bg-slate-900 border border-violet-500/40 items-center justify-center">
          <Text className="text-violet-300 font-bold text-sm">
            + Open New Table / Take Walk-in Order
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
