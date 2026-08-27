import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HomePage } from './pages/home-page';
import { BrandPage } from './pages/brand-page';
import { StoreMenuPage } from './pages/store-menu-page';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com';
  
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/:brandSlug" element={<BrandPage />} />
          <Route path="/:brandSlug/:storeSlug" element={<StoreMenuPage />} />
        </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
