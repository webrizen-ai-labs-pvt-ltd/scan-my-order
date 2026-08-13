import { useState } from "react";
import {
  Plus,
  Minus,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
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
    description: "Small batch bourbon, smoked rosemary sprig, angostura, flamed orange peel.",
    category: "Drinks",
    isPopular: true,
    imageTag: "🥃",
  },
  {
    id: "m5",
    name: "Valrhona Molten Lava Cake",
    price: 12.0,
    description: "Madagascar bourbon vanilla gelato, salted caramel crisp.",
    category: "Desserts",
    imageTag: "🍫",
  },
];

export function App() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [isOrderPlaced, setIsOrderPlaced] = useState<boolean>(false);

  const categories = ["All", "Starters", "Mains", "Pizza", "Drinks", "Desserts"];

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

  const cartCount = Object.values(cart).reduce((sum, q) => sum + q, 0);
  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = sampleMenu.find((m) => m.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const filteredItems =
    selectedCategory === "All"
      ? sampleMenu
      : sampleMenu.filter((item) => item.category === selectedCategory);

  if (isOrderPlaced) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">Order Sent to Kitchen!</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          Your order has been sent directly to the kitchen display tablet (Table 04).
        </p>
        <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 w-full max-w-sm text-left">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Estimated Prep Time:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> ~12 mins
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-white pt-2 border-t border-slate-800">
            <span>Total Billed:</span>
            <span className="font-mono">${cartTotal.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={() => {
            setCart({});
            setIsOrderPlaced(false);
          }}
          className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
        >
          Add More Items
        </button>
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
              src="/logo.png"
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
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono">
            Port 3002
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Menu Catalog */}
      <main className="p-4 max-w-2xl mx-auto space-y-3">
        {filteredItems.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex gap-4 items-center justify-between"
            >
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{item.name}</h2>
                  {item.isPopular && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Sparkles className="w-2.5 h-2.5" /> Popular
                    </span>
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
                  <button
                    onClick={() => addToCart(item.id)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-xs font-bold text-slate-200 hover:text-white border border-slate-700 transition-all"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-30">
          <button
            onClick={() => setIsOrderPlaced(true)}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-600/40 flex items-center justify-between font-bold"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs">
                {cartCount}
              </span>
              <span className="text-sm">Place Order for Table 04</span>
            </div>
            <div className="flex items-center gap-1 text-sm font-mono">
              <span>${cartTotal.toFixed(2)}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
