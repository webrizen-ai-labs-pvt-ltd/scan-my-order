import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  Card, CardContent, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@smo/ui';
import { Search01Icon, PlusSignIcon, Loading03Icon, Image01Icon } from 'hugeicons-react';

// Filters offered by the Chronon dish catalog. "all" means no filter (Select items can't be empty strings).
const COURSES = [
  ['breakfast', 'Breakfast'], ['starter', 'Starter'], ['main', 'Main'], ['side', 'Side'], ['bread', 'Bread'],
  ['rice', 'Rice'], ['snack', 'Snack'], ['dessert', 'Dessert'], ['beverage', 'Beverage']
];
const DIETS = [
  ['vegan', 'Vegan'], ['vegetarian', 'Vegetarian'], ['eggetarian', 'Eggetarian'],
  ['pescatarian', 'Pescatarian'], ['non_vegetarian', 'Non-veg']
];
const DIETARY_OPTIONS = [['VEG', 'Veg'], ['NON_VEG', 'Non-veg'], ['VEGAN', 'Vegan'], ['EGG', 'Egg']];
const SPICE_OPTIONS = [['NONE', 'None'], ['MILD', 'Mild'], ['MEDIUM', 'Medium'], ['HOT', 'Hot'], ['EXTRA_HOT', 'Extra hot']];

const dietaryBadge = (dietary) => (
  dietary === 'VEG' ? 'bg-green-100 text-green-700' :
  dietary === 'VEGAN' ? 'bg-emerald-100 text-emerald-700' :
  dietary === 'EGG' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
);

const apiErrorMessage = (err, fallback) => err.response?.data?.error?.message || fallback;

