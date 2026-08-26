import React from 'react';
import { BentoGrid, BentoGridItem } from '../components/bento-grid';
import { SoftCard } from '../components/soft-card';
import { Button } from '@smo/ui';
import { Link } from 'react-router-dom';
import WebThreads from '../components/web-threads';
import { BorderBeam } from 'border-beam';

export default function HomePage() {
    return (
        <section className="w-full flex flex-col items-center justify-center md:p-8 p-2">
            <BorderBeam size="md" colorVariant="colorful" strength={0.9} className="w-full relative">
                <div className="absolute inset-0 z-0">
                    <WebThreads
                    color1="#FACC15"
                    color2="#EAB308"
                    color3="#FFFFFF"
                    speed={2}
                    threadCount={3}
                    frequency={14}
                    spread={0.21}
                    taper={1}
                    position={0.5}
                    fanMode="center"
                    glow={0.034}
                    falloff={0.6}
                    thickness={0.8}
                    brightness={0.85}
                    opacity={1}
                    mirror
                    shimmer={false}
                    grain
                    grainIntensity={0}
                    mouseInteraction
                    mouseStrength={0.3}
                />
                </div>
                <div className="container mx-auto px-8 py-12 flex flex-col w-full h-full gap-8 relative z-20">
                    <h1 className="text-4xl md:text-8xl font-bold max-w-7xl">The only OS you need for your restaurant.</h1>
                    <p className="text-lg md:text-xl max-w-2xl">Streamline your restaurant operations with our all-in-one platform that connects your kitchen, bar, and front of house.</p>
                    <div className="flex md:flex-row flex-col gap-4">
                        <Button asChild size="lg">
                            <Link to="/signup">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                                </svg>

                                Get Started</Link>
                        </Button>
                        <Button asChild variant="link" size="lg">
                            <Link to="/login">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
                                </svg>

                                Authenticate to your account
                            </Link>
                        </Button>
                    </div>
                    <img src="https://cdn.dribbble.com/userupload/48030667/file/9c355e5f3b4fbef2eb8365a750260275.png?resize=1024x768&vertical=center" alt="Restaurant Dashboard" className="w-full h-full" />
                </div>
            </BorderBeam>
        </section>
    );
}
