import React from 'react';
import { Button, AnimatedThemeToggler } from '@smo/ui';
import { QrCodeIcon } from 'hugeicons-react';

export const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center relative">
      <img src="https://i.pinimg.com/736x/03/01/9f/03019fcffdc6e6d797f95500b6083365.jpg" alt="Hero Image" className="absolute top-0 left-0 size-full dark:invert" />
      
      {/* Top Navigation / Branding Elements */}
      <img src="/logo1.png" alt="Scan My Order Logo" className="absolute top-4 left-4 sm:top-6 sm:left-6 h-8 sm:h-10 md:h-12 w-auto object-contain dark:invert" />
      <AnimatedThemeToggler className="absolute top-4 right-4 sm:top-6 sm:right-6" />
      
      <div className="relative mx-auto pt-32 pb-24 lg:max-w-7xl w-full px-5 sm:px-10 md:px-12 lg:px-5 text-center space-y-10">
        <h1 className="text-gray-900 dark:text-white mx-auto max-w-5xl font-bold text-4xl/tight sm:text-5xl/tight lg:text-6xl/tight xl:text-7xl/tight">
          Your table. Your pace.
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mx-auto max-w-2xl">
         Scan the QR code at your table to explore the menu, customize your meal, and order in seconds. No app downloads, no waiting to catch a waiter's eye.
        </p>
        
        <div className="flex justify-center items-center flex-wrap mx-auto gap-4">
          <Button size="lg">Find a store</Button>
          <Button size="lg" variant="link">How it works</Button>
        </div>
        
        <div className="text-left grid lg:grid-cols-3 p-6 rounded-2xl bg-gradient-to-tr from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 border border-gray-100 dark:border-gray-800 max-w-2xl lg:max-w-5xl mx-auto lg:divide-x divide-y lg:divide-y-0 divide-gray-300 dark:divide-gray-800">
          
          {/* Feature 1: QR Ordering */}
          <div className="flex items-start gap-6 lg:pr-6 pb-6 lg:pb-0">
            <div className="w-10">
              <span className="p-3 rounded-xl bg-gray-200 dark:bg-gray-800 flex w-max text-gray-800 dark:text-gray-200">
                <QrCodeIcon className="w-6 h-6" />
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-gray-900 dark:text-white font-semibold text-lg">
                Instant Ordering
              </h2>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Browse the digital menu and send tickets straight to the kitchen. Your food starts cooking immediately.
              </p>
            </div>
          </div>
          
          {/* Feature 2: Digital Buzzer */}
          <div className="flex items-start gap-6 lg:px-6 py-6 lg:py-0">
            <div className="w-10">
              <span className="p-3 rounded-xl bg-gray-200 dark:bg-gray-800 flex w-max text-gray-800 dark:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-gray-900 dark:text-white font-semibold text-lg">
                Smart Waiter Call
              </h2>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Need water, extra napkins, or assistance? Ping your floor staff directly from your phone with zero friction.
              </p>
            </div>
          </div>
          
          {/* Feature 3: Frictionless Checkout */}
          <div className="flex items-start gap-6 pt-6 lg:pt-0 lg:pl-6">
            <div className="w-10">
              <span className="p-3 rounded-xl bg-gray-200 dark:bg-gray-800 flex w-max text-gray-800 dark:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-gray-900 dark:text-white font-semibold text-lg">
                Seamless Checkout
              </h2>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Pay securely from your seat. Settle the tab or leave a tip on your own terms when you're ready to leave.
              </p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};