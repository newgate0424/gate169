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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    if (status === 'loading') {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    if (!session) {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-[#F0F9FF] flex flex-col">
            <Header user={session.user} onLogout={() => signOut({ callbackUrl: '/' })} />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
                <main className="flex-1 overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
