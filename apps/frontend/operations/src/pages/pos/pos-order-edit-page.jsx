import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@smo/ui';
import {
  ArrowLeft01Icon,
  AlertCircleIcon,
  Delete02Icon,
  MinusSignIcon,
  PlusSignIcon,
  Pot02Icon,
  Loading03Icon,
  CheckmarkBadge01Icon,
} from 'hugeicons-react';
import api from '../../lib/api';
import { usePos } from './pos-layout';
import { useAuthStore } from '../../store/authStore';
import {
  useOrderEditDraftStore,
  draftLineFromOrderItem,
  draftUnitPrice,
  createDraftLineId,
} from '../../store/order-edit-draft-store';
import { MenuCatalog } from '../../components/pos/menu-catalog';
import { ModifierDialog } from '../../components/pos/modifier-dialog';
import { PosIngredientCustomizerModal } from '../../components/pos-ingredient-customizer-modal';
import { apiErrorMessage } from '../../components/pos/pos-toasts';

const EDITABLE_STATUSES = ['PENDING_PAYMENT', 'PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED'];
const MANAGER_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'];

/**
 * /dashboard/pos/orders/:orderId/edit — manager edits the items of a placed order.
 * Unsaved changes live in the draft store so the custom-dish page can add to them.
 */
export const PosOrderEditPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard/pos/orders';
  const navigate = useNavigate();
  const { storeId, data, toast } = usePos();
  const { user } = useAuthStore();
  const isManager = MANAGER_ROLES.includes(user?.role);

  const lines = useOrderEditDraftStore(s => s.drafts[orderId]);
  const { setDraft, clearDraft } = useOrderEditDraftStore.getState();

  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modifierItem, setModifierItem] = useState(null);
  const [customizing, setCustomizing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/stores/${storeId}/orders/${orderId}`)
      .then(res => {
        if (cancelled) return;
        const fetched = res.data.data;
        setOrder(fetched);
        // Keep an existing draft (e.g. returning from the custom-dish page)
        if (!useOrderEditDraftStore.getState().drafts[orderId]) {
          // Kitchen-rejected lines are history, not editable items
          setDraft(orderId, (fetched.items || []).filter(i => i.status !== 'REJECTED').map(draftLineFromOrderItem));
        }
      })
      .catch(err => { if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load this order')); });
    return () => { cancelled = true; };
  }, [storeId, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLines = useCallback((fn) => setDraft(orderId, fn(useOrderEditDraftStore.getState().drafts[orderId] || [])), [orderId, setDraft]);

  const addMenuItem = (item, mods = []) => {
    updateLines(prev => {
      if (mods.length === 0) {
        const existing = prev.find(l => !l.isCustom && l.menuItemId === item.id && l.modifiers.length === 0 && !(l.customIngredients || []).length);
        if (existing) return prev.map(l => (l.id === existing.id ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
      }
      return [...prev, {
        id: createDraftLineId(),
        menuItemId: item.id,
        isCustom: false,
        name: item.name,
        dietary: item.dietary,
        basePrice: item.price + mods.reduce((s, m) => s + (m.price || 0), 0),
        customIngredients: [],
        quantity: 1,
        kitchenNotes: '',
        modifiers: mods.map(m => m.id),
        modifierNames: mods.map(m => m.name),
      }];
    });
  };

  const handleAdd = (item) => {
    if (item.isManuallyDisabled || item.isSystemDisabled) return;
    if (item.modifierGroups?.length > 0) setModifierItem(item);
    else addMenuItem(item);
  };

  const changeQuantity = (id, delta) => updateLines(prev => prev.map(l => (
    l.id === id ? { ...l, quantity: Math.min(99, Math.max(1, l.quantity + delta)) } : l
  )));

  const removeLine = (id) => {
    if ((lines || []).length <= 1) {
      toast('An order needs at least one item. Cancel the order instead to remove everything.', 'error');
      return;
    }
    updateLines(prev => prev.filter(l => l.id !== id));
  };

  const catalogLines = useMemo(() => (lines || [])
    .filter(l => !l.isCustom && l.modifiers.length === 0 && !(l.customIngredients || []).length)
    .map(l => ({ lineId: l.id, isCustom: false, menuItem: { id: l.menuItemId }, modifiers: [], quantity: l.quantity })), [lines]);

  const subTotal = (lines || []).reduce((s, l) => s + draftUnitPrice(l) * l.quantity, 0);
  const originalSubTotal = order?.subTotal ?? 0;
  const delta = subTotal - originalSubTotal;

  const leave = () => {
    clearDraft(orderId);
    navigate(returnTo);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/stores/${storeId}/orders/${orderId}/items`, {
        items: lines.map(l => ({
          orderItemId: l.orderItemId || undefined,
          menuItemId: l.isCustom ? undefined : l.menuItemId,
          isCustom: l.isCustom || undefined,
          customName: l.isCustom ? l.name : undefined,
          customPrice: l.isCustom ? Number(l.customPrice) || 0 : undefined,
          customIngredients: l.customIngredients || [],
          quantity: l.quantity,
          kitchenNotes: l.kitchenNotes || '',
          modifiers: l.modifiers || [],
        })),
      });
      toast(`Order #${orderId.slice(-6).toUpperCase()} updated — kitchen ticket refreshed`, 'success');
      data.refreshTables();
      leave();
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update the order'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) {
    return <div className="p-6 text-sm text-zinc-500">Only managers can edit placed orders.</div>;
  }
  if (loadError) {
    return (
      <div className="p-6 flex flex-col items-start gap-3">
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-4 text-sm text-rose-700">{loadError}</div>
        <Button variant="outline" onClick={leave}>Back</Button>
      </div>
    );
  }
  if (!order || !lines) {
    return <div className="h-full flex items-center justify-center text-zinc-400"><Loading03Icon size={26} className="animate-spin" /></div>;
  }

  const locked = order.paidAt || !EDITABLE_STATUSES.includes(order.status);

  return (
    <div className="h-full grid grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_420px] gap-3 p-3 overflow-hidden">
      <MenuCatalog
        menu={data.menu}
        lines={catalogLines}
        onAdd={handleAdd}
        onDecrement={(id) => changeQuantity(id, -1)}
        onOpenCustomDish={() => navigate(`/dashboard/pos/custom-dish?for=${orderId}&returnTo=${encodeURIComponent(`/dashboard/pos/orders/${orderId}/edit?returnTo=${encodeURIComponent(returnTo)}`)}`)}
        toolbar={
          <div className="col-span-2 flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 rounded-full" onClick={leave} aria-label="Back without saving">
              <ArrowLeft01Icon size={16} />
            </Button>
            <div className="min-w-0">
              <div className="text-sm font-black truncate">Editing Order #{orderId.slice(-6).toUpperCase()}</div>
              <div className="text-[11px] text-zinc-500 truncate">
                {order.table ? `Table ${order.table.tableNumber}` : 'Takeaway'} · {order.status.replace('_', ' ').toLowerCase()}
              </div>
            </div>
          </div>
        }
      />

      <div className="flex flex-col h-full min-h-0 overflow-hidden rounded-2xl border border-stone-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <div className="shrink-0 px-4 py-3 border-b border-stone-200/80 dark:border-zinc-800">
          <h2 className="text-sm font-black">Order items</h2>
          <p className="text-[11px] text-zinc-500">Tap menu items to add. Changes reach the kitchen when you save.</p>
        </div>

        {locked && (
          <div className="shrink-0 mx-3 mt-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
            <AlertCircleIcon size={15} className="shrink-0" />
            This order is {order.paidAt ? 'already paid' : order.status.toLowerCase()} and can’t be edited. Place a new order for extra items.
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
          {lines.map(line => {
            const unit = draftUnitPrice(line);
            return (
              <div key={line.id} className="rounded-xl border border-stone-200/80 bg-stone-50/50 dark:border-zinc-800/80 dark:bg-zinc-800/30 p-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{line.name}</span>
                      {line.isCustom && <span className="px-1.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">Custom</span>}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      ₹{unit} each{line.modifierNames?.length ? ` · ${line.modifierNames.join(', ')}` : ''}
                    </div>
                    {line.customIngredients?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {line.customIngredients.map((ing, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            +{ing.name} ({ing.quantity}{ing.unit}){Number(ing.price) > 0 ? ` · ₹${ing.price}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {line.kitchenNotes && <p className="text-[10px] italic text-amber-700 dark:text-amber-400 mt-0.5">“{line.kitchenNotes}”</p>}
                  </div>
                  <span className="text-xs font-black tabular-nums shrink-0">₹{unit * line.quantity}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setCustomizing(line)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-40"
                  >
                    <Pot02Icon size={12} /> Ingredients & note
                  </button>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center rounded-lg border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <button type="button" disabled={locked} aria-label="Decrease quantity" onClick={() => changeQuantity(line.id, -1)} className="p-1 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-l-lg disabled:opacity-40"><MinusSignIcon size={12} /></button>
                      <span className="w-6 text-center text-[11px] font-black tabular-nums">{line.quantity}</span>
                      <button type="button" disabled={locked} aria-label="Increase quantity" onClick={() => changeQuantity(line.id, 1)} className="p-1 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-r-lg disabled:opacity-40"><PlusSignIcon size={12} /></button>
                    </div>
                    <button type="button" disabled={locked} aria-label={`Remove ${line.name}`} onClick={() => removeLine(line.id)} className="size-7 rounded-md flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40">
                      <Delete02Icon size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-stone-200/90 dark:border-zinc-800 p-3 flex flex-col gap-2 bg-stone-50/80 dark:bg-zinc-950/70">
          <div className="flex justify-between text-xs text-zinc-500"><span>Was</span><span className="tabular-nums">₹{originalSubTotal}</span></div>
          <div className="flex justify-between text-sm font-black">
            <span>New subtotal</span>
            <span className="tabular-nums">₹{subTotal}{delta !== 0 && <span className={`ml-1.5 text-xs ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>({delta > 0 ? '+' : '−'}₹{Math.abs(delta)})</span>}</span>
          </div>
          <p className="text-[10px] text-zinc-400">
            Items already on the order keep the price they were sold at; new items use today’s menu price.
            Tax uses the rates from when the order was placed. Discounts and tax are recalculated when you save.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={leave} disabled={saving}>Discard</Button>
            <Button onClick={save} disabled={saving || locked || lines.length === 0}>
              {saving ? <Loading03Icon size={16} className="animate-spin" /> : <><CheckmarkBadge01Icon size={16} className="mr-1.5" /> Save changes</>}
            </Button>
          </div>
        </div>
      </div>

      <ModifierDialog
        item={modifierItem}
        onClose={() => setModifierItem(null)}
        onConfirm={(item, mods) => { addMenuItem(item, mods); setModifierItem(null); }}
        onError={(msg) => toast(msg, 'error')}
      />

      <PosIngredientCustomizerModal
        isOpen={Boolean(customizing)}
        onClose={() => setCustomizing(null)}
        storeId={storeId}
        item={customizing ? { ...customizing, menuItem: { price: customizing.isCustom ? customizing.customPrice : customizing.basePrice } } : null}
        onSave={(result) => updateLines(prev => prev.map(l => (
          l.id === result.id ? { ...l, customIngredients: result.customIngredients || [], kitchenNotes: result.kitchenNotes ?? l.kitchenNotes } : l
        )))}
      />
    </div>
  );
};

