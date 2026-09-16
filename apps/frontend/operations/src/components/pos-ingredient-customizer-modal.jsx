import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { 
  Button, 
  Input 
} from '@smo/ui';
import { 
  Cancel01Icon, 
  PlusSignIcon, 
  Delete02Icon, 
  Search01Icon, 
  Pot02Icon,
  CheckmarkBadge01Icon
} from 'hugeicons-react';

export const PosIngredientCustomizerModal = ({ isOpen, onClose, storeId, item, onSave }) => {
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [searchMaterial, setSearchMaterial] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [kitchenNotes, setKitchenNotes] = useState('');

  useEffect(() => {
    if (isOpen && storeId && item) {
      fetchMaterials();
      setSelectedIngredients(item.customIngredients || []);
      setKitchenNotes(item.kitchenNotes || '');
      setSearchMaterial('');
    }
  }, [isOpen, storeId, item]);

  const fetchMaterials = async () => {
    setLoadingMaterials(true);
    try {
      const res = await api.get(`/stores/${storeId}/inventory/materials`);
      if (res.data.success) {
        setMaterials(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load raw materials:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  if (!isOpen || !item) return null;

  const handleAddIngredient = (mat) => {
    if (selectedIngredients.some(i => i.rawMaterialId === mat.id)) return;
    setSelectedIngredients(prev => [
      ...prev,
      {
        rawMaterialId: mat.id,
        name: mat.name,
        unit: mat.unit,
        quantity: mat.unit === 'GRAM' ? 50 : mat.unit === 'MILLILITER' ? 50 : 1,
        price: 0
      }
    ]);
  };

  const handleUpdateIngredient = (rawMaterialId, field, val) => {
    setSelectedIngredients(prev => prev.map(ing => {
      if (ing.rawMaterialId === rawMaterialId) {
        return { ...ing, [field]: val };
      }
      return ing;
    }));
  };

  const handleRemoveIngredient = (rawMaterialId) => {
    setSelectedIngredients(prev => prev.filter(i => i.rawMaterialId !== rawMaterialId));
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchMaterial.toLowerCase()) &&
    !selectedIngredients.some(sel => sel.rawMaterialId === m.id)
  );

  const extraPriceTotal = selectedIngredients.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  const basePrice = item.menuItem?.price || item.priceAtOrder || 0;
  const newUnitPrice = basePrice + extraPriceTotal;

  const handleSave = () => {
    onSave({
      ...item,
      customIngredients: selectedIngredients.map(ing => ({
        rawMaterialId: ing.rawMaterialId,
        name: ing.name,
        unit: ing.unit,
        quantity: Number(ing.quantity) || 1,
        price: Number(ing.price) || 0
      })),
      kitchenNotes: kitchenNotes.trim()
    });
    onClose();
  };

  if (!isOpen || !item) return null;

  const itemName = item.customName || item.menuItem?.name || item.name || 'Dish';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40">
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Customize Ingredients for</span>
              <span className="text-amber-600 dark:text-amber-400 font-extrabold">{itemName}</span>
            </h2>
            <p className="text-[11px] text-stone-500">
              Add extra inventory ingredients and custom kitchen notes to this dish.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 hover:bg-stone-200/50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Cancel01Icon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Price Summary */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-100/70 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-700/60 text-xs">
            <div>
              <span className="text-stone-500">Base Price: </span>
              <span className="font-bold text-stone-800 dark:text-zinc-200">₹{basePrice}</span>
              {extraPriceTotal > 0 && (
                <span className="text-amber-600 ml-1">(+₹{extraPriceTotal} extra)</span>
              )}
            </div>
            <div className="text-sm font-extrabold text-stone-900 dark:text-zinc-100">
              New Unit Price: ₹{newUnitPrice}
            </div>
          </div>

          {/* Added Ingredients */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Pot02Icon size={14} className="text-amber-600" />
                Extra Ingredients
              </span>
              <span className="text-[10px] text-stone-400 font-normal">
                {selectedIngredients.length} added
              </span>
            </label>

            {selectedIngredients.length > 0 ? (
              <div className="space-y-2 p-2.5 rounded-xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200/70 dark:border-zinc-800">
                {selectedIngredients.map(ing => (
                  <div key={ing.rawMaterialId} className="flex items-center gap-2 text-xs bg-white dark:bg-zinc-900 p-2 rounded-lg border border-stone-200/60 dark:border-zinc-800">
                    <span className="font-semibold text-stone-800 dark:text-zinc-200 flex-1 truncate">
                      {ing.name}
                    </span>

                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={ing.quantity}
                        onChange={e => handleUpdateIngredient(ing.rawMaterialId, 'quantity', e.target.value)}
                        className="w-16 h-7 text-xs text-center rounded-lg"
                      />
                      <span className="text-[10px] font-bold text-stone-500">{ing.unit}</span>
                    </div>

                    <div className="flex items-center gap-1 pl-1.5 border-l border-stone-100 dark:border-zinc-800">
                      <span className="text-[10px] text-stone-400">+₹</span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={ing.price}
                        onChange={e => handleUpdateIngredient(ing.rawMaterialId, 'price', e.target.value)}
                        className="w-14 h-7 text-xs text-center rounded-lg"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(ing.rawMaterialId)}
                      className="size-6 text-stone-400 hover:text-rose-600 rounded flex items-center justify-center transition-colors"
                    >
                      <Delete02Icon size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-stone-400 italic rounded-xl border border-dashed border-stone-200 dark:border-zinc-800">
                No extra ingredients added yet. Pick from below.
              </div>
            )}

            {/* Search and Suggestions */}
            <div className="relative pt-1">
              <Search01Icon size={13} className="absolute left-3 top-3.5 text-stone-400" />
              <Input
                value={searchMaterial}
                onChange={e => setSearchMaterial(e.target.value)}
                placeholder="Search ingredients to add..."
                className="h-8 pl-8 text-xs rounded-xl bg-stone-50/50 dark:bg-zinc-800/60"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
              {filteredMaterials.slice(0, 12).map(mat => (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => handleAddIngredient(mat)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-stone-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-stone-700 dark:text-zinc-300 border border-stone-200/80 dark:border-zinc-700 transition-colors"
                >
                  <PlusSignIcon size={11} />
                  <span>{mat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Kitchen Notes */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300">
              Kitchen Preparation Notes
            </label>
            <Input
              value={kitchenNotes}
              onChange={e => setKitchenNotes(e.target.value)}
              placeholder="e.g. Extra spicy, no onions, well done"
              className="h-9 text-xs rounded-xl bg-stone-50/50 dark:bg-zinc-800/60"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-9 px-5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
          >
            <CheckmarkBadge01Icon size={15} />
            <span>Apply Customizations</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
