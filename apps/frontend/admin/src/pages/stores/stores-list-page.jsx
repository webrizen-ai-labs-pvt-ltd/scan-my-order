import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui"
import { Store, Plus, AlertCircle, LoaderCircle, UtensilsCrossed } from "lucide-react"
import { useAuth } from "../../context/auth-context.jsx"
import { fetchStoresApi } from "../../services/admin-api.js"

export default function StoresListPage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadStores() {
      if (!token) return
      setLoading(true)
      try {
        const res = await fetchStoresApi(token)
        if (res?.data) {
          setStores(res.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stores.")
      } finally {
        setLoading(false)
      }
    }
    loadStores()
  }, [token])

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Onboarded Stores & Restaurants</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage multi-platform dining establishments, assigned store owners, and active menu items.
          </p>
        </div>
        <Link to="/dashboard/stores/onboard">
          <Button className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
            <Plus className="h-4 w-4" /> Onboard New Store
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Store className="h-4 w-4 text-amber-400" /> Active Platform Establishments
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs mt-1">
                Showing all onboarded restaurant locations across the system.
              </CardDescription>
            </div>
            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">{stores.length} Stores</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <p className="text-xs">Loading store catalog...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Store className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 font-medium">No stores onboarded yet.</p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">Click below to onboard your first restaurant establishment.</p>
              <Link to="/dashboard/stores/onboard">
                <Button className="bg-zinc-200 hover:bg-zinc-100 text-zinc-900 font-bold gap-2 text-xs">
                  <Plus className="h-4 w-4" /> Onboard Restaurant Store
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-zinc-800">
                  <TableRow className="border-zinc-800 hover:bg-zinc-950">
                    <TableHead className="text-zinc-400">Establishment Name</TableHead>
                    <TableHead className="text-zinc-400">URL Slug</TableHead>
                    <TableHead className="text-zinc-400">Assigned Owner</TableHead>
                    <TableHead className="text-zinc-400">Menu Items</TableHead>
                    <TableHead className="text-zinc-400">Created Date</TableHead>
                    <TableHead className="text-right text-zinc-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((s) => (
                    <TableRow key={s.id} className="border-zinc-800 hover:bg-zinc-950/50">
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-3">
                          {s.brandingLogo ? (
                            <img src={s.brandingLogo} alt={s.name} className="h-8 w-8 rounded-lg object-contain bg-zinc-950 border border-zinc-800 shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                              <Store className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-white">{s.name}</p>
                            <p className="text-xs text-zinc-500 line-clamp-1">{s.description || "No description."}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs font-mono font-normal">
                          {s.slug || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="text-zinc-200 font-medium">{s.owner?.name || "Unassigned"}</p>
                          <p className="text-zinc-500">{s.owner?.email || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1">
                          <UtensilsCrossed className="h-3 w-3" /> {s._count?.menuItems ?? s.menuItems?.length ?? 0} items
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">
                        {s.createdAt ? new Date(s.createdAt).toISOString().split("T")[0] : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/dashboard/stores/${s.id}/manage`)}
                          className="text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          Manage Store
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
