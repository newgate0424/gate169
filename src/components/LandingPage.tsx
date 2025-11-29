'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart2, Zap, Shield, CheckCircle } from 'lucide-react';

interface LandingPageProps {
    onLogin: (token: string) => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            {/* Header/Nav */}
            <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center max-w-7xl mx-auto w-full z-10">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white p-2 rounded-lg">
                        <Zap className="h-6 w-6" fill="currentColor" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 tracking-tight">GATE169</span>
                </div>
                <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-600 items-center">
                    <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
                    <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
                    <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
                </nav>
                <div className="flex items-center gap-4">
                    <Link href="/login">
                        <Button
                            variant="ghost"
                            className="text-gray-600 hover:text-blue-600 font-medium"
                        >
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 shadow-lg shadow-blue-200"
                        >
                            Get Started
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="text-center max-w-4xl mx-auto space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-100">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        New: Advanced Video Metrics
                    </div>

                    <h1 className="text-5xl sm:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
                        Master Your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500">
                            Facebook Ads
                        </span>
                    </h1>

                    <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        Simplify your ad management with powerful analytics, real-time insights, and automated optimization tools designed for growth.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        <Link href="/register">
                            <Button
                                className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 transition-all hover:scale-105"
                            >
                                Start Free Trial
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            className="h-14 px-8 text-lg border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                        >
                            View Demo
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8 justify-center pt-8 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span>14-day free trial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span>Cancel anytime</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Preview / Visual Element */}
                <div className="mt-20 relative mx-auto max-w-5xl">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20"></div>
                    <div className="relative bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden aspect-[16/9] flex items-center justify-center bg-gray-50">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                <BarChart2 className="h-10 w-10 text-blue-600" />
                            </div>
                            <p className="text-gray-400 font-medium">Dashboard Preview</p>
                        </div>
                    </div>
                </div>

                {/* Features Grid */}
                <div id="features" className="mt-32 grid md:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <BarChart2 className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Deep Analytics</h3>
                        <p className="text-gray-500 leading-relaxed">
                            Get granular insights into your ad performance with ROAS, CPM, and video engagement metrics.
                        </p>
                    </div>

                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Zap className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Real-time Optimization</h3>
                        <p className="text-gray-500 leading-relaxed">
                            Make data-driven decisions instantly with our real-time dashboard and reporting tools.
                        </p>
                    </div>

                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-6 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            <Shield className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Reliable</h3>
                        <p className="text-gray-500 leading-relaxed">
                            Enterprise-grade security ensures your data and ad accounts are always protected.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-md">
                            <Zap className="h-4 w-4 text-white" fill="currentColor" />
                        </div>
                        <span className="font-bold text-gray-900 text-lg">GATE169</span>
                    </div>
                    <div className="text-sm text-gray-500">
                        © 2024 GATE169. All rights reserved.
                    </div>
                    <div className="flex gap-8 text-sm font-medium text-gray-500">
                        <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-blue-600 transition-colors">Cookie Policy</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
