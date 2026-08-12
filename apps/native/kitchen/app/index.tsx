import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { OrderStatus } from "@repo/types";

interface KitchenTicket {
  id: string;
  tableNumber: string;
  orderTime: string;
  status: OrderStatus;
  elapsedMinutes: number;
  serverName: string;
  items: {
    name: string;
    quantity: number;
    notes?: string;
    completed?: boolean;
  }[];
}

const initialTickets: KitchenTicket[] = [
  {
    id: "KDS-101",
    tableNumber: "Table 4",
    orderTime: "18:42",
    elapsedMinutes: 6,
    serverName: "Alex M.",
    status: OrderStatus.PREPARING,
    items: [
      { name: "Truffle Ribeye Steak", quantity: 1, notes: "Medium Rare, extra peppercorn sauce" },
      { name: "Parmesan Truffle Fries", quantity: 1 },
      { name: "Charred Broccolini", quantity: 1, notes: "No garlic" },
    ],
  },
  {
    id: "KDS-102",
    tableNumber: "Table 12",
    orderTime: "18:45",
    elapsedMinutes: 3,
    serverName: "Sarah K.",
    status: OrderStatus.PENDING,
    items: [
      { name: "Artisanal Margherita Pizza", quantity: 2, notes: "Well done crust" },
      { name: "Crispy Calamari Fritti", quantity: 1 },
    ],
  },
  {
    id: "KDS-103",
    tableNumber: "Table 2",
    orderTime: "18:28",
    elapsedMinutes: 20,
    serverName: "David L.",
    status: OrderStatus.READY,
    items: [
      { name: "Pan-Seared Chilean Sea Bass", quantity: 1 },
      { name: "Burrata & Heirloom Salad", quantity: 1 },
    ],
  },
];

export default function KitchenKDSScreen() {
  const [tickets, setTickets] = useState<KitchenTicket[]>(initialTickets);

  const toggleItemDone = (ticketId: string, itemIdx: number) => {
    setTickets((prev) =>
      prev.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;
        const newItems = [...ticket.items];
        newItems[itemIdx] = {
          ...newItems[itemIdx],
          completed: !newItems[itemIdx].completed,
        };
        return { ...ticket, items: newItems };
      })
    );
  };

  const updateTicketStatus = (ticketId: string, nextStatus: OrderStatus) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: nextStatus } : ticket
      )
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-blue-600">
            Scan My Order - Kitchen KDS
          </Text>
          <Text className="text-xs text-slate-400 mt-0.5">
            Expo Native Display • Port 8081 • Station 1 (Grill & Pizza)
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="px-3 py-1.5 rounded-lg bg-blue-950/80 border border-blue-800/60">
            <Text className="text-xs font-bold text-blue-300 font-mono">
              PENDING: {tickets.filter((t) => t.status !== OrderStatus.COMPLETED).length}
            </Text>
          </View>
          <View className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60">
            <Text className="text-xs font-bold text-emerald-400 font-mono">
              KITCHEN ONLINE
            </Text>
          </View>
        </View>
      </View>

      {/* Tickets Stream */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        className="flex-1"
      >
        {tickets.map((ticket) => {
          const isLate = ticket.elapsedMinutes > 15;
          return (
            <View
              key={ticket.id}
              className={`w-80 rounded-2xl bg-slate-900 border p-4 justify-between ${
                isLate
                  ? "border-red-500/80 shadow-lg shadow-red-500/20"
                  : ticket.status === OrderStatus.READY
                  ? "border-emerald-500/60"
                  : "border-slate-800"
              }`}
            >
              <View>
                <View className="flex-row items-center justify-between pb-3 border-b border-slate-800">
                  <View>
                    <Text className="text-xl font-extrabold text-white">
                      {ticket.tableNumber}
                    </Text>
                    <Text className="text-xs text-slate-400 font-mono">
                      #{ticket.id} • Server: {ticket.serverName}
                    </Text>
                  </View>
                  <View
                    className={`px-2.5 py-1 rounded-md ${
                      isLate
                        ? "bg-red-500/20 border border-red-500"
                        : "bg-slate-800 border border-slate-700"
                    }`}
                  >
                    <Text
                      className={`text-xs font-mono font-bold ${
                        isLate ? "text-red-400" : "text-slate-300"
                      }`}
                    >
                      {ticket.elapsedMinutes}m ago
                    </Text>
                  </View>
                </View>

                <View className="py-3 gap-3">
                  {ticket.items.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => toggleItemDone(ticket.id, idx)}
                      activeOpacity={0.7}
                      className={`p-2.5 rounded-xl border flex-row items-start justify-between ${
                        item.completed
                          ? "bg-slate-950/60 border-slate-800/60 opacity-50"
                          : "bg-slate-800/60 border-slate-700/60"
                      }`}
                    >
                      <View className="flex-1 pr-2">
                        <Text
                          className={`text-sm font-bold ${
                            item.completed
                              ? "line-through text-slate-500"
                              : "text-slate-100"
                          }`}
                        >
                          <Text className="text-blue-400 font-extrabold">
                            {item.quantity}x{" "}
                          </Text>
                          {item.name}
                        </Text>
                        {item.notes ? (
                          <Text className="text-xs text-amber-400 font-medium mt-1">
                            ⚠️ {item.notes}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        className={`w-5 h-5 rounded-md border items-center justify-center ${
                          item.completed
                            ? "bg-emerald-500 border-emerald-400"
                            : "border-slate-600 bg-slate-900"
                        }`}
                      >
                        {item.completed ? (
                          <Text className="text-white text-xs font-bold">✓</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="pt-3 border-t border-slate-800">
                {ticket.status === OrderStatus.PENDING && (
                  <TouchableOpacity
                    onPress={() =>
                      updateTicketStatus(ticket.id, OrderStatus.PREPARING)
                    }
                    className="w-full py-3 rounded-xl bg-blue-600 items-center justify-center"
                  >
                    <Text className="text-white font-bold text-sm">
                      Start Cooking
                    </Text>
                  </TouchableOpacity>
                )}

                {ticket.status === OrderStatus.PREPARING && (
                  <TouchableOpacity
                    onPress={() =>
                      updateTicketStatus(ticket.id, OrderStatus.READY)
                    }
                    className="w-full py-3 rounded-xl bg-emerald-600 items-center justify-center"
                  >
                    <Text className="text-white font-bold text-sm">
                      Mark Ready for Pickup
                    </Text>
                  </TouchableOpacity>
                )}

                {ticket.status === OrderStatus.READY && (
                  <TouchableOpacity
                    onPress={() =>
                      updateTicketStatus(ticket.id, OrderStatus.COMPLETED)
                    }
                    className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 items-center justify-center"
                  >
                    <Text className="text-slate-300 font-semibold text-sm">
                      Dismiss Ticket
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
