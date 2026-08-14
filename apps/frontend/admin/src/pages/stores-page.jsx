import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from "@repo/ui"
import { Store, Plus, MapPin, Clock } from "lucide-react"

export default function StoresPage() {
  const stores = [
    { id: "st_1", name: "La Trattoria Bistro", owner: "Maria Garcia", items: 42, hours: "09:00 AM - 11:00 PM", status: "ACTIVE" },
    { id: "st_2", name: "Tokyo Ramen Bar", owner: "Kenji Sato", items: 28, hours: "11:00 AM - 10:00 PM", status: "ACTIVE" },
    { id: "st_3", name: "Le Petit Cafe", owner: "Sophie Martin", items: 35, hours: "07:30 AM - 07:00 PM", status: "ACTIVE" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Store Directory</h1>
          <p className="text-sm text-slate-400">View and manage registered restaurant stores across all owner accounts.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
          <Plus className="h-4 w-4" /> Add Store
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map((store) => (
          <Card key={store.id} className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Store className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">{store.name}</CardTitle>
                    <CardDescription className="text-slate-400">Owner: {store.owner}</CardDescription>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{store.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>{store.hours}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>{store.items} Menu Items Registered</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
