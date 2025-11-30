import { useState, useEffect } from 'react';

interface AppSettings {
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => void;
    setSoundEnabled: (enabled: boolean) => void;
}

export function useAppSettings(): AppSettings {
    // Initialize with defaults, will be updated from localStorage on mount
    const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
    const [soundEnabled, setSoundEnabledState] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const storedNotifications = localStorage.getItem('notificationsEnabled');
                const storedSound = localStorage.getItem('soundEnabled');

                if (storedNotifications !== null) {
                    setNotificationsEnabledState(JSON.parse(storedNotifications));
                }
                if (storedSound !== null) {
                    setSoundEnabledState(JSON.parse(storedSound));
                }
            } catch (e) {
                console.warn('Failed to load app settings from localStorage', e);
            } finally {
                setIsInitialized(true);
            }
        }
    }, []);

    // Listen for storage events to sync across tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'notificationsEnabled' && e.newValue !== null) {
                setNotificationsEnabledState(JSON.parse(e.newValue));
            }
            if (e.key === 'soundEnabled' && e.newValue !== null) {
                setSoundEnabledState(JSON.parse(e.newValue));
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const setNotificationsEnabled = (enabled: boolean) => {
        setNotificationsEnabledState(enabled);
        if (typeof window !== 'undefined') {
            localStorage.setItem('notificationsEnabled', JSON.stringify(enabled));
            // Dispatch custom event for same-tab sync if needed, though React state handles this component-tree wise
            // if we used a context. Since this is a simple hook, multiple instances won't sync in the same tab 
            // automatically unless we use a Context or a custom event.
            // For now, we rely on the fact that settings page and adbox are likely separate or re-render on nav.
            // To be safe for same-tab updates across components, we can dispatch a storage event manually or use a custom event.
            window.dispatchEvent(new Event('storage'));
        }
    };

    const setSoundEnabled = (enabled: boolean) => {
        setSoundEnabledState(enabled);
        if (typeof window !== 'undefined') {
            localStorage.setItem('soundEnabled', JSON.stringify(enabled));
            window.dispatchEvent(new Event('storage'));
        }
    };

    return {
        notificationsEnabled,
        soundEnabled,
        setNotificationsEnabled,
        setSoundEnabled
    };
}
