'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import LandingPage from '@/components/LandingPage';
import { Loader2 } from 'lucide-react';

function HomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/admanager');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  return <LandingPage onLogin={() => signIn('google', { callbackUrl: '/admanager' })} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
