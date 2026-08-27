import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export const Waiter = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      
      {/* Header and Tabs */}
      <div className="flex justify-between items-center mb-6 shrink-0 gap-x-2">
        <div className="flex items-center justify-between gap-6 w-full">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Waiter Panel</h1>
            <p className="text-sm text-zinc-500">Service queue & order taking.</p>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-lg ml-8 h-10">
            <NavLink 
              to="/dashboard/waiter" end
              className={({ isActive }) => `px-6 text-sm font-semibold rounded-md transition-colors flex items-center ${isActive ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Service Queue
            </NavLink>
            <NavLink 
              to="/dashboard/waiter/pos"
              className={({ isActive }) => `px-6 text-sm font-semibold rounded-md transition-colors flex items-center ${isActive ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              Take Order
            </NavLink>
          </div>
        </div>
      </div>
      
      {/* Outlet for WaiterTasks or WaiterPOS */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};