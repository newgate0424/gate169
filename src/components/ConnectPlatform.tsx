'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Twitter, Youtube, ShoppingBag, MessageCircle, Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

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
    const { t } = useLanguage();
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
            {
                scope: 'ads_read,read_insights,ads_management,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging',
                auth_type: 'rerequest',
                config_id: undefined,
                enable_profile_selector: true
            }
        );
    };

    const platforms = [
        { id: 'facebook', name: t('connect.facebook'), icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-100', desc: t('connect.facebookDesc') },
        { id: 'instagram', name: t('connect.instagram'), icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100', desc: t('connect.instagramDesc') },
        { id: 'line', name: t('connect.line'), icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100', desc: t('connect.lineDesc') },
    ];

    return (
        <Card className="w-full max-w-5xl mx-auto overflow-hidden flex flex-col md:flex-row min-h-[500px] md:h-[600px] shadow-2xl border-0 ring-1 ring-gray-200">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto p-3 md:p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3 md:mb-4 px-2 text-sm md:text-base">{t('connect.title')}</h3>
                {platforms.map((platform) => (
                    <button
                        key={platform.id}
                        onClick={() => setSelectedPlatform(platform.id)}
                        className={cn(
                            "w-full flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors",
                            selectedPlatform === platform.id
                                ? "bg-white shadow-sm text-gray-900"
                                : "text-gray-600 hover:bg-gray-100"
                        )}
                    >
                        <div className={cn("p-1 md:p-1.5 rounded-md flex-shrink-0", platform.bg)}>
                            <platform.icon className={cn("h-3 w-3 md:h-4 md:w-4", platform.color)} />
                        </div>
                        <span className="truncate">{platform.name}</span>
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-white">
                <div className="p-4 md:p-6 border-b border-gray-100">
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                        {platforms.find(p => p.id === selectedPlatform)?.name}
                    </h2>
                    <p className="text-xs md:text-sm text-gray-500 mt-1">
                        {platforms.find(p => p.id === selectedPlatform)?.desc}
                    </p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 text-center space-y-4 md:space-y-8">
                    {selectedPlatform === 'facebook' ? (
                        <>
                            <div className="flex items-center gap-4 md:gap-8">
                                {/* User Avatar */}
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 md:border-4 border-white shadow-lg flex-shrink-0">
                                    {user?.image ? (
                                        <img src={user.image} alt={user.name || 'User'} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xl md:text-2xl font-bold text-gray-400">{user?.name?.charAt(0) || 'U'}</span>
                                    )}
                                </div>

                                {/* Connection Icon */}
                                <div className="text-blue-500 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6">
                                        <path d="m16 3 4 4-4 4" />
                                        <path d="M20 7H4" />
                                        <path d="m8 21-4-4 4-4" />
                                        <path d="M4 17h16" />
                                    </svg>
                                </div>

                                {/* Facebook Icon */}
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-full flex items-center justify-center border-2 md:border-4 border-white shadow-lg flex-shrink-0">
                                    <Facebook className="h-8 w-8 md:h-10 md:w-10 text-white" />
                                </div>
                            </div>

                            <div className="space-y-2 max-w-md px-4">
                                <h3 className="text-base md:text-xl font-semibold text-gray-900">
                                    {t('connect.connectButton')} {user?.name || 'User'} {t('connect.facebook')}
                                </h3>
                                <p className="text-gray-500 text-xs md:text-sm">
                                    {t('connect.facebookDesc')}
                                </p>
                            </div>

                            <Button
                                onClick={handleLogin}
                                disabled={!isSdkLoaded}
                                className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white px-6 md:px-8 py-4 md:py-6 text-sm md:text-lg rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-105 w-full max-w-xs"
                            >
                                <Facebook className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                                {t('connect.connectButton')} {t('connect.facebook')}
                            </Button>
                        </>
                    ) : (
                        <div className="text-center space-y-3 md:space-y-4 px-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                                <Clock className="h-6 w-6 md:h-8 md:w-8 text-gray-400" />
                            </div>
                            <h3 className="text-base md:text-lg font-medium text-gray-900">{t('connect.comingSoon')}</h3>
                            <p className="text-gray-500 text-xs md:text-sm">
                                {platforms.find(p => p.id === selectedPlatform)?.name}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
