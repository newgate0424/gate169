'use client';

import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConnectPlatform } from '@/components/ConnectPlatform';
import { Plus } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ConnectModalProps {
    onLogin: (accessToken: string) => void;
    user?: {
        name?: string | null;
        image?: string | null;
    };
}

export function ConnectModal({ onLogin, user }: ConnectModalProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Connect
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl p-0 border-0 bg-transparent shadow-none">
                <VisuallyHidden>
                    <DialogTitle>Connect Platform</DialogTitle>
                </VisuallyHidden>
                <ConnectPlatform onLogin={onLogin} user={user} />
            </DialogContent>
        </Dialog>
    );
}
