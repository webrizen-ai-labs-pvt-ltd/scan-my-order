import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardContent, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Skeleton } from '@smo/ui';
import { PlusSignIcon, Edit02Icon, Delete02Icon, AlertCircleIcon, Tick02Icon, Cancel01Icon, Loading03Icon } from 'hugeicons-react';

export const StoreMenuManager = ({ storeId }) => {
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCategory, setSelectedCategory] = useState(null);

  // Forms state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  const [editingItem, setEditingItem] = useState(null); // null = not editing, {} = new, {id...} = edit existing
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', dietary: 'VEG', spiceLevel: 'NONE', image: '', isManuallyDisabled: false });
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/stores/${storeId}/menu`);
      if (res.data.success) {
        setCategories(res.data.data);
        if (!selectedCategory && res.data.data.length > 0) {
          setSelectedCategory(res.data.data[0]);
        } else if (selectedCategory) {
          // Update selected category reference
          const updated = res.data.data.find(c => c.id === selectedCategory.id);
          setSelectedCategory(updated || res.data.data[0]);
        }
        return res.data.data;
      }
    } catch (err) {
      setError('Failed to fetch menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await api.get(`/stores/${storeId}/inventory/materials`);
      if (res.data.success) {
        setMaterials(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch materials', err);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchMaterials();
  }, [storeId]);

  // Category Actions
  const handleSaveCategory = async () => {
    if (!categoryForm.name) return;
    try {
      await api.post(`/stores/${storeId}/menu/categories`, categoryForm);
      setCategoryForm({ name: '', description: '' });
      setIsAddingCategory(false);
      fetchMenu();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error saving category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category and ALL its items?")) return;
    try {
      await api.delete(`/stores/${storeId}/menu/categories/${id}`);
      if (selectedCategory?.id === id) setSelectedCategory(null);
      fetchMenu();
    } catch (err) {
      setError('Error deleting category');
    }
  };

  // Item Actions
  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price) return;
    setIsSavingItem(true);
    try {
      const payload = { ...itemForm, price: parseInt(itemForm.price), categoryId: selectedCategory.id };
      if (editingItem.id) {
        await api.put(`/stores/${storeId}/menu/items/${editingItem.id}`, payload);
      } else {
        await api.post(`/stores/${storeId}/menu/items`, payload);
      }
      setEditingItem(null);
      fetchMenu();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error saving item');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await api.delete(`/stores/${storeId}/menu/items/${id}`);
      fetchMenu();
    } catch (err) {
      setError('Error deleting item');
    }
  };

  // Recipe Actions
  const handleAddIngredient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawMaterialId = formData.get('rawMaterialId');
    const quantity = parseFloat(formData.get('quantity'));

    if (!rawMaterialId || !quantity) return;

    setIsAddingIngredient(true);
    try {
      await api.post(`/stores/${storeId}/inventory/recipes`, {
        rawMaterialId,
        menuItemId: editingItem.id,
        quantity
      });
      const newCategories = await fetchMenu();

      if (newCategories) {
        // Update editingItem with new recipe data
        const updatedCat = newCategories.find(c => c.id === selectedCategory.id);
        const updatedItem = updatedCat?.items?.find(i => i.id === editingItem.id);
        if (updatedItem) {
          setEditingItem(updatedItem);
        }
      }
      e.target.reset();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Error adding ingredient');
    } finally {
      setIsAddingIngredient(false);
    }
  };

  const handleRemoveIngredient = async (recipeId) => {
    try {
      await api.delete(`/stores/${storeId}/inventory/recipes/${recipeId}`);
      fetchMenu();
      // Optimistic update for UI
      setEditingItem(p => ({
        ...p,
        recipe: p.recipe.filter(r => r.id !== recipeId)
      }));
    } catch (err) {
      setError('Error removing ingredient');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-[600px]">
      {/* Left Pane: Categories */}
      <div className="w-full md:w-1/3 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950/50">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Categories</h3>
          <Button variant="ghost" size="sm" onClick={() => setIsAddingCategory(true)}>
            <PlusSignIcon size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isAddingCategory && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg space-y-3 shadow-sm">
              <Input
                placeholder="Category Name"
                value={categoryForm.name}
                onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAddingCategory(false)}>
                  <Cancel01Icon size={16} />
                </Button>
                <Button size="sm" onClick={handleSaveCategory}>
                  <Tick02Icon size={16} />
                </Button>
              </div>
            </div>
          )}

          {loading && !categories.length ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
          ) : (
            categories.map(cat => (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${selectedCategory?.id === cat.id
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-yellow-300'
                  }`}
              >
                <span className={`font-medium ${selectedCategory?.id === cat.id ? 'text-yellow-700 dark:text-yellow-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {cat.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"
                >
                  <Delete02Icon size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Items */}
      <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-zinc-950">
        {selectedCategory ? (
          <>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">{selectedCategory.name} Items</h3>
                <p className="text-sm text-zinc-500">{selectedCategory.items?.length || 0} items</p>
              </div>
              <Button onClick={() => {
                setEditingItem({});
                setItemForm({ name: '', description: '', price: '', dietary: 'VEG', spiceLevel: 'NONE', image: '', isManuallyDisabled: false });
              }}>
                <PlusSignIcon size={16} className="mr-2" /> Add Item
              </Button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {error && (
                <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <AlertCircleIcon size={16} /> {error}
                </div>
              )}

              {editingItem ? (
                <Card className="border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30">
                  <CardContent className="p-6 space-y-4">
                    <h4 className="font-semibold">{editingItem.id ? 'Edit Item' : 'New Item'}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <Label>Name *</Label>
                        <Input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <Label>Price (₹) *</Label>
                        <Input type="number" value={itemForm.price} onChange={e => setItemForm(p => ({ ...p, price: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <Label>Dietary Preference</Label>
                        <Select value={itemForm.dietary} onValueChange={v => setItemForm(p => ({ ...p, dietary: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VEG">Vegetarian</SelectItem>
                            <SelectItem value="NON_VEG">Non-Vegetarian</SelectItem>
                            <SelectItem value="VEGAN">Vegan</SelectItem>
                            <SelectItem value="EGG">Contains Egg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <Label>Spice Level</Label>
                        <Select value={itemForm.spiceLevel} onValueChange={v => setItemForm(p => ({ ...p, spiceLevel: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">None</SelectItem>
                            <SelectItem value="MILD">Mild</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HOT">Hot</SelectItem>
                            <SelectItem value="EXTRA_HOT">Extra Hot</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Description</Label>
                        <Input value={itemForm.description || ''} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Image URL (Optional)</Label>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          value={itemForm.image || ''}
                          onChange={e => setItemForm(p => ({ ...p, image: e.target.value }))}
                        />
                        {itemForm.image && (
                          <div className="mt-2 size-32 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
                            <img src={itemForm.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.src = 'https://placehold.co/400x300?text=Invalid+Image'} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                      <Button variant="ghost" onClick={() => setEditingItem(null)} disabled={isSavingItem}>Cancel</Button>
                      <Button onClick={handleSaveItem} disabled={isSavingItem}>
                        {isSavingItem ? <Loading03Icon className="animate-spin mr-2" size={16} /> : null}
                        Save Item Details
                      </Button>
                    </div>

                    {editingItem.id && (
                      <div className="pt-2">
                        <h4 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Recipe / Inventory</h4>
                        <p className="text-sm text-zinc-500 mb-4">Link raw materials to automatically deduct stock when this item is ordered.</p>

                        {editingItem.recipe && editingItem.recipe.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Ingredients ({editingItem.recipe.length})
                              </span>
                              <span className="text-xs text-zinc-400">Total items</span>
                            </div>

                           <div className='grid grid-cols-2 gap-3'>
                             {editingItem.recipe.map((rec, index) => (
                              <div
                                key={rec.id}
                                className="group flex justify-between items-center bg-white dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 hover:shadow-sm"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Index number */}
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    {index + 1}
                                  </span>

                                  {/* Ingredient info */}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                        {rec.rawMaterial.name}
                                      </span>

                                      {/* Quantity badge */}
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20">
                                        {rec.quantity} {rec.rawMaterial.unit}
                                      </span>
                                    </div>

                                    {/* Additional info if available */}
                                    {rec.rawMaterial.category && (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {rec.rawMaterial.category}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleRemoveIngredient(rec.id)}
                                  className="flex-shrink-0 ml-3 p-2 rounded-md text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Remove ingredient"
                                  aria-label={`Remove ${rec.rawMaterial.name}`}
                                >
                                  <Delete02Icon size={16} />
                                </button>
                              </div>
                            ))}
                           </div>
                          </div>
                        ) : (
                          <div className="text-sm mb-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-zinc-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No ingredients linked yet</p>
                                <p className="text-xs text-zinc-400 mt-0.5">Add ingredients to create the recipe</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <form onSubmit={handleAddIngredient} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1.5">
                            <Label>Material</Label>
                            <select name="rawMaterialId" className="w-full h-10 px-3 rounded-full rounded-r-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm">
                              <option value="">Select Material...</option>
                              {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24 space-y-1.5">
                            <Label>Quantity</Label>
                            <Input name="quantity" type="number" step="0.001" placeholder="0" disabled={isAddingIngredient} className="h-10 rounded-none" />
                          </div>
                          <Button type="submit" variant="outline" disabled={isAddingIngredient} className="rounded-l-none h-10">
                            {isAddingIngredient ? <Loading03Icon className="animate-spin" size={16} /> : 'Add'}
                          </Button>
                        </form>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {selectedCategory.items?.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 transition-colors">
                      <div className="flex items-center gap-4">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-md object-cover border border-zinc-200 dark:border-zinc-800" onError={(e) => e.target.style.display = 'none'} />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-400">No Img</div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full border-2 ${item.dietary === 'VEG' || item.dietary === 'VEGAN' ? 'border-green-600 bg-green-100' :
                                item.dietary === 'EGG' ? 'border-yellow-600 bg-yellow-100' : 'border-red-600 bg-red-100'
                              }`} title={item.dietary} />
                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h4>
                            {item.isManuallyDisabled && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Disabled</span>}
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">₹{item.price}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingItem(item);
                          setItemForm({ ...item });
                        }}>
                          <Edit02Icon size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteItem(item.id)}>
                          <Delete02Icon size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!selectedCategory.items || selectedCategory.items.length === 0) && (
                    <div className="text-center py-12 text-zinc-500">
                      No items in this category yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 bg-zinc-50 dark:bg-zinc-900/10">
            Select or create a category to manage items.
          </div>
        )}
      </div>
    </div>
  );
};
