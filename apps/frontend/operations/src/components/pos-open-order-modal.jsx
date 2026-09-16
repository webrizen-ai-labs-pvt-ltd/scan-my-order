import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@smo/ui';
import {
  Cancel01Icon,
  PlusSignIcon,
  Delete02Icon,
  Search01Icon,
  Dish01Icon,
  Pot02Icon,
  InformationCircleIcon,
} from 'hugeicons-react';

const DIETARY_META = {
  VEG: {
    label: 'Veg',
    hint: 'Green marker',
    dot: 'bg-emerald-500',
  },
  NON_VEG: {
    label: 'Non-Veg',
    hint: 'Red marker',
    dot: 'bg-red-500',
  },
  VEGAN: {
    label: 'Vegan',
    hint: 'Leaf marker',
    dot: 'bg-lime-500',
  },
};

const LABEL_CLASS =
  'mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300';

const CONTROL_CLASS =
  'h-10 rounded-md border-zinc-300 bg-white text-sm focus-visible:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500';

export const PosOpenOrderModal = ({
  isOpen,
  onClose,
  storeId,
  onAddToCart,
  onAddDish,
}) => {
  const [name, setName] = useState('');
  const [dietary, setDietary] = useState('VEG');
  const [basePrice, setBasePrice] = useState('');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Raw Materials (Inventory Ingredients)
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [searchMaterial, setSearchMaterial] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [error, setError] = useState('');

  // Submit lifecycle: 'idle' | 'submitting' | 'success' | 'error'
  const [submitState, setSubmitState] = useState('idle');

  useEffect(() => {
    if (isOpen && storeId) {
      fetchMaterials();
      setName('');
      setDietary('VEG');
      setBasePrice('');
      setKitchenNotes('');
      setQuantity(1);
      setSelectedIngredients([]);
      setError('');
      setSearchMaterial('');
      setSubmitState('idle');
    }
  }, [isOpen, storeId]);

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

  const handleAddIngredient = (mat) => {
    if (selectedIngredients.some((i) => i.rawMaterialId === mat.id)) return;
    setSelectedIngredients((prev) => [
      ...prev,
      {
        rawMaterialId: mat.id,
        name: mat.name,
        unit: mat.unit,
        quantity:
          mat.unit === 'GRAM'
            ? 50
            : mat.unit === 'MILLILITER'
            ? 50
            : 1,
        price: 0,
      },
    ]);
  };

  const handleUpdateIngredient = (rawMaterialId, field, val) => {
    setSelectedIngredients((prev) =>
      prev.map((ing) =>
        ing.rawMaterialId === rawMaterialId
          ? { ...ing, [field]: val }
          : ing
      )
    );
  };

  const handleRemoveIngredient = (rawMaterialId) => {
    setSelectedIngredients((prev) =>
      prev.filter((i) => i.rawMaterialId !== rawMaterialId)
    );
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(searchMaterial.toLowerCase()) &&
      !selectedIngredients.some((sel) => sel.rawMaterialId === m.id)
  );

  const ingredientsExtraTotal = selectedIngredients.reduce(
    (sum, i) => sum + (Number(i.price) || 0),
    0
  );
  const parsedBasePrice = Number(basePrice) || 0;
  const unitPrice = parsedBasePrice + ingredientsExtraTotal;
  const lineTotal = unitPrice * quantity;
  const dietaryMeta = DIETARY_META[dietary] || DIETARY_META.VEG;

  // Lock the form while we're mid-flight or showing success
  const isBusy = submitState === 'submitting' || submitState === 'success';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isBusy) return;

    setError('');

    if (!name.trim()) {
      setError('Please enter a dish name.');
      setSubmitState('error');
      setTimeout(() => setSubmitState('idle'), 1400);
      return;
    }
    if (parsedBasePrice <= 0 && ingredientsExtraTotal <= 0) {
      setError('Please enter a valid price for this custom dish.');
      setSubmitState('error');
      setTimeout(() => setSubmitState('idle'), 1400);
      return;
    }

    const customCartItem = {
      isCustom: true,
      name: name.trim(),
      customName: name.trim(),
      price: unitPrice,
      customPrice: unitPrice,
      dietary,
      notes: kitchenNotes.trim(),
      kitchenNotes: kitchenNotes.trim(),
      customIngredients: selectedIngredients.map((ing) => ({
        rawMaterialId: ing.rawMaterialId,
        name: ing.name,
        unit: ing.unit,
        quantity: Number(ing.quantity) || 1,
        price: Number(ing.price) || 0,
      })),
      menuItem: {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        price: unitPrice,
        dietary,
        image: null,
      },
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      modifiers: [],
    };

    setSubmitState('submitting');

    try {
      const callback = onAddDish || onAddToCart;
      if (!callback) {
        console.warn('PosOpenOrderModal: No onAddDish or onAddToCart handler provided');
        onClose();
        return;
      }
      await callback(customCartItem);

      setSubmitState('success');
      // Brief hold so the cashier sees the confirmation before the modal closes.
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to add custom dish to cart:', err);
      setSubmitState('error');
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not add dish to cart. Please try again.'
      );
      // Let the user retry without losing input.
      setTimeout(() => setSubmitState('idle'), 1600);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[90vh] max-h-[850px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-amber-400 text-zinc-950">
              <Dish01Icon size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Create Open Order Dish
                <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  Custom
                </span>
              </h3>
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                Compose a bespoke dish with live inventory ingredients.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Cancel01Icon size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-5">
            {/* Left: Composition */}
            <div className="min-h-0 overflow-y-auto px-8 py-6 lg:col-span-3">
              {error && (
                <div
                  className={`mb-5 rounded-md border p-3 text-xs font-medium ${
                    submitState === 'error'
                      ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                  }`}
                >
                  {error}
                </div>
              )}

              {/* Section: Dish */}
              <section className="mb-7">
                <h4 className={SECTION_TITLE_CLASS}>Dish</h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className={LABEL_CLASS}>
                      <Dish01Icon size={14} className="text-zinc-400" />
                      <span>
                        Dish / Item Name <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chef's Special Salad"
                      autoFocus
                      disabled={isBusy}
                      className={CONTROL_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <span>Dietary Tag</span>
                    </label>
                    <Select
                      value={dietary}
                      onValueChange={setDietary}
                      disabled={isBusy}
                    >
                      <SelectTrigger className={CONTROL_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VEG" className="text-sm">
                          Veg (Green)
                        </SelectItem>
                        <SelectItem value="NON_VEG" className="text-sm">
                          Non-Veg (Red)
                        </SelectItem>
                        <SelectItem value="VEGAN" className="text-sm">
                          Vegan (Leaf)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Section: Pricing & Quantity */}
              <section className="mb-7">
                <h4 className={SECTION_TITLE_CLASS}>Pricing &amp; Quantity</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className={LABEL_CLASS}>
                      <span>
                        Base Price (₹) <span className="text-red-500">*</span>
                      </span>
                      <span className="ml-auto text-[10px] font-normal text-zinc-400">
                        Per unit
                      </span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="e.g. 250"
                      disabled={isBusy}
                      className={`${CONTROL_CLASS} font-semibold tabular-nums`}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <span>Quantity</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        className="size-10 rounded-md border-zinc-300 font-bold dark:border-zinc-700"
                        onClick={() =>
                          setQuantity((prev) => Math.max(1, prev - 1))
                        }
                      >
                        −
                      </Button>
                      <span className="flex-1 text-center text-sm font-semibold tabular-nums">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        className="size-10 rounded-md border-zinc-300 font-bold dark:border-zinc-700"
                        onClick={() => setQuantity((prev) => prev + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <span>Line Total</span>
                    </label>
                    <div className="flex h-10 items-center justify-end rounded-md border border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                      <span className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        ₹{lineTotal}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Ingredients */}
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className={SECTION_TITLE_CLASS + ' mb-0'}>
                    <span className="inline-flex items-center gap-1.5">
                      <Pot02Icon
                        size={13}
                        className="text-amber-600 dark:text-amber-400"
                      />
                      Ingredients
                    </span>
                  </h4>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {selectedIngredients.length} added
                  </span>
                </div>

                {/* Selected Ingredients */}
                {selectedIngredients.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Material
                          </th>
                          <th className="w-32 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Quantity
                          </th>
                          <th className="w-24 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Extra (₹)
                          </th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {selectedIngredients.map((ing) => (
                          <tr
                            key={ing.rawMaterialId}
                            className="bg-white dark:bg-zinc-900"
                          >
                            <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                              <span className="truncate">{ing.name}</span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={ing.quantity}
                                  disabled={isBusy}
                                  onChange={(e) =>
                                    handleUpdateIngredient(
                                      ing.rawMaterialId,
                                      'quantity',
                                      e.target.value
                                    )
                                  }
                                  className="h-8 w-16 rounded-md border-zinc-300 text-center text-xs tabular-nums dark:border-zinc-700"
                                />
                                <span className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                                  {ing.unit}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-zinc-400">
                                  ₹
                                </span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={ing.price}
                                  disabled={isBusy}
                                  onChange={(e) =>
                                    handleUpdateIngredient(
                                      ing.rawMaterialId,
                                      'price',
                                      e.target.value
                                    )
                                  }
                                  className="h-8 w-16 rounded-md border-zinc-300 text-center text-xs tabular-nums dark:border-zinc-700"
                                />
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleRemoveIngredient(ing.rawMaterialId)
                                }
                                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                                title="Remove ingredient"
                              >
                                <Delete02Icon size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Search + Available Materials */}
                <div className="rounded-md border border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <div className="relative mb-3">
                    <Search01Icon
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <Input
                      value={searchMaterial}
                      onChange={(e) => setSearchMaterial(e.target.value)}
                      placeholder="Search raw material to add (e.g. Cheese, Chicken, Sauce)…"
                      disabled={isBusy}
                      className={`${CONTROL_CLASS} pl-9`}
                    />
                  </div>

                  {loadingMaterials ? (
                    <p className="px-1 py-2 text-[11px] italic text-zinc-400">
                      Loading materials…
                    </p>
                  ) : filteredMaterials.length === 0 ? (
                    <p className="px-1 py-2 text-[11px] italic text-zinc-400">
                      {searchMaterial
                        ? 'No matching raw materials.'
                        : 'No additional raw materials available.'}
                    </p>
                  ) : (
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {filteredMaterials.map((mat) => (
                        <button
                          key={mat.id}
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAddIngredient(mat)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-900 dark:hover:bg-amber-950/30 dark:hover:text-amber-300"
                        >
                          <PlusSignIcon size={11} />
                          <span>{mat.name}</span>
                          <span className="text-[10px] font-normal text-zinc-400">
                            {mat.currentStock} {mat.unit}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Section: Kitchen Notes */}
              <section>
                <h4 className={SECTION_TITLE_CLASS}>Kitchen Notes</h4>
                <Input
                  value={kitchenNotes}
                  onChange={(e) => setKitchenNotes(e.target.value)}
                  placeholder="e.g. Cook in olive oil, no onions, extra crisp, dressing on the side"
                  disabled={isBusy}
                  className={CONTROL_CLASS}
                />
              </section>
            </div>

            {/* Right: Live Preview */}
            <aside className="hidden min-h-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50/60 px-6 py-6 lg:col-span-2 lg:block dark:border-zinc-800 dark:bg-zinc-900/40">
              <h4 className={SECTION_TITLE_CLASS}>Order Preview</h4>

              {/* Dish card */}
              <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {name.trim() || 'Untitled Dish'}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${dietaryMeta.dot}`}
                      />
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        {dietaryMeta.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      Qty
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      × {quantity}
                    </p>
                  </div>
                </div>

                {kitchenNotes.trim() && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      Kitchen Note
                    </p>
                    <p className="text-[11px] leading-snug text-amber-900/90 dark:text-amber-200/80">
                      {kitchenNotes.trim()}
                    </p>
                  </div>
                )}
              </div>

              {/* Ingredients list */}
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Ingredients ({selectedIngredients.length})
                </p>
                {selectedIngredients.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <InformationCircleIcon
                      size={14}
                      className="mt-0.5 shrink-0 text-zinc-400"
                    />
                    <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                      No ingredients added yet. Pick from inventory on the
                      left to compose this dish.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedIngredients.map((ing) => {
                      const extra = Number(ing.price) || 0;
                      return (
                        <li
                          key={ing.rawMaterialId}
                          className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <span className="min-w-0 flex-1 truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {ing.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                            {ing.quantity} {ing.unit}
                          </span>
                          {extra > 0 && (
                            <span className="shrink-0 font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                              +₹{extra}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Price breakdown */}
              <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Price Breakdown
                </p>
                <dl className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Base price
                    </dt>
                    <dd className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                      ₹{parsedBasePrice}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Ingredient extras
                    </dt>
                    <dd className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                      ₹{ingredientsExtraTotal}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Unit price
                    </dt>
                    <dd className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                      ₹{unitPrice}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      Quantity
                    </dt>
                    <dd className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                      × {quantity}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-baseline justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Line Total
                  </span>
                  <span className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    ₹{lineTotal}
                  </span>
                </div>
              </div>
            </aside>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200 px-8 py-3.5 dark:border-zinc-800">
            <p className="hidden text-[11px] text-zinc-500 dark:text-zinc-400 sm:block">
              {submitState === 'submitting' && 'Adding dish to cart…'}
              {submitState === 'success' && 'Added to cart.'}
              {submitState === 'error' && 'Something went wrong. Try again.'}
              {submitState === 'idle' &&
                (selectedIngredients.length > 0
                  ? `${selectedIngredients.length} ingredient${
                      selectedIngredients.length === 1 ? '' : 's'
                    } will be deducted from inventory.`
                  : 'No ingredients selected.')}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isBusy}
                className="h-9 rounded-md border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isBusy}
                className="h-9 rounded-md bg-amber-400 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-500 disabled:opacity-60"
              >
                {submitState === 'idle' && (
                  <>
                    <span className="ml-1.5">Add to Cart — ₹{lineTotal}</span>
                  </>
                )}
                {submitState === 'submitting' && <span>Adding…</span>}
                {submitState === 'success' && <span>Added ✓</span>}
                {submitState === 'error' && (
                  <span>Retry — ₹{lineTotal}</span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};