'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Monitor, RefreshCw, Cloud, Users, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const sidebarItems = [
    {
        title: 'การตั้งค่าทั่วไป',
        href: '/settings/general',
        icon: Settings
    },
    {
        title: 'หน่วยแสดงผล',
        href: '/settings/display',
        icon: Monitor
    },
    {
        title: 'ระบบการหมุนรอบแชท',
        href: '/settings/rotation',
        icon: RefreshCw
    },
    {
        title: 'ซิงค์',
        href: '/settings/sync',
        icon: Cloud
    },
    {
        title: 'การตั้งค่าสิทธิ์',
        href: '/settings/permissions',
        icon: Users
    }
];

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="h-full p-4 md:py-6 md:px-[300px] flex flex-row gap-4">
            {/* Settings Sidebar */}
            <Card className="w-[280px] flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden flex-shrink-0 p-0 gap-0">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">การตั้งค่า</h2>
                    <p className="text-sm text-gray-500 mt-1">จัดการการตั้งค่าระบบของคุณ</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {sidebarItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-blue-50 text-blue-600 shadow-sm"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                    isActive ? "bg-white" : "bg-gray-100 group-hover:bg-white"
                                )}>
                                    <Icon className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-gray-500")} />
                                </div>
                                {item.title}
                            </Link>
                        );
                    })}
                </div>
            </Card>

            {/* Content Area */}
            <Card className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border shadow-sm overflow-hidden p-0 gap-0">
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </Card>
        </div>
    );
}
