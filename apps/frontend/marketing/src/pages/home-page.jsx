import React from 'react';
import { BentoGrid, BentoGridItem } from '../components/bento-grid';
import { SoftCard } from '../components/soft-card';
import { Button } from '@smo/ui';
import { Link } from 'react-router-dom';
import WebThreads from '../components/web-threads';
import { BorderBeam } from 'border-beam';

export default function HomePage() {
    return (
        <>
        <section className="relative w-full flex flex-col items-center justify-center md:p-8 p-2 min-h-[89vh] overflow-hidden">

            <div className="container mx-auto px-4 md:px-8 py-12 flex flex-col w-full h-full gap-8 relative z-20">
                {/* Badge */}
                <div className="flex justify-center">
                    <span className="inline-flex items-center gap-2 dark:bg-yellow-100/20 bg-yellow-900/10 backdrop-blur-sm border dark:border-yellow-100/30 border-yellow-900/20 rounded-full px-4 py-2 text-sm font-medium">
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

                    <p className="text-lg md:text-xl max-w-2xl mx-auto opacity-60">
                        Manage and Arrange your restaurant operations with our all-in-one platform that connects your kitchen, bar, and front of house.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex md:flex-row flex-col justify-center items-center">
                    <Button asChild size="lg" variant="secondary" className="group relative overflow-hidden shadow-lg hover:shadow-xl transition-all">
                        <Link to="/signup" className="relative z-10">
                            Apply for onboarding
                        </Link>
                    </Button>
                    <Button asChild variant="link" size="lg">
                        <Link to="/pricing">
                          Pricing
                        </Link>
                    </Button>
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
        </>
    );
}
