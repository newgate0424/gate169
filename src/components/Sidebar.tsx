'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    MessageCircle,
    Settings,
    Users,
    CreditCard,
    BarChart3,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
    const pathname = usePathname();
    const { t } = useLanguage();

    const menuItems = [
        {
            title: t('sidebar.overview'),
            icon: LayoutDashboard,
            href: '/overview',
        },
        {
            title: t('sidebar.adbox'),
            icon: MessageCircle,
            href: '/adbox',
        },
        {
            title: t('sidebar.admanager'),
            icon: BarChart3,
            href: '/admanager',
        },
        {
            title: t('sidebar.audiences'),
            icon: Users,
            href: '/admanager/audiences',
        },
        {
            title: t('sidebar.reports'),
            icon: BarChart3,
            href: '/admanager/reports',
        },
        {
            title: t('sidebar.billing'),
            icon: CreditCard,
            href: '/admanager/billing',
        },
        {
            title: t('sidebar.settings'),
            icon: Settings,
            href: '/settings/permissions',
        },
    ];

    return (
        <div
            className={cn(
                "flex flex-col bg-white transition-all duration-300 ease-in-out h-full border-r border-gray-200 z-10 flex-shrink-0",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            <nav className="flex-1 overflow-y-auto py-6">
                <ul className="space-y-2 px-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 p-2 rounded-xl transition-all duration-200 group relative",
                                        isCollapsed ? "justify-center flex-col gap-1" : "px-4 py-3",
                                        isActive
                                            ? "bg-blue-50 text-blue-600"
                                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                    )}
                                    title={isCollapsed ? item.title : undefined}
                                >
                                    <Icon className={cn("flex-shrink-0", isCollapsed ? "h-5 w-5" : "h-5 w-5", isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-900")} />
                                    {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.title}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={toggleSidebar}
                    className={cn(
                        "flex items-center justify-center w-full p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors",
                        isCollapsed ? "" : "gap-2"
                    )}
                >
                    {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                    {!isCollapsed && <span className="text-sm font-medium">Collapse Sidebar</span>}
                </button>
            </div>
        </div>
    );
}
