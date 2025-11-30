'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SyncSettingsPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to new Connect page
        router.push('/settings/connect');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <p className="text-gray-500">กำลังเปลี่ยนเส้นทาง...</p>
            </div>
        </div>
    );
}
