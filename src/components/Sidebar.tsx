'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Settings,
    ChevronLeft,
    ChevronRight,
    Megaphone,
    Users,
    CreditCard,
    BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
    const pathname = usePathname();

    const menuItems = [
        {
            title: 'Overview',
            icon: LayoutDashboard,
            href: '/admanager',
        },
        {
            title: 'Assets',
            icon: Megaphone,
            href: '/assets',
        },
        {
            title: 'Campaigns',
            icon: BarChart3,
            href: '/admanager/campaigns',
        },
        {
            title: 'Audiences',
            icon: Users,
            href: '/admanager/audiences',
        },
        {
            title: 'Reports',
            icon: BarChart3,
            href: '/admanager/reports',
        },
        {
            title: 'Billing',
            icon: CreditCard,
            href: '/admanager/billing',
        },
        {
            title: 'Settings',
            icon: Settings,
            href: '/admanager/settings',
        },
    ];

    return (
        <div
            className={cn(
                "relative flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out h-[calc(100vh-4rem)]",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            <div className="flex items-center justify-end p-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-6 w-6 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-100"
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-3 w-3" />
                    ) : (
                        <ChevronLeft className="h-3 w-3" />
                    )}
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
                <nav className="grid gap-1 px-2">
                    {menuItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900",
                                    isActive ? "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700" : "text-gray-500",
                                    isCollapsed && "justify-center px-2"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", isActive ? "text-blue-600" : "text-gray-400")} />
                                {!isCollapsed && <span>{item.title}</span>}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
