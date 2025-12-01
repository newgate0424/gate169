'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Facebook, CheckCircle2, Loader2, MessageCircle, TrendingUp, Zap } from 'lucide-react';
import { saveFacebookToken } from '@/app/actions';

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export default function ConnectPage() {
    const { data: session, update } = useSession();
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // @ts-ignore
    const hasPageToken = !!session?.user?.facebookPageToken;
    // @ts-ignore
    const hasAdToken = !!session?.user?.facebookAdToken;
    const isConnected = hasPageToken || hasAdToken;

    // Load Facebook SDK
    useEffect(() => {
        console.log('[Facebook SDK] Checking if SDK is loaded...');
        console.log('[Facebook SDK] App ID:', process.env.NEXT_PUBLIC_FACEBOOK_APP_ID);
        
        if (window.FB) {
            console.log('[Facebook SDK] Already loaded');
            setIsSdkLoaded(true);
            return;
        }

        window.fbAsyncInit = function () {
            console.log('[Facebook SDK] Initializing...');
            window.FB.init({
                appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
                cookie: true,
                xfbml: true,
                version: 'v21.0',
            });
            console.log('[Facebook SDK] Initialized successfully');
            setIsSdkLoaded(true);
        };

        (function (d, s, id) {
            var js: any,
                fjs: any = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {
                console.log('[Facebook SDK] Script already exists');
                return;
            }
            js = d.createElement(s);
            js.id = id;
            js.src = 'https://connect.facebook.net/en_US/sdk.js';
            js.onerror = function() {
                console.error('[Facebook SDK] Failed to load script');
            };
            js.onload = function() {
                console.log('[Facebook SDK] Script loaded');
            };
            fjs.parentNode.insertBefore(js, fjs);
        })(document, 'script', 'facebook-jssdk');
    }, []);

    const handleConnect = () => {
        console.log('[Connect Facebook] Starting...');
        console.log('[Connect Facebook] SDK loaded:', isSdkLoaded);
        console.log('[Connect Facebook] FB object:', !!window.FB);
        
        if (!window.FB || !isSdkLoaded) {
            alert('Facebook SDK ยังไม่โหลด กรุณารอสักครู่แล้วลองใหม่');
            return;
        }

        setIsConnecting(true);

        // Combined scopes for both Pages and Ads
        const allScopes = [
            // Page permissions (AdBox)
            'pages_show_list',
            'pages_read_engagement',
            'pages_manage_metadata',
            'pages_messaging',
            'pages_read_user_content',
            // Ad permissions (AdManager)
            'ads_read',
            'ads_management',
            'read_insights',
            'business_management'
        ].join(',');

        window.FB.login(
            function (response: any) {
                console.log('[Connect Facebook] FB.login response:', response);
                if (response.authResponse) {
                    console.log('[Connect Facebook] Got access token, saving...');
                    saveFacebookToken(response.authResponse.accessToken)
                        .then(() => {
                            console.log('[Connect Facebook] Token saved successfully');
                            update();
                            window.location.reload();
                        })
                        .catch((error) => {
                            console.error('Failed to save token:', error);
                            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
                            setIsConnecting(false);
                        });
                } else {
                    console.log('[Connect Facebook] No authResponse, user cancelled or error');
                    console.log('[Connect Facebook] Status:', response.status);
                    if (response.status === 'unknown') {
                        alert('ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบ:\n1. Pop-up blocker\n2. Facebook App settings\n3. ลองล็อกเอาท์แล้วล็อกอินใหม่');
                    }
                    setIsConnecting(false);
                }
            },
            {
                scope: allScopes,
                auth_type: 'rerequest',
                enable_profile_selector: true
            }
        );
    };

    const handleDisconnect = async () => {
        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการตัดการเชื่อมต่อ Facebook?\nจะตัดการเชื่อมต่อทั้ง AdBox และ Ad Manager')) {
            return;
        }

        setIsDisconnecting(true);

        try {
            // Disconnect both
            await Promise.all([
                fetch('/api/auth/disconnect-facebook-page', { method: 'POST' }),
                fetch('/api/auth/disconnect-facebook-ads', { method: 'POST' })
            ]);
            
            await update();
            window.location.reload();
        } catch (error) {
            console.error('Failed to disconnect:', error);
            alert('เกิดข้อผิดพลาดในการตัดการเชื่อมต่อ');
        } finally {
            setIsDisconnecting(false);
        }
    };

    return (
        <div className="flex flex-col h-full px-4 md:px-8 py-6 space-y-6">
            {/* Header */}
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">เชื่อมต่อ Facebook</h2>
                <p className="text-sm text-gray-500 mt-1">เชื่อมต่อ Facebook เพื่อใช้งาน AdBox และ Ad Manager</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden border rounded-xl shadow-sm bg-white">
                <div className="h-full overflow-y-auto p-8 space-y-8">

                    {/* Main Connection Card */}
                    <div className="max-w-2xl">
                        <div className={`p-8 border-2 rounded-2xl transition-all ${isConnected ? 'border-green-200 bg-green-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
                            <div className="flex items-start gap-6">
                                <div className={`h-20 w-20 rounded-2xl flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-green-100' : 'bg-blue-100'}`}>
                                    <Facebook className={`h-10 w-10 ${isConnected ? 'text-green-600' : 'text-blue-600'}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-2xl font-bold text-gray-900">Facebook</h3>
                                        {isConnected ? (
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-sm px-3 py-1">
                                                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                                เชื่อมต่อแล้ว
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-sm px-3 py-1">
                                                ยังไม่เชื่อมต่อ
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-gray-600 mb-4">
                                        {isConnected 
                                            ? 'บัญชี Facebook ของคุณเชื่อมต่อแล้ว สามารถใช้งานทุกฟีเจอร์ได้'
                                            : 'เชื่อมต่อ Facebook เพื่อใช้งาน AdBox และ Ad Manager'}
                                    </p>
                                    
                                    {isConnected ? (
                                        <Button
                                            variant="outline"
                                            onClick={handleDisconnect}
                                            disabled={isDisconnecting}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                        >
                                            {isDisconnecting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    กำลังตัดการเชื่อมต่อ...
                                                </>
                                            ) : (
                                                'ตัดการเชื่อมต่อ'
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="lg"
                                            onClick={handleConnect}
                                            disabled={isConnecting || !isSdkLoaded}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                    กำลังเชื่อมต่อ...
                                                </>
                                            ) : (
                                                <>
                                                    <Facebook className="h-5 w-5 mr-2" />
                                                    เชื่อมต่อ Facebook
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Features Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">ฟีเจอร์ที่จะได้รับ</h3>
                        
                        <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
                            {/* AdBox Feature */}
                            <div className={`p-5 border rounded-xl transition-all ${isConnected ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                        <MessageCircle className={`h-6 w-6 ${isConnected ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900">AdBox</h4>
                                            {isConnected && (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">จัดการข้อความ Messenger</p>
                                        <ul className="text-xs text-gray-500 space-y-0.5">
                                            <li>• อ่านและตอบกลับข้อความ</li>
                                            <li>• จัดการ conversations</li>
                                            <li>• ดูข้อมูล Page</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Ad Manager Feature */}
                            <div className={`p-5 border rounded-xl transition-all ${isConnected ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        <TrendingUp className={`h-6 w-6 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900">Ad Manager</h4>
                                            {isConnected && (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">จัดการโฆษณาและสถิติ</p>
                                        <ul className="text-xs text-gray-500 space-y-0.5">
                                            <li>• ดูข้อมูลโฆษณา</li>
                                            <li>• จัดการสถานะโฆษณา</li>
                                            <li>• ดู Insights และสถิติ</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-3xl">
                        <div className="flex items-start gap-3">
                            <Zap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-900 mb-1">เชื่อมต่อครั้งเดียว ใช้งานได้ทุกฟีเจอร์</h4>
                                <p className="text-sm text-blue-800">
                                    ระบบจะขอสิทธิ์ทั้งหมดที่จำเป็นในครั้งเดียว เพื่อให้คุณสามารถใช้งานทั้ง AdBox และ Ad Manager ได้อย่างสมบูรณ์
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
