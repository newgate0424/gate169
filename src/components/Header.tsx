'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Globe, LogOut, Menu as MenuIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/contexts/LanguageContext';

interface HeaderProps {
    user?: {
        name?: string | null;
        image?: string | null;
    };
    onLogout: () => void;
    onToggleSidebar?: () => void;
}

export function Header({ user, onLogout, onToggleSidebar }: HeaderProps) {
    const { language, setLanguage, t } = useLanguage();

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-full">
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Logo */}
                    <Link href={user ? "/overview" : "/"} className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white p-1 rounded-md">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-5 w-5 md:h-6 md:w-6"
                            >
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="text-lg md:text-xl font-bold text-blue-500">GATE169</span>
                    </Link>
                </div>

                {/* Navigation - Hidden on mobile */}
                {user ? (
                    <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-sm font-medium text-gray-600">
                        <Link href="/overview" className="hover:text-blue-500 flex items-center gap-2">
                            {t('header.overview')}
                        </Link>
                        <Link href="/adbox" className="hover:text-blue-500 flex items-center gap-2">
                            {t('header.adbox')}
                        </Link>
                        <Link href="/admanager" className="hover:text-blue-500 flex items-center gap-2">
                            {t('header.admanager')}
                        </Link>
                        <Link href="/settings/permissions" className="hover:text-blue-500 flex items-center gap-2">
                            {t('header.settings')}
                        </Link>
                    </nav>
                ) : (
                    <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-gray-600">
                        <Link href="#" className="hover:text-blue-500">Features</Link>
                        <Link href="#" className="hover:text-blue-500">Solution</Link>
                        <Link href="#" className="hover:text-blue-500 hidden lg:inline">What is Gate?</Link>
                        <Link href="#" className="hover:text-blue-500">Pricing</Link>
                    </nav>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Language Switcher */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-600">
                                <Globe className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => setLanguage('th')}
                                className={language === 'th' ? 'bg-blue-50' : ''}
                            >
                                🇹🇭 ภาษาไทย
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setLanguage('en')}
                                className={language === 'en' ? 'bg-blue-50' : ''}
                            >
                                🇬🇧 English
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user.image || ''} alt={user.name || ''} />
                                        <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user.name}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={onLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>{t('header.logout')}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <>
                            <Button variant="ghost" className="text-blue-500 hover:text-blue-600 hover:bg-transparent hidden md:inline-flex">
                                Register
                            </Button>
                            <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 md:px-6">
                                Login
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
