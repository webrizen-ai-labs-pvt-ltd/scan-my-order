import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/home-page';
import { BrandPage } from './pages/brand-page';
import { StoreMenuPage } from './pages/store-menu-page';

function App() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:brandSlug" element={<BrandPage />} />
        <Route path="/:brandSlug/:storeSlug" element={<StoreMenuPage />} />
      </Routes>
    </div>
  );
}

export default App;
