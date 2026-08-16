import React from "react"
import { Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
} from "@repo/ui"
import {
  Clock,
  CheckCircle2,
  ArrowLeft,
  ChefHat,
  Flame,
} from "lucide-react"

export default function DashboardPage() {
  const sampleTickets = [
    {
      id: "TICK-901",
      table: "Table #04",
      type: "Dine-In",
      items: [
        { name: "Margherita Pizza", qty: 2, note: "Extra Mozzarella" },
        { name: "Cold Brew Coffee", qty: 2, note: "Less Ice" },
      ],
      time: "4 mins ago",
      status: "PREPARING",
    },
    {
      id: "TICK-902",
      table: "Table #09",
      type: "Takeaway",
      items: [
        { name: "Truffle Mushroom Burger", qty: 1, note: "No Onions" },
        { name: "Crispy French Fries", qty: 1, note: "Extra Spicy" },
      ],
      time: "8 mins ago",
      status: "READY",
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 p-2 h-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-amber-400" /> Kitchen Display System (KDS) & POS
              </h1>
              <p className="text-xs text-zinc-400">Live order ticket stream and table dining workflow control.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" /> KDS Live Stream
            </Badge>
            <Link to="/subscriptions">
              <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs">
                Subscription Status
              </Button>
            </Link>
          </div>
        </div>

        {/* Live KDS Tickets */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" /> Active Order Tickets
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sampleTickets.map((ticket) => (
              <Card key={ticket.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 flex flex-col justify-between">
                <CardHeader className="border-b border-zinc-800 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-bold text-white">{ticket.table}</span>
                        <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">
                          {ticket.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono">Ref: {ticket.id}</p>
                    </div>

                    <div className="text-right">
                      <Badge
                        className={`text-xs ${
                          ticket.status === "READY"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {ticket.status}
                      </Badge>
                      <span className="text-[11px] text-zinc-500 block mt-1 flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" /> {ticket.time}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-4 space-y-3">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-xs border-b border-zinc-800/50 pb-2">
                      <div>
                        <span className="font-semibold text-white">{item.qty}x {item.name}</span>
                        {item.note && (
                          <p className="text-[11px] text-amber-400 mt-0.5 font-mono">Note: {item.note}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end gap-2 pt-2">
                    {ticket.status === "PREPARING" ? (
                      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs">
                        Completed & Served
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-zinc-600 mt-12">
        © {new Date().getFullYear()} Scan My Order KDS Operations
      </footer>
    </div>
  )
}
