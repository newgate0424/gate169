'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { useSession, signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdManagerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session, status } = useSession();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    if (status === 'loading') {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    if (!session) {
        redirect('/');
    }

    return (
        <div className="h-screen bg-[#F0F9FF] flex flex-col overflow-hidden">
            <Header
                user={session.user}
                onLogout={() => signOut({ callbackUrl: '/' })}
                onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Sidebar Overlay */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div
                            className="absolute inset-0 bg-black/50 transition-opacity"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl animate-in slide-in-from-left duration-300 z-50">
                            <Sidebar
                                isCollapsed={false}
                                toggleSidebar={() => setIsMobileMenuOpen(false)}
                                isMobile={true}
                                onCloseMobile={() => setIsMobileMenuOpen(false)}
                            />
                        </div>
                    </div>
                )}

                {/* Desktop Sidebar */}
                <div className="hidden md:block h-full">
                    <Sidebar
                        isCollapsed={isSidebarCollapsed}
                        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    />
                </div>

                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