export const StoreMenuBuilder = ({ storeId }) => {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [course, setCourse] = useState('all');
  const [diet, setDiet] = useState('all');
  const [regions, setRegions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [totalResults, setTotalResults] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Add Item Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Create Category State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/stores/${storeId}/menu`);
      if (res.data.success) {
        const catList = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.categories || []);
        setCategories(catList);
        // Flat list of all items for preview
        const items = catList.flatMap(c => c.items || []);
        setMenuItems(items);
      }
    } catch (err) {
      setError('Failed to fetch menu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [storeId]);

  useEffect(() => {
    // Regions only feed the filter; the builder still works without them
    api.get(`/stores/${storeId}/menu/catalog/regions`)
      .then(res => { if (res.data.success) setRegions(res.data.data || []); })
      .catch(() => {});
  }, [storeId]);

  const hasFilters = region !== 'all' || course !== 'all' || diet !== 'all';

  const searchParams = (cursor) => ({
    q: searchQuery.trim() || undefined,
    region: region !== 'all' ? region : undefined,
    course: course !== 'all' ? course : undefined,
    diet: diet !== 'all' ? diet : undefined,
    cursor: cursor || undefined
  });

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() && !hasFilters) return;

    setIsSearching(true);
    setSearchError('');
    try {
      const res = await api.get(`/stores/${storeId}/menu/catalog/dishes`, { params: searchParams() });
      setSearchResults(res.data.data?.dishes || []);
      setNextCursor(res.data.data?.nextCursor || null);
      setTotalResults(res.data.data?.total || 0);
    } catch (err) {
      setSearchResults([]);
      setNextCursor(null);
      setSearchError(apiErrorMessage(err, 'Failed to search the dish catalog'));
    } finally {
      setHasSearched(true);
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await api.get(`/stores/${storeId}/menu/catalog/dishes`, { params: searchParams(nextCursor) });
      setSearchResults(prev => [...prev, ...(res.data.data?.dishes || [])]);
      setNextCursor(res.data.data?.nextCursor || null);
    } catch (err) {
      setSearchError(apiErrorMessage(err, 'Failed to load more dishes'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Pre-select an existing category that matches the dish's course (e.g. "Desserts" for a dessert)
  const suggestCategoryId = (dishCourse) => {
    if (!dishCourse) return '';
    const match = categories.find(c => c.name?.toLowerCase().includes(dishCourse));
    return match ? match.id : '';
  };

  const openAddItemModal = (dish) => {
    setSelectedItem({
      name: dish.name,
      image: dish.image,
      dietary: dish.suggested?.dietary || 'VEG',
      spiceLevel: dish.suggested?.spiceLevel || 'NONE',
      description: dish.description || ''
    });
    setPrice('');
    setSelectedCategoryId(suggestCategoryId(dish.course));
    setNewCategoryName('');
    setIsCreatingCategory(false);
    setAddError('');
    setIsModalOpen(true);
  };

  const updateSelectedItem = (field, value) => setSelectedItem(prev => ({ ...prev, [field]: value }));

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.post(`/stores/${storeId}/menu/categories`, {
        name: newCategoryName,
        sortOrder: categories.length
      });
      if (res.data.success) {
        const newCat = res.data.data;
        setCategories([...categories, newCat]);
        setSelectedCategoryId(newCat.id);
        setIsCreatingCategory(false);
        setNewCategoryName('');
      }
    } catch (err) {
      console.error('Failed to create category', err);
      setAddError(apiErrorMessage(err, 'Failed to create category'));
    }
  };

  const handleAddItem = async () => {
    if (!selectedCategoryId || !price) return;
    setIsSubmitting(true);
    setAddError('');
    try {
      await api.post(`/stores/${storeId}/menu/items`, {
        categoryId: selectedCategoryId,
        name: selectedItem.name,
        description: selectedItem.description,
        price: Math.round(parseFloat(price)), // Store direct integer rupee value (e.g. 250 for ₹250)
        image: selectedItem.image || undefined,
        dietary: selectedItem.dietary,
        spiceLevel: selectedItem.spiceLevel
      });

      setIsModalOpen(false);
      fetchMenu(); // Refresh the menu preview
    } catch (err) {
      console.error('Failed to add item', err);
      setAddError(apiErrorMessage(err, 'Failed to add item'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loading03Icon className="animate-spin mx-auto text-zinc-500" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Search & Results Panel */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Smart Menu Builder</h3>
          <p className="text-sm text-zinc-500 mb-6">Search regional dishes by name or ingredient, or browse by region, course and diet.</p>

          <form onSubmit={handleSearch} className="space-y-3 mb-6">
            <div className="flex gap-2">
              <Input
                placeholder="Search dishes (e.g. Biryani, Dosa, paneer)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-none rounded-l-full"
              />
              <Button type="submit" disabled={isSearching || (!searchQuery.trim() && !hasFilters)} className="rounded-none rounded-r-full h-11">
                {isSearching ? <Loading03Icon className="animate-spin" size={18} /> : <Search01Icon size={18} className="mr-2" />} Search
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="rounded-none rounded-l-full"><SelectValue placeholder="Region" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {regions.map(r => (
                    <SelectItem key={r.slug} value={r.slug}>{r.name}{r.country && r.country !== r.name ? `, ${r.country}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={course} onValueChange={setCourse}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {COURSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={diet} onValueChange={setDiet}>
                <SelectTrigger className="rounded-none rounded-r-full"><SelectValue placeholder="Diet" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any diet</SelectItem>
                  {DIETS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </form>

          {searchError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{searchError}</p>
          )}

          <div className="space-y-4">
            {searchResults.map(dish => (
              <div key={dish.slug} className="flex flex-col sm:flex-row gap-4 items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                {dish.image ? (
                  <img src={dish.image} alt={dish.name} className="w-16 h-16 rounded-md object-cover bg-zinc-200" />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
                    <Image01Icon size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{dish.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dietaryBadge(dish.suggested?.dietary)}`}>
                      {dish.suggested?.dietary}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 capitalize">{dish.course}{dish.region ? ` • ${dish.region.name}` : ''}</p>
                  {dish.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{dish.description}</p>}
                </div>
                <Button size="sm" onClick={() => openAddItemModal(dish)} className="w-full sm:w-auto">
                  <PlusSignIcon size={16} className="mr-1" /> Add
                </Button>
              </div>
            ))}
            {searchResults.length === 0 && hasSearched && !isSearching && !searchError && (
              <p className="text-center text-sm text-zinc-500 py-8">No dishes found. Try another name, ingredient or filter.</p>
            )}
            {nextCursor && (
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? <Loading03Icon className="animate-spin" size={16} /> : `Load more (${searchResults.length} of ${totalResults})`}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Menu Preview Panel */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Current Menu Preview</h3>
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category.id}>
                <h4 className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">{category.name}</h4>
                {category.items?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {category.items.map(item => (
                      <div key={item.id} className="flex gap-3 items-center p-2 rounded-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
                            <Image01Icon size={20} />
                          </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">{item.name}</p>
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">₹{item.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No items in this category.</p>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-sm text-zinc-500 py-12">Your menu is currently empty. Use the Smart Builder to add items.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Item Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add to Menu</DialogTitle>
            <DialogDescription>
              Check the details, then set the price and category for this item.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="flex gap-4 items-center mb-6 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              {selectedItem.image ? (
                <img src={selectedItem.image} alt={selectedItem.name} className="w-16 h-16 rounded-md object-cover shadow-sm" />
              ) : (
                <div className="w-16 h-16 rounded-md bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
                  <Image01Icon size={24} />
                </div>
              )}
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{selectedItem.name}</h4>
                <div className="flex gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dietaryBadge(selectedItem.dietary)}`}>
                    {selectedItem.dietary}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedItem && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={selectedItem.description}
                onChange={e => updateSelectedItem('description', e.target.value)}
                placeholder="Short description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dietary</Label>
                <Select value={selectedItem.dietary} onValueChange={v => updateSelectedItem('dietary', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIETARY_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Spice level</Label>
                <Select value={selectedItem.spiceLevel} onValueChange={v => updateSelectedItem('spiceLevel', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPICE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              {!isCreatingCategory ? (
                <div className="flex gap-2">
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => setIsCreatingCategory(true)}>
                    New
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Category Name (e.g. Mains)"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    autoFocus
                  />
                  <Button type="button" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                    Save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setIsCreatingCategory(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>

            {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
          </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedCategoryId || !price || isSubmitting}>
              {isSubmitting ? <Loading03Icon className="animate-spin" size={16} /> : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
