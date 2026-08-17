import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { Button } from "@repo/ui";
import { logoWhite } from "@repo/ui/assets";
import { LogOut, User, Building2 } from "lucide-react";
import { useAuth } from "../context/auth-context.jsx";

export default function NavigationBar() {
    const { user, isAuthenticated, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);

    const featureItems = [
        {
            href: "#qr-ordering",
            title: "QR Ordering",
            description: "Instant access to visual menus directly on smartphones.",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.75"></rect>
                    <path d="M3 9h18" strokeWidth="1.75"></path>
                </svg>
            )
        },
        {
            href: "#kds",
            title: "Smart KDS",
            description: "Automated order routing and prep timer management.",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
            )
        },
        {
            href: "#waiter-control",
            title: "Waiter Control",
            description: "Order gatekeeping and real-time serving alerts.",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.75"></rect>
                    <path d="M9 4v16" strokeWidth="1.75"></path>
                </svg>
            )
        },
        {
            href: "#operations",
            title: "Operations Control",
            description: "Real-time inventory sync and Multi-table architecture.",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5l13.732-13.732z" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
            )
        },
        {
            href: "#business",
            title: "Business & Revenue",
            description: "Smart AI upselling and real-time analytics dashboard.",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
            )
        },
        {
            href: "#setup",
            title: "Setup & Training",
            description: "Go live in under 24 hours with a simple onboarding process.",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
            )
        }
    ];

    return (
        <header className="w-full bg-zinc-50/5 border-b border-zinc-800">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                <Link to="/" className="flex flex-row items-start gap-2">
                    <img src={logoWhite} alt="Scan My Order" className="h-8" />
                    <div className="flex flex-col">
                        <span className="text-white">Scan My Order</span>
                        <span className="text-white/50 text-[8px] leading-1">It's better than paper</span>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8">
                    <div className="group relative">
                        <button className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-yellow-500 focus:outline-none transition-colors cursor-pointer">
                            Features
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180 text-zinc-400 group-hover:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>

                        <div className="absolute top-14 left-1/2 translate-x-[-42%] w-max opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out z-50">
                            <div className="bg-zinc-900/95 backdrop-blur-3xl rounded-2xl shadow-2xl shadow-black/50 border border-zinc-800 p-6 flex gap-8">
                                <div className="flex flex-col gap-5 w-65 pr-6 border-r border-zinc-800">
                                    {featureItems.slice(0, 3).map((item) => (
                                        <a key={item.href} href={item.href} className="flex items-start gap-3.5 group/item p-2 rounded-xl hover:bg-zinc-800/50 transition-colors">
                                            <div className="text-yellow-500 bg-yellow-500/10 p-2 rounded-lg mt-0.5 group-hover:bg-yellow-500/20 transition-colors">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-zinc-200 group-hover/item:text-yellow-500 transition-colors">{item.title}</h4>
                                                <p className="text-[13px] text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-5 w-65">
                                    {featureItems.slice(3).map((item) => (
                                        <a key={item.href} href={item.href} className="flex items-start gap-3.5 group/item p-2 rounded-xl hover:bg-zinc-800/50 transition-colors">
                                            <div className="text-yellow-500 bg-yellow-500/10 p-2 rounded-lg mt-0.5 group-hover:bg-yellow-500/20 transition-colors">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-zinc-200 group-hover/item:text-yellow-500 transition-colors">{item.title}</h4>
                                                <p className="text-[13px] text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>

                                <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl p-6 text-white w-70 flex flex-col justify-between shadow-inner relative overflow-hidden border border-zinc-700/50">
                                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="bg-yellow-500/20 text-yellow-400 text-[11px] font-bold tracking-wider px-3 py-1 rounded-full uppercase shadow-xs border border-yellow-500/30">
                                                Tatkal Mode
                                            </span>
                                        </div>
                                        <h3 className="text-base font-bold leading-snug text-zinc-100">
                                            Turn peak-hour chaos into a synchronized, first-come-first-served flow.
                                        </h3>
                                    </div>

                                    <div className="mt-6 relative z-10">
                                        <div className="text-3xl font-extrabold text-yellow-400 tracking-tight">40%</div>
                                        <p className="text-zinc-400 text-xs mt-0.5 font-medium">Faster table turnover with us.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Link to="/#why-us" className="text-sm text-zinc-100/50 hover:text-yellow-600 transition-colors">Why Us</Link>
                    <Link to="/#setup" className="text-sm text-zinc-100/50 hover:text-yellow-600 transition-colors">Setup</Link>
                    <Link to="/#pricing" className="text-sm text-zinc-100/50 hover:text-yellow-600 transition-colors">Pricing</Link>
                    <Link to="/#faq" className="text-sm text-zinc-100/50 hover:text-yellow-600 transition-colors">FAQ</Link>
                </div>

                {/* Desktop Auth Buttons */}
                {isAuthenticated ? (
                    <div className="hidden md:flex items-center gap-3">
                        <Link to="/onboarding" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-700/80 text-xs font-medium text-white hover:border-amber-500/50 transition-colors">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                                <User className="w-4 h-4 text-amber-400" />
                            )}
                            <span className="max-w-[120px] truncate">{user?.name || user?.email || "Dashboard"}</span>
                        </Link>
                        <Button
                            variant="ghost"
                            onClick={logout}
                            className="text-xs text-zinc-400 hover:text-red-400 gap-1.5 px-3 cursor-pointer"
                            title="Logout of account"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Logout</span>
                        </Button>
                    </div>
                ) : (
                    <div className="hidden md:flex items-center gap-2">
                        <Link to="/authentication">
                            <Button variant="ghost">Authenticate</Button>
                        </Link>
                        <Link to="/authentication">
                            <Button>Get Started</Button>
                        </Link>
                    </div>
                )}

                {/* Mobile Hamburger Menu */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden text-zinc-400 hover:text-yellow-500 focus:outline-none transition-colors"
                >
                    {isMobileMenuOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>

                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-zinc-900/95 backdrop-blur-3xl border-t border-zinc-800">
                    <div className="container mx-auto px-4 py-4 flex flex-col gap-4 max-h-[calc(100vh-80px)] overflow-y-auto">
                        {/* Features Dropdown */}
                        <div>
                            <button
                                onClick={() => setIsFeaturesOpen(!isFeaturesOpen)}
                                className="w-full flex items-center justify-between text-sm text-zinc-400 hover:text-yellow-500 transition-colors py-2"
                            >
                                <span>Features</span>
                                <svg className={`w-4 h-4 transition-transform duration-200 ${isFeaturesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>

                            {isFeaturesOpen && (
                                <div className="flex flex-col gap-2 mt-2 pl-2">
                                    {featureItems.map((item) => (
                                        <a
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex items-start gap-3 group/item p-2 rounded-xl hover:bg-zinc-800/50 transition-colors"
                                        >
                                            <div className="text-yellow-500 bg-yellow-500/10 p-2 rounded-lg mt-0.5 group-hover:bg-yellow-500/20 transition-colors shrink-0">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-zinc-200 group-hover/item:text-yellow-500 transition-colors">{item.title}</h4>
                                                <p className="text-[13px] text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Mobile Navigation Links */}
                        <Link to="/#why-us" onClick={() => setIsMobileMenuOpen(false)} className="text-sm text-zinc-400 hover:text-yellow-500 transition-colors py-2">Why Us</Link>
                        <Link to="/#setup" onClick={() => setIsMobileMenuOpen(false)} className="text-sm text-zinc-400 hover:text-yellow-500 transition-colors py-2">Setup</Link>
                        <Link to="/#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-sm text-zinc-400 hover:text-yellow-500 transition-colors py-2">Pricing</Link>
                        <Link to="/#faq" onClick={() => setIsMobileMenuOpen(false)} className="text-sm text-zinc-400 hover:text-yellow-500 transition-colors py-2">FAQ</Link>
                        <Link to="/about" onClick={() => setIsMobileMenuOpen(false)} className="text-sm text-zinc-400 hover:text-yellow-500 transition-colors py-2">About Us</Link>

                        {/* Tatkal Mode Card */}
                        <div className="bg-linear-to-br from-zinc-800 to-zinc-900 rounded-xl p-4 text-white flex flex-col gap-3 shadow-inner relative overflow-hidden border border-zinc-700/50 mt-2">
                            <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl"></div>
                            <div className="relative z-10">
                                <span className="bg-yellow-500/20 text-yellow-400 text-[11px] font-bold tracking-wider px-3 py-1 rounded-full uppercase shadow-xs border border-yellow-500/30 inline-block">
                                    Tatkal Mode
                                </span>
                                <h3 className="text-sm font-bold leading-snug text-zinc-100 mt-3">
                                    Turn peak-hour chaos into a synchronized, first-come-first-served flow.
                                </h3>
                            </div>
                            <div className="relative z-10">
                                <div className="text-2xl font-extrabold text-yellow-400 tracking-tight">40%</div>
                                <p className="text-zinc-400 text-xs mt-0.5 font-medium">Faster table turnover with us.</p>
                            </div>
                        </div>

                        {/* Mobile Auth Buttons */}
                        <div className="flex flex-col gap-2 mt-2 pb-4 w-full">
                            {isAuthenticated ? (
                                <>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                                        <User className="w-4 h-4 text-amber-400 shrink-0" />
                                        <span className="truncate">{user?.email || user?.name}</span>
                                    </div>
                                    <Link to="/onboarding" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                                        <Button className="w-full justify-center gap-2">
                                            <Building2 className="w-4 h-4" /> Go to Onboarding
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            logout()
                                            setIsMobileMenuOpen(false)
                                        }}
                                        className="w-full justify-center text-red-400 hover:bg-red-500/10 gap-2 text-xs cursor-pointer"
                                    >
                                        <LogOut className="w-4 h-4" /> Logout
                                    </Button>
                                </>
                            ) : (
                                <div className="flex flex-row gap-2 w-full">
                                    <Link to="/authentication" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                                        <Button variant="ghost" className="w-full">Authenticate</Button>
                                    </Link>
                                    <Link to="/authentication" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                                        <Button className="w-full">Get Started</Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}