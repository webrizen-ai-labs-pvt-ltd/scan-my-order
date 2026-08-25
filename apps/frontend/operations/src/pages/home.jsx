import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '@smo/ui';

export const Home = () => {
  const { user } = useAuthStore();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 font-sans p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 flex flex-col items-center text-center">
        <img src="/logo.png" alt="Logo" className="w-24 h-24 mb-8 drop-shadow-[0_0_15px_rgba(234,179,8,0.2)] invert" />
        <h1 className="text-4xl font-bold text-zinc-100 mb-4">Scan My Order</h1>
        <p className="text-lg text-zinc-400 mb-8">Operations OS for restaurant staff.</p>
        
        <Link to="/login" className="w-full">
          <Button size="lg" className="w-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-semibold text-lg transition-colors">
            Staff Login
          </Button>
        </Link>
      </div>
    </div>
  );
};
