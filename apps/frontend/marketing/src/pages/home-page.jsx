import React from 'react';
import { BentoGrid, BentoGridItem } from '../components/bento-grid';
import { SoftCard } from '../components/soft-card';
import { Button } from '@smo/ui';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] glow-bg pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] glow-bg pointer-events-none" />


      <main className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto mb-24">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground mb-6">
            The Modern <span className="text-primary">Restaurant OS</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            Consolidate your operations with our minimalist, powerful platform. From QR menus to KDS, everything you need to run your restaurant seamlessly.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-lg">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="rounded-none h-14 px-8 text-lg border-border hover:bg-muted">
              Book a Demo
            </Button>
          </div>
        </section>

        {/* Bento Grid Features */}
        <section className="mb-24">
          <BentoGrid>
            {/* Main Feature - Hero Image */}
            <BentoGridItem colSpan={2} rowSpan={2} className="p-0 border border-border">
              <SoftCard className="h-full p-8 flex flex-col items-start border-none">
                <h3 className="text-3xl font-bold mb-2">Unified Point of Sale</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  A lightning-fast POS designed for modern hardware. Integrated directly with your kitchen display and QR menus.
                </p>
                <div className="flex-grow flex items-end justify-center w-full mt-4">
                  <img src="/images/hero.jpg" alt="Modern POS System" className="object-cover w-full h-auto rounded-none soft-border" />
                </div>
              </SoftCard>
            </BentoGridItem>

            {/* QR Menus */}
            <BentoGridItem colSpan={1} rowSpan={2} className="p-0 border border-border">
              <SoftCard className="h-full p-8 flex flex-col items-start border-none">
                <h3 className="text-2xl font-bold mb-2">Dynamic QR Menus</h3>
                <p className="text-muted-foreground mb-6">
                  Beautiful, scannable menus that sync in real-time with your inventory.
                </p>
                <div className="flex-grow flex items-end justify-center w-full">
                  <img src="/images/qr.jpg" alt="QR Menu on Smartphone" className="object-cover w-full h-auto rounded-none soft-border" />
                </div>
              </SoftCard>
            </BentoGridItem>

            {/* Kitchen Display */}
            <BentoGridItem colSpan={1} className="p-0 border border-border">
              <SoftCard className="h-full p-6 border-none">
                <h3 className="text-xl font-bold mb-2">Kitchen Display</h3>
                <p className="text-muted-foreground">Keep your back-of-house in sync with real-time order routing.</p>
              </SoftCard>
            </BentoGridItem>

            {/* Inventory Management */}
            <BentoGridItem colSpan={1} className="p-0 border border-border">
              <SoftCard className="h-full p-6 border-none">
                <h3 className="text-xl font-bold mb-2">Smart Inventory</h3>
                <p className="text-muted-foreground">Automated stock tracking directly tied to your recipes.</p>
              </SoftCard>
            </BentoGridItem>

            {/* Analytics */}
            <BentoGridItem colSpan={2} className="p-0 border border-border">
              <SoftCard className="h-full p-6 border-none flex flex-col justify-center">
                <h3 className="text-2xl font-bold mb-2">Bring Your Own Keys (BYOAK)</h3>
                <p className="text-muted-foreground">
                  Connect your own Razorpay account. No transaction fee skimming—you keep 100% of your revenue.
                </p>
              </SoftCard>
            </BentoGridItem>

          </BentoGrid>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between">
          <div className="font-elsie text-2xl text-primary font-bold mb-4 md:mb-0">SMO</div>
          <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} Webrizen AI Labs Pvt Ltd. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
