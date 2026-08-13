import { useState } from "react";
import {
  Button,
  Card,
  Badge,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Separator,
} from "@repo/ui";
import {
  Plus,
  Minus,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  isPopular?: boolean;
  imageTag: string;
}

const sampleMenu: MenuItem[] = [
  {
    id: "m1",
    name: "Prime Dry-Aged Ribeye (12oz)",
    price: 38.0,
    description: "Charred scallion butter, red wine shallot jus, roasted garlic bulb.",
    category: "Mains",
    isPopular: true,
    imageTag: "🥩",
  },
  {
    id: "m2",
    name: "Artisanal Truffle Margherita",
    price: 19.5,
    description: "Fior di latte, San Marzano D.O.P., black truffle carpaccio, fresh basil.",
    category: "Pizza",
    isPopular: true,
    imageTag: "🍕",
  },
  {
    id: "m3",
    name: "Crispy Calamari & Rock Shrimp",
    price: 15.0,
    description: "Lemon pepper dusted, charred lemon, smoked chili aioli.",
    category: "Starters",
    imageTag: "🍤",
  },
  {
    id: "m4",
    name: "Smoked Rosemary Old Fashioned",
    price: 14.0,
    description: "Bourbon, charred rosemary syrup, angostura bitters, flamed orange peel.",
    category: "Beverages",
    imageTag: "🥃",
  },
  {
    id: "m5",
    name: "Valrhona Triple Chocolate Fondant",
    price: 12.0,
    description: "Molten lava center, Madagascar bourbon vanilla gelato, cocoa nibs.",
    category: "Desserts",
    imageTag: "🍫",
  },
];

const categories = ["All", "Starters", "Mains", "Pizza", "Desserts", "Beverages"];

export function App() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isOrderPlaced, setIsOrderPlaced] = useState<boolean>(false);
  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);

  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const updated = { ...prev };
      if (updated[id] > 1) {
        updated[id] -= 1;
      } else {
        delete updated[id];
      }
      return updated;
    });
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = sampleMenu.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const filteredItems =
    selectedCategory === "All"
      ? sampleMenu
      : sampleMenu.filter((item) => item.category === selectedCategory);

  if (isOrderPlaced) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Order Sent to Kitchen!</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm">
          Your order has been dispatched directly to the Kitchen KDS Display (Port 8081).
        </p>

        <Card className="mt-6 p-4 bg-slate-900/90 border-slate-800 rounded-2xl w-full max-w-xs text-left">
          <div className="flex justify-between items-center text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>Order #SMO-8821</span>
            <Badge variant="success">Table 04</Badge>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Clock className="w-3.5 h-3.5" /> Prep time: ~15-20 mins
            </div>
            <p className="text-slate-400">Total Paid: ${cartTotal.toFixed(2)}</p>
          </div>
        </Card>

        <Button
          onClick={() => {
            setCart({});
            setIsOrderPlaced(false);
          }}
          className="mt-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
        >
          Browse Menu Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28">
      {/* Restaurant Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 px-5 py-4 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-white.png"
              alt="The Grand Woodside"
              className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-amber-500/20"
            />
            <div>
              <h1 className="font-bold text-base text-white leading-tight">
                The Grand Woodside
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                QR Menu • <span className="text-emerald-400 font-semibold">Table 04</span>
              </p>
            </div>
          </div>
          <Badge variant="info">Port 3002</Badge>
        </div>
      </header>

      {/* Category Horizontal Filter */}
      <div className="px-4 py-3 sticky top-[69px] z-10 bg-slate-950/90 backdrop-blur flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-800/60">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Catalog List */}
      <main className="p-4 max-w-2xl mx-auto space-y-3">
        {filteredItems.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <Card
              key={item.id}
              className="p-4 bg-slate-900/80 border-slate-800/90 flex gap-4 items-center justify-between shadow-sm"
            >
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{item.name}</h2>
                  {item.isPopular && (
                    <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                      <Sparkles className="w-2.5 h-2.5 mr-1" /> Popular
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
                <p className="text-sm font-bold text-emerald-400 font-mono mt-2">
                  ${item.price.toFixed(2)}
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                  {item.imageTag}
                </div>

                {qty > 0 ? (
                  <div className="flex items-center gap-1 bg-blue-600 rounded-lg px-1.5 py-1">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-0.5 text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-white px-1 font-mono">
                      {qty}
                    </span>
                    <button
                      onClick={() => addToCart(item.id)}
                      className="p-0.5 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addToCart(item.id)}
                    className="h-7 text-xs border-slate-700 hover:bg-blue-600 hover:text-white"
                  >
                    Add
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </main>

      {/* Floating Bottom Cart Bar using shadcn Sheet Drawer */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-30">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <button className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-600/40 flex items-center justify-between font-bold active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-mono font-bold">
                    {cartCount}
                  </span>
                  <span className="text-sm">View Order • Table 04</span>
                </div>
                <div className="flex items-center gap-1 text-sm font-mono">
                  <span>${cartTotal.toFixed(2)}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </SheetTrigger>

            <SheetContent side="bottom" className="bg-slate-900 border-slate-800 text-white max-w-2xl mx-auto">
              <SheetHeader>
                <div className="flex items-center justify-between pr-6">
                  <SheetTitle className="text-white text-lg font-bold flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-blue-400" /> Order Summary
                  </SheetTitle>
                  <Badge variant="success">Table 04</Badge>
                </div>
                <SheetDescription className="text-slate-400">
                  Review your dishes before sending directly to the kitchen.
                </SheetDescription>
              </SheetHeader>

              <div className="my-4 space-y-3 max-h-60 overflow-y-auto pr-1">
                {Object.entries(cart).map(([id, qty]) => {
                  const item = sampleMenu.find((m) => m.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{item.imageTag}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="text-xs text-slate-400 font-mono">
                            ${item.price.toFixed(2)} each
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-1.5 py-0.5 border border-slate-700">
                          <button onClick={() => removeFromCart(id)} className="p-0.5 text-slate-300 hover:text-white">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono font-bold px-1">{qty}</span>
                          <button onClick={() => addToCart(id)} className="p-0.5 text-slate-300 hover:text-white">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-mono font-bold text-emerald-400 w-16 text-right">
                          ${(item.price * qty).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="bg-slate-800 my-3" />

              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax (8%)</span>
                  <span className="font-mono text-slate-200">${(cartTotal * 0.08).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-1">
                  <span>Total Amount</span>
                  <span className="font-mono text-emerald-400">${(cartTotal * 1.08).toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={() => {
                  setIsSheetOpen(false);
                  setIsOrderPlaced(true);
                }}
                className="w-full mt-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold h-12 rounded-xl text-base shadow-lg shadow-blue-500/25"
              >
                Send Order to Kitchen <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}

export default App;
