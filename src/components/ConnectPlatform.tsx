'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Twitter, Youtube, ShoppingBag, MessageCircle, Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface ConnectPlatformProps {
    onLogin: (accessToken: string) => void;
    user?: {
        name?: string | null;
        image?: string | null;
    };
}

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export function ConnectPlatform({ onLogin, user }: ConnectPlatformProps) {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState('facebook');

    useEffect(() => {
        if (window.FB) {
            setIsSdkLoaded(true);
            return;
        }

        window.fbAsyncInit = function () {
            window.FB.init({
                appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
                cookie: true,
                xfbml: true,
                version: 'v18.0',
            });
            setIsSdkLoaded(true);
        };

        (function (d, s, id) {
            var js: any,
                fjs: any = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s);
            js.id = id;
            js.src = 'https://connect.facebook.net/en_US/sdk.js';
            fjs.parentNode.insertBefore(js, fjs);
        })(document, 'script', 'facebook-jssdk');
    }, []);

    const handleLogin = () => {
        if (!window.FB) return;

        window.FB.login(
            function (response: any) {
                if (response.authResponse) {
                    onLogin(response.authResponse.accessToken);
                } else {
                    console.log('User cancelled login or did not fully authorize.');
                }
            },
            { scope: 'ads_read,read_insights,ads_management,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging' }
        );
    };

    const platforms = [
        { id: 'pending', name: 'Pending Activation', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
        { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-100' },
        { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100' },
        { id: 'threads', name: 'Threads', icon: Globe, color: 'text-black', bg: 'bg-gray-100' },
        { id: 'tiktok', name: 'TikTok', icon: MessageCircle, color: 'text-black', bg: 'bg-gray-100' },
        { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-100' },
        { id: 'telegram', name: 'Telegram', icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-50' },
        { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-600', bg: 'bg-red-100' },
        { id: 'shopee', name: 'Shopee', icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-100' },
        { id: 'line', name: 'Line', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100' },
    ];

    return (
        <Card className="w-full max-w-5xl mx-auto overflow-hidden flex flex-col md:flex-row h-[600px] shadow-2xl border-0 ring-1 ring-gray-200">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-4 px-2">Add Connection</h3>
                {platforms.map((platform) => (
                    <button
                        key={platform.id}
                        onClick={() => setSelectedPlatform(platform.id)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            selectedPlatform === platform.id
                                ? "bg-white shadow-sm text-gray-900"
                                : "text-gray-600 hover:bg-gray-100"
                        )}
                    >
                        <div className={cn("p-1.5 rounded-md", platform.bg)}>
                            <platform.icon className={cn("h-4 w-4", platform.color)} />
                        </div>
                        {platform.name}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Add {platforms.find(p => p.id === selectedPlatform)?.name} Account
                    </h2>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
                    {selectedPlatform === 'facebook' ? (
                        <>
                            <div className="flex items-center gap-8">
                                {/* User Avatar Placeholder */}
                                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                                    {user?.image ? (
                                        <img src={user.image} alt={user.name || 'User'} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl font-bold text-gray-400">{user?.name?.charAt(0) || 'U'}</span>
                                    )}
                                </div>

                                {/* Connection Icon */}
                                <div className="text-blue-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right-left"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>
                                </div>

                                {/* Facebook Icon */}
                                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                                    <Facebook className="h-10 w-10 text-white" />
                                </div>
                            </div>

                            <div className="space-y-2 max-w-md">
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Connect {user?.name || 'User'} with Facebook Page
                                </h3>
                                <p className="text-gray-500 text-sm">
                                    Use {user?.name || 'this account'} to unlock ad purchasing goals, messages, and increase Facebook ad efficiency automatically with CAPI.
                                </p>
                            </div>

                            <Button
                                onClick={handleLogin}
                                disabled={!isSdkLoaded}
                                className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-105"
                            >
                                <Facebook className="mr-2 h-5 w-5" />
                                Connect Facebook
                            </Button>

                            <a href="#" className="text-xs text-blue-600 hover:underline">
                                Learn how to connect
                            </a>
                        </>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                                <Clock className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Coming Soon</h3>
                            <p className="text-gray-500">Integration for {platforms.find(p => p.id === selectedPlatform)?.name} is currently under development.</p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
