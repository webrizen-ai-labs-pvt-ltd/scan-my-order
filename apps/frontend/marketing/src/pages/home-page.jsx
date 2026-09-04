import React from 'react';
import { BentoGrid, BentoGridItem } from '../components/bento-grid';
import { SoftCard } from '../components/soft-card';
import { Button } from '@smo/ui';
import { Link } from 'react-router-dom';
import WebThreads from '../components/web-threads';
import { BorderBeam } from 'border-beam';

export default function HomePage() {
    return (
        <section className="relative w-full flex flex-col items-center justify-center md:p-8 p-2 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 text-yellow-50 min-h-[89vh] overflow-hidden">

            <div className="container mx-auto px-4 md:px-8 py-12 flex flex-col w-full h-full gap-8 relative z-20">
                {/* Badge */}
                <div className="flex justify-center">
                    <span className="inline-flex items-center gap-2 bg-yellow-100/20 backdrop-blur-sm border border-yellow-100/30 rounded-full px-4 py-2 text-sm font-medium">
                        Now in Beta - Free for early adopters
                    </span>
                </div>

                <div className="text-center space-y-6">
                    <h1 className="text-4xl md:text-7xl font-elsie leading-tight">
                        Curated Restaurant Management{" "}
                        <span className="relative inline-block">
                            Platform
                            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 15C50 5 150 5 198 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-yellow-200/60" />
                            </svg>
                        </span>{" "}
                        that scales with you.
                    </h1>

                    <p className="text-lg md:text-xl max-w-2xl mx-auto text-yellow-50/90">
                        Streamline your restaurant operations with our all-in-one platform that connects your kitchen, bar, and front of house.
                    </p>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto w-full">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="text-2xl md:text-3xl font-bold">500+</div>
                        <div className="text-xs md:text-sm text-yellow-50/80">Restaurants</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="text-2xl md:text-3xl font-bold">99.9%</div>
                        <div className="text-xs md:text-sm text-yellow-50/80">Uptime</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <div className="text-2xl md:text-3xl font-bold">24/7</div>
                        <div className="text-xs md:text-sm text-yellow-50/80">Support</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex md:flex-row flex-col justify-center items-center">
                    <Button asChild size="lg" variant="secondary" className="group relative overflow-hidden shadow-lg hover:shadow-xl transition-all">
                        <Link to="/signup" className="relative z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6 inline-block mr-2 group-hover:translate-x-1 transition-transform">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                            </svg>
                            Get Started Free
                        </Link>
                    </Button>
                    <Button asChild variant="link" size="lg" className="text-yellow-50 hover:text-white">
                        <Link to="/pricing">
                          Pricing
                        </Link>
                    </Button>
                </div>

                {/* Trust indicators */}
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-sm text-yellow-50/70">
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        No credit card required
                    </span>
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Free 14-day trial
                    </span>
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Cancel anytime
                    </span>
                </div>
            </div>

            {/* Leaf-shaped SVG Divider - Theme aware */}
            <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
                <svg
                    viewBox="0 0 1200 120"
                    className="block w-full h-[60px] md:h-[120px]"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Main leaf shapes - light mode */}
                    <path
                        className="fill-white dark:fill-zinc-900 transition-colors duration-300"
                        d="M0,120 L0,80 Q100,20 200,80 Q300,20 400,80 Q500,20 600,80 Q700,20 800,80 Q900,20 1000,80 Q1100,20 1200,80 L1200,120 Z"
                    ></path>

                    {/* Overlapping leaf shapes with offset - light mode */}
                    <path
                        className="fill-yellow-50 dark:fill-zinc-800 transition-colors duration-300"
                        fillOpacity="0.6"
                        d="M0,120 L0,95 Q150,45 300,95 Q450,45 600,95 Q750,45 900,95 Q1050,45 1200,95 L1200,120 Z"
                    ></path>
                </svg>
            </div>
        </section>
    );
}
