'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Facebook, CheckCircle2, AlertCircle, Loader2, MessageCircle, TrendingUp } from 'lucide-react';
import { saveFacebookPageToken, saveFacebookAdToken } from '@/app/actions';

declare global {
    interface Window {
        FB: any;
        fbAsyncInit: () => void;
    }
}

export default function ConnectPage() {
    const { data: session, update } = useSession();
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isConnectingPage, setIsConnectingPage] = useState(false);
    const [isConnectingAd, setIsConnectingAd] = useState(false);
    const [isDisconnectingPage, setIsDisconnectingPage] = useState(false);
    const [isDisconnectingAd, setIsDisconnectingAd] = useState(false);

    // @ts-ignore
    const hasPageToken = !!session?.user?.facebookPageToken;
    // @ts-ignore
    const hasAdToken = !!session?.user?.facebookAdToken;

    // Load Facebook SDK
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

    const handleConnectPage = () => {
        if (!window.FB || !isSdkLoaded) {
            alert('Facebook SDK ยังไม่โหลด กรุณารอสักครู่แล้วลองใหม่');
            return;
        }

        setIsConnectingPage(true);

        window.FB.login(
            function (response: any) {
                if (response.authResponse) {
                    saveFacebookPageToken(response.authResponse.accessToken)
                        .then(() => {
                            update();
                            window.location.reload();
                        })
                        .catch((error) => {
                            console.error('Failed to save Page token:', error);
                            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
                            setIsConnectingPage(false);
                        });
                } else {
                    setIsConnectingPage(false);
                }
            },
            {
                scope: 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,pages_read_user_content',
                auth_type: 'rerequest',
                enable_profile_selector: true
            }
        );
    };

    const handleConnectAd = () => {
        if (!window.FB || !isSdkLoaded) {
            alert('Facebook SDK ยังไม่โหลด กรุณารอสักครู่แล้วลองใหม่');
            return;
        }

        setIsConnectingAd(true);

        window.FB.login(
            function (response: any) {
                if (response.authResponse) {
                    saveFacebookAdToken(response.authResponse.accessToken)
                        .then(() => {
                            update();
                            window.location.reload();
                        })
                        .catch((error) => {
                            console.error('Failed to save Ad token:', error);
                            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
                            setIsConnectingAd(false);
                        });
                } else {
                    setIsConnectingAd(false);
                }
            },
            {
                scope: 'ads_read,ads_management,read_insights,business_management',
                auth_type: 'rerequest',
            }
        );
    };

    const handleDisconnectPage = async () => {
        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการตัดการเชื่อมต่อ Facebook Pages?')) {
            return;
        }

        setIsDisconnectingPage(true);

        try {
            const response = await fetch('/api/auth/disconnect-facebook-page', {
                method: 'POST',
            });

            if (response.ok) {
                await update();
                window.location.reload();
            } else {
                throw new Error('Failed to disconnect');
            }
        } catch (error) {
            console.error('Failed to disconnect:', error);
            alert('เกิดข้อผิดพลาดในการตัดการเชื่อมต่อ');
        } finally {
            setIsDisconnectingPage(false);
        }
    };

    const handleDisconnectAd = async () => {
        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการตัดการเชื่อมต่อ Ad Manager?')) {
            return;
        }

        setIsDisconnectingAd(true);

        try {
            const response = await fetch('/api/auth/disconnect-facebook-ads', {
                method: 'POST',
            });

            if (response.ok) {
                await update();
                window.location.reload();
            } else {
                throw new Error('Failed to disconnect');
            }
        } catch (error) {
            console.error('Failed to disconnect:', error);
            alert('เกิดข้อผิดพลาดในการตัดการเชื่อมต่อ');
        } finally {
            setIsDisconnectingAd(false);
        }
    };

    return (
        <div className="flex flex-col h-full px-4 md:px-8 py-6 space-y-6">
            {/* Header */}
            <div className="flex-shrink-0">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">เชื่อมต่อ Facebook</h2>
                <p className="text-sm text-gray-500 mt-1">จัดการการเชื่อมต่อกับ Facebook สำหรับ AdBox และ Ad Manager</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden border rounded-xl shadow-sm bg-white">
                <div className="h-full overflow-y-auto p-8 space-y-8">

                    {/* Connection Cards */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">การเชื่อมต่อ</h3>
                            <p className="text-sm text-gray-500">เชื่อมต่อ Facebook แยกตามฟีเจอร์ที่ใช้งาน</p>
                        </div>
                        <Separator />

                        <div className="grid gap-4 max-w-3xl">
                            {/* Facebook Pages Card */}
                            <div className="flex items-start justify-between p-6 border-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="h-14 w-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <MessageCircle className="h-7 w-7 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900 text-lg">Facebook Pages</h4>
                                            {hasPageToken ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Connected
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                                    Not Connected
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            สำหรับ <strong>AdBox</strong> - จัดการข้อความและ conversations
                                        </p>
                                        <div className="text-xs text-gray-500 space-y-0.5">
                                            <div>• อ่านและตอบกลับข้อความ</div>
                                            <div>• จัดการ conversations</div>
                                            <div>• ดูข้อมูล Page</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    {hasPageToken ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                            onClick={handleDisconnectPage}
                                            disabled={isDisconnectingPage}
                                        >
                                            {isDisconnectingPage ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    กำลังตัด...
                                                </>
                                            ) : (
                                                'ตัดการเชื่อมต่อ'
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={handleConnectPage}
                                            disabled={isConnectingPage || !isSdkLoaded}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {isConnectingPage ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    กำลังเชื่อมต่อ...
                                                </>
                                            ) : (
                                                'เชื่อมต่อ'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Ad Manager Card */}
                            <div className="flex items-start justify-between p-6 border-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <TrendingUp className="h-7 w-7 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900 text-lg">Ad Manager</h4>
                                            {hasAdToken ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Connected
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                                    Not Connected
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            สำหรับ <strong>Overview</strong> - จัดการโฆษณาและดูสถิติ
                                        </p>
                                        <div className="text-xs text-gray-500 space-y-0.5">
                                            <div>• ดูข้อมูลโฆษณา</div>
                                            <div>• จัดการสถานะโฆษณา (เปิด/ปิด)</div>
                                            <div>• ดู Insights และสถิติ</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    {hasAdToken ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                            onClick={handleDisconnectAd}
                                            disabled={isDisconnectingAd}
                                        >
                                            {isDisconnectingAd ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    กำลังตัด...
                                                </>
                                            ) : (
                                                'ตัดการเชื่อมต่อ'
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={handleConnectAd}
                                            disabled={isConnectingAd || !isSdkLoaded}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            {isConnectingAd ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    กำลังเชื่อมต่อ...
                                                </>
                                            ) : (
                                                'เชื่อมต่อ'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">ℹ️ ทำไมต้องแยกการเชื่อมต่อ?</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• <strong>ประหยัด API</strong> - ขอเฉพาะ permission ที่จำเป็น</li>
                            <li>• <strong>ปลอดภัยกว่า</strong> - แยก scope ตามหน้าที่การใช้งาน</li>
                            <li>• <strong>ยืดหยุ่น</strong> - เชื่อมต่อเฉพาะฟีเจอร์ที่ต้องการ</li>
                        </ul>
                    </div>

                </div>
            </div>
        </div>
    );
}
