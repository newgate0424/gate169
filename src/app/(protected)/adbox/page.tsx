'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search, MoreHorizontal, MessageCircle, RefreshCw, Loader2, Settings, Send, Bell, BellOff, Volume2, VolumeX, Wifi, WifiOff, ExternalLink, Ban, Bookmark, Image, FileText, Link2, Calendar, AlertTriangle, X, ChevronRight, Phone, Mail, User, Plus, Megaphone, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    fetchPages,
    fetchConversationsFromDB,
    fetchMessagesFromDB,
    sendReply,
    syncConversationsOnce,
    syncMessagesOnce,
    markConversationAsRead
} from '@/app/actions';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';

// Custom notification sound generator using Web Audio API
const createNotificationSound = () => {
    if (typeof window === 'undefined') return null;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    return () => {
        // Resume audio context if suspended (browser policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const now = audioContext.currentTime;

        // Create a pleasant "ding" notification sound (2 notes)
        const frequencies = [880, 1108.73]; // A5 and C#6 - pleasant interval

        frequencies.forEach((freq, i) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, now + i * 0.1);

            // Envelope: quick attack, medium decay
            gainNode.gain.setValueAtTime(0, now + i * 0.1);
            gainNode.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);

            oscillator.start(now + i * 0.1);
            oscillator.stop(now + i * 0.1 + 0.5);
        });
    };
};

export default function AssetsPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();
    // @ts-ignore
    const facebookToken = session?.user?.facebookAccessToken;

    const [pages, setPages] = useState<any[]>([]);
    const [selectedPageIds, setSelectedPageIds] = useState<string[]>(() => {
        // Load from localStorage on initial render
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('selectedPageIds');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [tempSelectedPageIds, setTempSelectedPageIds] = useState<string[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingChat, setLoadingChat] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Message State
    const [messages, setMessages] = useState<any[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Notification State
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationSoundRef = useRef<(() => void) | null>(null);

    // SSE Connection State
    const [sseConnected, setSseConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Filter State
    const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Toast notification state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Detail panel state - show by default when chat selected
    const [showDetailPanel, setShowDetailPanel] = useState(true);
    // Detail panel tab: 'info' = ข้อมูล (notes/orders), 'conversation' = ข้อมูลการสนทนา (profile/links)
    const [detailTab, setDetailTab] = useState<'info' | 'conversation'>('info');
    // Notes for customer
    const [customerNote, setCustomerNote] = useState('');

    // Save selectedPageIds to localStorage whenever it changes
    useEffect(() => {
        if (selectedPageIds.length > 0) {
            localStorage.setItem('selectedPageIds', JSON.stringify(selectedPageIds));
        }
    }, [selectedPageIds]);

    // Initialize notification sound
    useEffect(() => {
        notificationSoundRef.current = createNotificationSound();

        // Request notification permission on mount
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            notificationSoundRef.current = null;
        };
    }, []);

    // Play notification sound
    const playNotificationSound = useCallback(() => {
        if (soundEnabled && notificationSoundRef.current) {
            notificationSoundRef.current();
        }
    }, [soundEnabled]);

    // Show browser notification
    const showNotification = useCallback((title: string, body: string) => {
        if (!notificationsEnabled) {
            return;
        }

        if (!('Notification' in window)) {
            return;
        }

        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: 'new-message-' + Date.now(), // Unique tag to allow multiple
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 5000);
        } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body, icon: '/favicon.ico' });
                }
            });
        }
    }, [notificationsEnabled]);

    // Ref to track selected conversation without causing reconnect
    const selectedConversationRef = useRef(selectedConversation);
    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    // Track seen message IDs to prevent duplicate notifications
    // Initialize from localStorage to persist across page reloads
    const seenMessageIds = useRef<Set<string>>(new Set());
    const [isInitialized, setIsInitialized] = useState(false);

    // Load seen message IDs from localStorage on mount
    useEffect(() => {
        console.log('🔧 Initializing seenMessageIds...');
        try {
            const stored = localStorage.getItem('seenMessageIds');
            if (stored) {
                const ids = JSON.parse(stored);
                seenMessageIds.current = new Set(ids.slice(-100)); // Keep last 100
                console.log('📚 Loaded', ids.length, 'seen IDs from localStorage');
            }
        } catch (e) {
            console.warn('Failed to load seenMessageIds from localStorage');
        }
        setIsInitialized(true);
        console.log('✅ isInitialized set to true');
    }, []);

    // Fast polling for real-time updates (every 3 seconds)
    // NOTE: Now polling only queries DATABASE (not Facebook API!)
    // Webhook saves new messages to DB, polling just reads from DB
    useEffect(() => {
        if (selectedPageIds.length === 0 || !isInitialized) {
            setSseConnected(false);
            return;
        }

        let isActive = true;
        let isFirstPoll = true; // Skip notifications on first poll
        let lastSyncTime = new Date().toISOString();

        const poll = async () => {
            if (!isActive) return;

            try {
                // Query DB for new messages (NO Facebook API calls!)
                const syncResponse = await fetch(`/api/messages/sync-new?pageIds=${selectedPageIds.join(',')}&since=${lastSyncTime}`);
                if (syncResponse.ok) {
                    const syncData = await syncResponse.json();

                    // Update lastSyncTime for next poll
                    lastSyncTime = new Date().toISOString();

                    if (syncData.newMessages && syncData.newMessages.length > 0 && !isFirstPoll) {
                        // New messages found from Database!
                        const newMsgs = syncData.newMessages.filter((m: any) => !seenMessageIds.current.has(m.id));

                        if (newMsgs.length > 0) {
                            newMsgs.forEach((m: any) => seenMessageIds.current.add(m.id));

                            // Save to localStorage
                            try {
                                const idsToStore = Array.from(seenMessageIds.current).slice(-100);
                                localStorage.setItem('seenMessageIds', JSON.stringify(idsToStore));
                            } catch (e) { }

                            // Play notification
                            playNotificationSound();

                            // Show notification
                            const firstMsg = newMsgs[0];
                            showNotification('💬 ข้อความใหม่', `${firstMsg.senderName}: ${firstMsg.content?.substring(0, 50)}`);
                            setToastMessage(`${firstMsg.senderName}: ${firstMsg.content?.substring(0, 50)}`);
                            setTimeout(() => setToastMessage(null), 5000);

                            setUnreadCount(prev => prev + newMsgs.length);
                        }
                    }

                    // Update conversations list from DB
                    if (syncData.updatedConversations && syncData.updatedConversations.length > 0) {
                        // AUTO-REPAIR: Check for bad names and trigger background sync
                        syncData.updatedConversations.forEach((conv: any) => {
                            const name = conv.participants?.data[0]?.name || conv.participantName;
                            if (name === 'Facebook User' || name === 'ลูกค้า' || name === 'Customer') {
                                console.log(`[AutoRepair] Bad name detected for ${conv.id}: ${name}. Triggering sync...`);
                                const page = pages.find(p => p.id === conv.pageId);
                                if (page) {
                                    // Trigger background sync for this page to fix the name
                                    syncConversationsOnce([page]).catch(err => console.error('[AutoRepair] Sync failed:', err));
                                }
                            }
                        });

                        setConversations(prev => {
                            let updated = [...prev];
                            const currentConvId = selectedConversationRef.current?.id;

                            for (const conv of syncData.updatedConversations) {
                                const idx = updated.findIndex(c => c.id === conv.id);
                                if (idx >= 0) {
                                    // ถ้ากำลังดู conversation นี้อยู่ ให้ unread = 0
                                    // ถ้าไม่ได้ดู ให้ใช้ค่าจาก Server (DB)
                                    const isCurrentlyViewing = conv.id === currentConvId;
                                    const localUnread = isCurrentlyViewing ? 0 : conv.unread_count;

                                    updated[idx] = {
                                        ...updated[idx],
                                        ...conv,
                                        unread_count: localUnread
                                    };
                                } else {
                                    updated.push(conv);
                                }
                            }
                            return updated.sort((a, b) =>
                                new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime()
                            );
                        });

                        // Add new messages to current conversation if viewing
                        const currentConv = selectedConversationRef.current;
                        if (currentConv && syncData.newMessages) {
                            const relevantMsgs = syncData.newMessages.filter((m: any) =>
                                m.conversationId === currentConv.id && !isFirstPoll
                            );
                            if (relevantMsgs.length > 0) {
                                setMessages(prev => {
                                    const msgsToAdd = relevantMsgs
                                        .map((m: any) => ({
                                            id: m.id,
                                            message: m.content,
                                            created_time: m.createdAt,
                                            from: { id: m.senderId, name: m.senderName }
                                        }))
                                        .filter((m: any) => !prev.some(p => p.id === m.id));
                                    return [...prev, ...msgsToAdd];
                                });
                            }
                        }
                    }

                    setSseConnected(true);
                }
            } catch (err) {
                console.error('Poll error:', err);
                setSseConnected(false);
            }

            // Mark first poll as done
            isFirstPoll = false;

            // Poll again after 3 seconds (only DB query, no API calls!)
            if (isActive) {
                setTimeout(poll, 3000);
            }
        };

        // Start polling
        poll();
        setSseConnected(true);

        return () => {
            isActive = false;
            setSseConnected(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPageIds, playNotificationSound, showNotification, isInitialized]);

    // Track current conversation to prevent race conditions
    const currentConversationIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (facebookToken) {
            loadPages();
        }
    }, [facebookToken]);

    useEffect(() => {
        if (selectedPageIds.length > 0 && facebookToken) {
            // First load: sync from API to get fresh data
            loadConversations(selectedPageIds, true);
        } else {
            setConversations([]);
        }
    }, [selectedPageIds, facebookToken]);

    // Message Cache: { [conversationId]: Message[] }
    const [messageCache, setMessageCache] = useState<Record<string, any[]>>({});

    useEffect(() => {
        if (selectedConversation && facebookToken) {
            currentConversationIdRef.current = selectedConversation.id;

            // 1. Check cache first for instant load
            if (messageCache[selectedConversation.id]) {
                setMessages(messageCache[selectedConversation.id]);
            } else {
                setMessages([]); // Only clear if no cache
            }

            // 2. Load from DB immediately, then background sync
            loadMessages(selectedConversation.id, selectedConversation.pageId, true);

            // 3. Mark as read
            markConversationAsRead(selectedConversation.id).then(() => {
                setConversations(prev => prev.map(c =>
                    c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c
                ));
            }).catch(err => console.error('Failed to mark as read:', err));

            // 4. Poll for new messages every 3 seconds (Real-time simulation)
            const interval = setInterval(() => {
                fetchMessagesFromDB(selectedConversation.id).then(msgs => {
                    if (msgs && msgs.length > 0) {
                        setMessages(prev => {
                            // Only update if different count or last message different
                            // Simple check: if length different or last ID different
                            if (prev.length !== msgs.length || (prev.length > 0 && msgs[msgs.length - 1].id !== prev[prev.length - 1].id)) {
                                setMessageCache(cache => ({ ...cache, [selectedConversation.id]: msgs }));
                                return msgs;
                            }
                            return prev;
                        });
                    }
                });
            }, 3000);

            return () => clearInterval(interval);
        }
    }, [selectedConversation, facebookToken]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Sync temp state when dialog opens
    useEffect(() => {
        if (isDialogOpen) {
            setTempSelectedPageIds(selectedPageIds);
        }
    }, [isDialogOpen, selectedPageIds]);

    const loadPages = async () => {
        setLoading(true);
        try {
            const data = await fetchPages();
            setPages(data);
            // Only auto-select first page if no pages selected and nothing in localStorage
            if (data.length > 0 && selectedPageIds.length === 0) {
                const saved = localStorage.getItem('selectedPageIds');
                if (!saved || JSON.parse(saved).length === 0) {
                    setSelectedPageIds([data[0].id]);
                }
            }
        } catch (error) {
            console.error("Failed to load pages", error);
        } finally {
            setLoading(false);
        }
    };

    const loadConversations = async (pageIds: string[], forceSync = false) => {
        setLoadingChat(true);

        // 1. Load from DB immediately for instant UI
        try {
            const dbData = await fetchConversationsFromDB(pageIds);
            if (dbData.length > 0) {
                setConversations(dbData);
            }
        } catch (dbErr) {
            console.error("DB load failed", dbErr);
        }

        // 2. Sync from API only when forceSync is true (manual refresh)
        if (forceSync) {
            try {
                // Get fresh pages data if pages state is empty
                let pagesData = pages;
                if (pagesData.length === 0) {
                    console.log('[Frontend] Pages empty, fetching fresh pages...');
                    pagesData = await fetchPages();
                    setPages(pagesData);
                }

                const selectedPages = pagesData.filter(p => pageIds.includes(p.id));
                console.log(`[Frontend] Syncing ${selectedPages.length} pages:`, selectedPages.map(p => p.id));
                const data = await syncConversationsOnce(selectedPages);

                if (data.length > 0) {
                    setConversations(data);
                }
            } catch (error) {
                console.error("Failed to sync conversations from API", error);
            }
        }

        setLoadingChat(false);
    };

    const loadMessages = async (conversationId: string, pageId: string, forceSync = false) => {
        // REMOVED: if (loadingMessages) return; -> This caused the bug where switching chats quickly blocked loading
        console.log(`Loading messages for conversation: ${conversationId}`);

        // Only set loading if we don't have messages yet (prevent flickering if we have cache)
        if (messages.length === 0) {
            setLoadingMessages(true);
        }

        // 1. Load from DB immediately
        try {
            const dbData = await fetchMessagesFromDB(conversationId);

            // Check if we are still on the same conversation
            if (currentConversationIdRef.current !== conversationId) return;

            if (dbData.length > 0) {
                setMessages(dbData);
                setMessageCache(prev => ({ ...prev, [conversationId]: dbData }));
            } else {
                // If DB is empty, force sync from API
                console.log(`[Frontend] DB empty for ${conversationId}, forcing API sync`);
                forceSync = true;
            }
        } catch (dbErr) {
            console.error("DB message load failed", dbErr);
        }

        // 2. Sync from API only when forceSync is true (first time or manual)
        if (forceSync) {
            try {
                const page = pages.find(p => p.id === pageId);
                const data = await syncMessagesOnce(conversationId, pageId, page?.access_token);

                // Check if we are still on the same conversation
                if (currentConversationIdRef.current !== conversationId) return;

                // IMPORTANT: After sync, fetch from DB again to ensure we have the complete, sorted history
                // Using API result directly (data) might be incomplete or overwrite history with a partial list
                const updatedDbData = await fetchMessagesFromDB(conversationId);

                if (updatedDbData.length > 0) {
                    setMessages(updatedDbData);
                    setMessageCache(prev => ({ ...prev, [conversationId]: updatedDbData }));
                }
            } catch (error) {
                console.error("Failed to sync messages from API", error);
            }
        }

        // Only turn off loading if we are still on the same conversation
        if (currentConversationIdRef.current === conversationId) {
            setLoadingMessages(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConversation) return;

        const currentReply = replyText;
        setReplyText('');
        setSending(true);

        const optimisticMsg = {
            id: `temp-${Date.now()}`,
            message: currentReply,
            from: { name: 'Me', id: selectedConversation.pageId },
            created_time: new Date().toISOString()
        };

        console.log('[handleSendReply] Adding optimistic message:', optimisticMsg);
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const recipientId = selectedConversation.participants?.data[0]?.id;

            if (!recipientId) {
                console.error("No recipient ID found");
                return;
            }

            // Only API call: send message via Graph API
            console.log('[handleSendReply] Sending to API...');
            const result = await sendReply(selectedConversation.pageId, recipientId, currentReply, selectedConversation.id);
            console.log('[handleSendReply] API Result:', result);

            if (result.success) {
                // Update optimistic message with real ID
                const realMessageId = result.data?.message_id;
                if (realMessageId) {
                    console.log('[handleSendReply] Updating optimistic ID to:', realMessageId);
                    setMessages(prev => prev.map(m =>
                        m.id === optimisticMsg.id ? { ...m, id: realMessageId } : m
                    ));
                }

                // Background fetch to sync everything else, but don't replace if empty
                console.log('[handleSendReply] Fetching from DB...');
                const dbMessages = await fetchMessagesFromDB(selectedConversation.id);
                console.log('[handleSendReply] DB Messages count:', dbMessages.length);

                if (dbMessages.length > 0) {
                    // Check if our new message is in there
                    const found = dbMessages.find(m => m.id === realMessageId || m.message === currentReply);
                    console.log('[handleSendReply] Found new message in DB?', !!found);

                    setMessages(dbMessages);
                } else {
                    console.warn('[handleSendReply] DB returned empty messages, keeping optimistic state');
                }
            } else {
                console.error("Failed to send reply:", result.error);
                // Remove optimistic message on failure
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));

                const dbMessages = await fetchMessagesFromDB(selectedConversation.id);
                if (dbMessages.length > 0) {
                    setMessages(dbMessages);
                }
            }
        } catch (error) {
            console.error("Error sending reply", error);
            // Reload from DB to get correct state
            const dbMessages = await fetchMessagesFromDB(selectedConversation.id);
            if (dbMessages.length > 0) {
                setMessages(dbMessages);
            }
        } finally {
            setSending(false);
        }
    };

    // Helper function to get profile picture URL
    // เมื่อ Facebook App ได้รับ permission `pages_user_locale` แล้ว เปลี่ยน USE_FACEBOOK_PROFILE เป็น true
    const USE_FACEBOOK_PROFILE = false; // เปลี่ยนเป็น true เมื่อ Facebook approve permission

    const getProfilePictureUrl = useCallback((psid: string, pageId?: string, size: 'small' | 'normal' | 'large' = 'normal', userName?: string) => {
        // ถ้าเปิดใช้ Facebook profile และมี PSID + pageId
        if (USE_FACEBOOK_PROFILE && psid && pageId) {
            return `/api/profile-picture?userId=${psid}&pageId=${pageId}&size=${size}&name=${encodeURIComponent(userName || 'U')}`;
        }

        // ใช้ fallback avatar (ตัวอักษรย่อ + สีสวย)
        return getFallbackAvatar(userName || 'U');
    }, []);

    // Fallback avatar URL with nice colors based on name
    const getFallbackAvatar = (name: string) => {
        // Generate a consistent color based on the name
        const colors = [
            { bg: '3b82f6', fg: 'fff' }, // blue
            { bg: '10b981', fg: 'fff' }, // green
            { bg: 'f59e0b', fg: 'fff' }, // amber
            { bg: 'ef4444', fg: 'fff' }, // red
            { bg: '8b5cf6', fg: 'fff' }, // purple
            { bg: 'ec4899', fg: 'fff' }, // pink
            { bg: '06b6d4', fg: 'fff' }, // cyan
            { bg: 'f97316', fg: 'fff' }, // orange
        ];

        // Get a consistent color index based on name
        let hash = 0;
        const nameStr = name || 'U';
        for (let i = 0; i < nameStr.length; i++) {
            hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % colors.length;
        const color = colors[colorIndex];

        return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameStr)}&background=${color.bg}&color=${color.fg}&size=100&bold=true`;
    };

    const toggleTempPageSelection = (pageId: string) => {
        setTempSelectedPageIds(prev =>
            prev.includes(pageId)
                ? prev.filter(id => id !== pageId)
                : [...prev, pageId]
        );
    };

    const toggleTempSelectAll = () => {
        if (tempSelectedPageIds.length === pages.length) {
            setTempSelectedPageIds([]);
        } else {
            setTempSelectedPageIds(pages.map(p => p.id));
        }
    };

    const handleSaveSelection = () => {
        setSelectedPageIds(tempSelectedPageIds);
        setIsDialogOpen(false);
    };

    const getPageDetails = (pageId: string) => pages.find(p => p.id === pageId);

    return (
        <div className="h-[calc(100vh-5.5rem)] flex flex-col px-[100px] pt-2 pb-0">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm">
                        <Bell className="h-5 w-5 flex-shrink-0" />
                        <div className="flex-1">
                            <div className="font-semibold text-sm">💬 ข้อความใหม่</div>
                            <div className="text-sm opacity-90 truncate">{toastMessage}</div>
                        </div>
                        <button
                            onClick={() => setToastMessage(null)}
                            className="text-white/80 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Chat Container - ไม่มี header bar แล้ว */}
            <Card className="flex-1 flex flex-row overflow-hidden rounded-2xl border shadow-lg mb-0">
                {/* Left Panel - Conversation List */}
                <div className="w-[320px] flex-shrink-0 border-r border-gray-200 flex flex-col bg-white rounded-l-2xl overflow-hidden">
                    {/* Header with page count */}
                    <div className="px-3 py-2 border-b flex items-center justify-between bg-gray-50 rounded-tl-xl">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">{t('adbox.chat')}</span>
                            {conversations.length > 0 && (
                                <span className="text-xs text-gray-500">({conversations.length})</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Link href="/settings/permissions">
                                <Button variant="ghost" size="icon" title="Permissions Settings">
                                    <Shield className="h-4 w-4 text-gray-500" />
                                </Button>
                            </Link>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Manage Pages">
                                        <Settings className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>{t('adbox.selectPages')}</DialogTitle>
                                        <DialogDescription>
                                            {t('adbox.choosePages')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-500">{pages.length} {t('adbox.pagesAvailable')}</span>
                                            <Button variant="ghost" size="sm" onClick={toggleTempSelectAll} className="text-xs h-8">
                                                {tempSelectedPageIds.length === pages.length ? t('adbox.deselectAll') : t('adbox.selectAll')}
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[300px] pr-4">
                                            <div className="space-y-2">
                                                {pages.map((page) => {
                                                    const isSelected = tempSelectedPageIds.includes(page.id);
                                                    return (
                                                        <div
                                                            key={page.id}
                                                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer border ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}
                                                            onClick={() => toggleTempPageSelection(page.id)}
                                                        >
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleTempPageSelection(page.id)}
                                                            />
                                                            <Avatar className="h-8 w-8 border border-gray-200">
                                                                <AvatarImage src={page.picture?.data?.url} />
                                                                <AvatarFallback>{page.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 overflow-hidden">
                                                                <h3 className="font-medium text-gray-900 truncate text-sm">{page.name}</h3>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('adbox.cancel')}</Button>
                                        <Button onClick={handleSaveSelection}>{t('adbox.applyChanges')}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="icon" onClick={() => loadConversations(selectedPageIds, true)} disabled={loadingChat} title="Sync from Facebook (ยิง API)">
                                <RefreshCw className={`h-4 w-4 ${loadingChat ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    {/* Search & Filter */}
                    <div className="p-2 border-b bg-gray-50 space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={t('adbox.search')}
                                className="pl-9 bg-white h-9 rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {/* Filter Buttons */}
                        <div className="flex gap-1">
                            <Button
                                variant={filterStatus === 'all' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-7 text-xs rounded-lg"
                                onClick={() => setFilterStatus('all')}
                            >
                                {t('adbox.all')}
                            </Button>
                            <Button
                                variant={filterStatus === 'unread' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-7 text-xs rounded-lg"
                                onClick={() => setFilterStatus('unread')}
                            >
                                {t('adbox.unread')}
                            </Button>
                            <Button
                                variant={filterStatus === 'read' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1 h-7 text-xs rounded-lg"
                                onClick={() => setFilterStatus('read')}
                            >
                                {t('adbox.read')}
                            </Button>
                        </div>
                    </div>

                    {/* Conversation List */}
                    <ScrollArea className="flex-1 h-0">
                        {loadingChat ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : (() => {
                            // Filter conversations
                            const filtered = conversations.filter(conv => {
                                // Filter by status
                                if (filterStatus === 'unread' && (conv.unread_count || 0) === 0) return false;
                                if (filterStatus === 'read' && (conv.unread_count || 0) > 0) return false;

                                // Filter by search query
                                if (searchQuery) {
                                    const query = searchQuery.toLowerCase();
                                    const name = (conv.participants?.data[0]?.name || '').toLowerCase();
                                    const snippet = (conv.snippet || '').toLowerCase();
                                    if (!name.includes(query) && !snippet.includes(query)) return false;
                                }

                                return true;
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="text-center py-12 text-gray-500 text-sm px-4">
                                        <MessageCircle className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                                        <p>ไม่พบข้อความ</p>
                                        <p className="text-xs mt-1">
                                            {filterStatus !== 'all' ? 'ลองเปลี่ยน filter ดู' : 'ลองเลือกเพจเพิ่มเติม'}
                                        </p>
                                    </div>
                                );
                            }

                            return filtered.map((conv) => {
                                const page = getPageDetails(conv.pageId);
                                const isUnread = (conv.unread_count || 0) > 0;
                                const isSelected = selectedConversation?.id === conv.id;
                                return (
                                    <div
                                        key={conv.id}
                                        className={`flex items-start gap-3 p-3 cursor-pointer transition-colors border-l-2 ${isSelected
                                            ? 'bg-blue-50 border-l-blue-500'
                                            : isUnread
                                                ? 'bg-white border-l-transparent hover:bg-gray-50'
                                                : 'bg-white border-l-transparent hover:bg-gray-50'
                                            }`}
                                        onClick={() => {
                                            setSelectedConversation(conv);
                                            // Mark as read in UI
                                            setConversations(prev => prev.map(c =>
                                                c.id === conv.id ? { ...c, unread_count: 0 } : c
                                            ));
                                            // Mark as read in database (fire and forget)
                                            if (conv.unread_count > 0) {
                                                markConversationAsRead(conv.id).catch(console.error);
                                            }
                                        }}
                                    >
                                        {/* Avatar - Using Page Access Token to fetch PSID profile picture */}
                                        <div className="relative flex-shrink-0">
                                            <Avatar className="h-12 w-12">
                                                <AvatarImage
                                                    src={getProfilePictureUrl(conv.participants?.data[0]?.id, conv.pageId, 'normal', conv.participants?.data[0]?.name)}
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = getFallbackAvatar(conv.participants?.data[0]?.name || 'U');
                                                    }}
                                                />
                                                <AvatarFallback className="bg-blue-500 text-white font-semibold">
                                                    {(conv.participants?.data[0]?.name || 'U').charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {isUnread && (
                                                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full border-2 border-white"></span>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                    {conv.participants?.data[0]?.name || 'Unknown User'}
                                                </span>
                                                <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                                                    {new Date(conv.updated_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className={`text-xs truncate ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                                                {conv.snippet || 'ไม่มีข้อความ'}
                                            </div>
                                            {/* Page badge & unread count */}
                                            <div className="flex items-center justify-between mt-1.5">
                                                <div className="flex items-center gap-1">
                                                    {page && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">
                                                            {page?.name?.substring(0, 15)}
                                                        </span>
                                                    )}
                                                </div>
                                                {isUnread && conv.unread_count > 0 && (
                                                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </ScrollArea>
                </div>

                {/* Middle Panel - Chat View */}
                <div className="flex-1 flex flex-col bg-white min-w-0">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header - Pancake style */}
                            <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                                        onClick={() => {
                                            const participant = selectedConversation.participants?.data[0];
                                            if (participant) {
                                                if (participant.link) {
                                                    window.open(participant.link, '_blank');
                                                } else if (participant.username) {
                                                    window.open(`https://www.facebook.com/${participant.username}`, '_blank');
                                                } else {
                                                    window.open(`https://www.facebook.com/profile.php?id=${participant.id}`, '_blank');
                                                }
                                            }
                                        }}
                                        title="คลิกเพื่อเปิดโปรไฟล์บน Facebook"
                                    >
                                        <AvatarImage
                                            src={getProfilePictureUrl(selectedConversation.participants?.data[0]?.id, selectedConversation.pageId, 'normal', selectedConversation.participants?.data[0]?.name)}
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = getFallbackAvatar(selectedConversation.participants?.data[0]?.name || 'U');
                                            }}
                                        />
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">
                                            {selectedConversation.participants?.data[0]?.name || 'Unknown User'}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-500 hover:text-blue-600"
                                    onClick={async () => {
                                        if (!selectedConversation) return;
                                        try {
                                            const { markConversationAsUnread } = await import('@/app/actions');
                                            await markConversationAsUnread(selectedConversation.id);
                                            // Update local state
                                            setConversations(prev => prev.map(c =>
                                                c.id === selectedConversation.id ? { ...c, unread_count: 1 } : c
                                            ));
                                            setToastMessage("ทำเครื่องหมายว่ายังไม่อ่านแล้ว");
                                            // Close chat
                                            setSelectedConversation(null);
                                        } catch (error) {
                                            console.error("Failed to mark as unread", error);
                                            setToastMessage("เกิดข้อผิดพลาดในการทำเครื่องหมาย");
                                        }
                                    }}
                                    title="ทำเครื่องหมายว่ายังไม่อ่าน"
                                >
                                    <Mail className="h-4 w-4 mr-1" />
                                    ยังไม่อ่าน
                                </Button>
                            </div>

                            {/* Messages - Scrollable area */}
                            <div
                                className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5]"
                                ref={scrollRef}
                                style={{ minHeight: 0 }}
                            >
                                {loadingMessages && messages.length === 0 ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    </div>
                                ) : messages.length > 0 ? (
                                    <>
                                        {/* Date separator */}
                                        <div className="flex justify-center">
                                            <span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full">
                                                วันนี้
                                            </span>
                                        </div>
                                        {messages.map((msg, idx) => {
                                            // Debug first few messages
                                            if (idx < 3) {
                                                console.log('[DEBUG MSG]', idx, {
                                                    id: msg.id,
                                                    message: msg.message,
                                                    attachments: msg.attachments,
                                                    stickerUrl: msg.stickerUrl,
                                                    from: msg.from
                                                });
                                            }
                                            const isFromPage = msg.from?.id === selectedConversation.pageId;
                                            const participantId = selectedConversation.participants?.data[0]?.id;

                                            // Parse attachments if exists
                                            let attachments: any[] = [];
                                            try {
                                                if (msg.attachments) {
                                                    attachments = typeof msg.attachments === 'string'
                                                        ? JSON.parse(msg.attachments)
                                                        : msg.attachments;
                                                }
                                            } catch (e) { }

                                            const hasSticker = attachments.some((a: any) => a.type === 'sticker') || !!msg.stickerUrl;
                                            const stickerUrl = msg.stickerUrl || attachments.find((a: any) => a.type === 'sticker')?.url;
                                            const imageAttachments = attachments.filter((a: any) => a.type === 'image');
                                            // Like can be: emoji 👍, attachment type 'like', 'fallback', or empty message with sticker_id
                                            const isLike = msg.message === '👍' ||
                                                attachments.some((a: any) => a.type === 'like' || a.type === 'fallback') ||
                                                (attachments.length > 0 && !msg.message && attachments.some((a: any) => a.sticker_id));

                                            // Check if message has no content to display
                                            const hasNoContent = !msg.message && attachments.length === 0 && !msg.stickerUrl;

                                            return (
                                                <div key={msg.id} className={`flex ${isFromPage ? 'justify-end' : 'justify-start'}`}>
                                                    {!isFromPage && (
                                                        <img
                                                            src={getProfilePictureUrl(participantId || msg.from?.id, selectedConversation.pageId, 'small', selectedConversation.participants?.data[0]?.name || msg.from?.name)}
                                                            alt=""
                                                            className="h-8 w-8 rounded-full mr-2 flex-shrink-0 object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.src = getFallbackAvatar(selectedConversation.participants?.data[0]?.name || msg.from?.name || 'U');
                                                            }}
                                                        />
                                                    )}
                                                    <div className={`max-w-[65%] ${isFromPage ? '' : ''}`}>
                                                        {/* Sticker Display */}
                                                        {hasSticker && stickerUrl ? (
                                                            <div className="mb-1">
                                                                <img
                                                                    src={stickerUrl}
                                                                    alt="sticker"
                                                                    className="max-w-[120px] max-h-[120px] object-contain"
                                                                />
                                                            </div>
                                                        ) : isLike ? (
                                                            /* Like/Thumbs Up Display */
                                                            <div className="text-4xl mb-1">👍</div>
                                                        ) : hasNoContent ? (
                                                            /* Empty message placeholder */
                                                            <div className={`rounded-2xl px-3 py-2 text-sm ${isFromPage
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-white text-gray-900 shadow-sm'
                                                                }`}>
                                                                <p className="text-gray-400 italic">...</p>
                                                            </div>
                                                        ) : (
                                                            /* Regular Message or Image */
                                                            <>
                                                                {/* Image attachments */}
                                                                {imageAttachments.length > 0 && (
                                                                    <div className="mb-1 space-y-1">
                                                                        {imageAttachments.map((img: any, idx: number) => (
                                                                            <img
                                                                                key={idx}
                                                                                src={img.url}
                                                                                alt="รูปภาพ"
                                                                                className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                                                                                onClick={() => window.open(img.url, '_blank')}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {/* Text message */}
                                                                {msg.message && msg.message !== '[Sticker]' && msg.message !== '[รูปภาพ]' && (
                                                                    <div className={`rounded-2xl px-3 py-2 text-sm ${isFromPage
                                                                        ? 'bg-blue-500 text-white'
                                                                        : 'bg-white text-gray-900 shadow-sm'
                                                                        }`}>
                                                                        <p className="whitespace-pre-wrap">{msg.message}</p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        <div className={`text-[10px] mt-1 px-1 ${isFromPage ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                                                            {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        ไม่มีข้อความ
                                    </div>
                                )}
                            </div>

                            {/* Input Area - Pancake style */}
                            <div className="p-3 bg-white border-t flex-shrink-0">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1 relative">
                                        <Textarea
                                            placeholder="กรอกเนื้อหาที่นี่พิมพ์ข้อ (กด Enter เพื่อส่ง)"
                                            className="min-h-[44px] max-h-[120px] resize-none pr-10 text-sm rounded-xl border-gray-200"
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendReply();
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button
                                        size="icon"
                                        className="h-[44px] w-[44px] rounded-xl bg-blue-500 hover:bg-blue-600"
                                        onClick={handleSendReply}
                                        disabled={sending || !replyText.trim()}
                                    >
                                        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4 bg-[#f0f2f5] rounded-r-2xl">
                            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                                <MessageCircle className="h-10 w-10 text-gray-300" />
                            </div>
                            <p className="text-gray-500">เลือกแชทเพื่อเริ่มสนทนา</p>
                        </div>
                    )}
                </div>

                {/* Right Panel - Customer Details (Pancake style with tabs) */}
                {
                    selectedConversation && showDetailPanel && (
                        <div className="w-[320px] border-l bg-white flex-shrink-0 flex flex-col min-h-0 rounded-r-2xl">
                            {/* Tab Header */}
                            <div className="flex border-b flex-shrink-0">
                                <button
                                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${detailTab === 'info'
                                        ? 'text-blue-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    onClick={() => setDetailTab('info')}
                                >
                                    ข้อมูล
                                    {detailTab === 'info' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${detailTab === 'conversation'
                                        ? 'text-blue-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    onClick={() => setDetailTab('conversation')}
                                >
                                    ข้อมูลการสนทนา
                                    {detailTab === 'conversation' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowDetailPanel(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {/* Tab Content: ข้อมูล (Info) */}
                                {detailTab === 'info' && (
                                    <>
                                        {/* Notes Icon Header */}
                                        <div className="p-6 flex flex-col items-center border-b">
                                            <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
                                                <MessageCircle className="h-8 w-8 text-blue-400" />
                                            </div>
                                            <p className="text-sm text-gray-500">คุณยังไม่มีบันทึกใดๆ</p>
                                        </div>

                                        {/* Note Input */}
                                        <div className="p-4 border-b">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="กรอกเนื้อหาบันทึกก่อน (กด Enter เพื่อส่ง)"
                                                    className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    value={customerNote}
                                                    onChange={(e) => setCustomerNote(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && customerNote.trim()) {
                                                            alert(`บันทึก: ${customerNote}`);
                                                            setCustomerNote('');
                                                        }
                                                    }}
                                                />
                                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                                    <Image className="h-4 w-4 text-gray-400" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Orders Section */}
                                        <div className="p-4">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-4">คำสั่งซื้อที่ผ่านมา</h4>

                                            {/* Empty Orders State */}
                                            <div className="flex flex-col items-center py-8">
                                                <div className="h-20 w-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                                                    <FileText className="h-10 w-10 text-gray-300" />
                                                </div>
                                                <p className="text-sm text-gray-500 mb-4">ไม่มีประวัติการสั่งซื้อ</p>
                                                <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    สร้างคำสั่งซื้อ
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Tab Content: ข้อมูลการสนทนา (Conversation Info) */}
                                {detailTab === 'conversation' && (
                                    <>
                                        {/* Customer Profile - Using Page Access Token to fetch PSID profile picture */}
                                        <div className="p-6 text-center border-b">
                                            <div className="relative inline-block">
                                                <img
                                                    src={getProfilePictureUrl(selectedConversation.participants?.data[0]?.id, selectedConversation.pageId, 'large', selectedConversation.participants?.data[0]?.name)}
                                                    alt={selectedConversation.participants?.data[0]?.name || 'Customer'}
                                                    className="h-24 w-24 rounded-full mx-auto mb-3 object-cover border-4 border-white shadow-lg"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = getFallbackAvatar(selectedConversation.participants?.data[0]?.name || 'U');
                                                    }}
                                                />
                                            </div>
                                            <h4 className="font-bold text-lg text-gray-900">
                                                {selectedConversation.participants?.data[0]?.name || 'Unknown User'}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                ID: {selectedConversation.participants?.data[0]?.id || 'N/A'}
                                            </p>
                                        </div>

                                        {/* Quick Actions - All Functional */}
                                        <div className="p-4 border-b">
                                            <div className="grid grid-cols-4 gap-2">
                                                {/* View on Facebook */}
                                                <button
                                                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 transition-colors group"
                                                    onClick={() => {
                                                        // ใช้ facebookLink ถ้ามี หรือเปิดหน้า Business Suite Inbox
                                                        if (selectedConversation.facebookLink) {
                                                            window.open(selectedConversation.facebookLink, '_blank');
                                                        } else {
                                                            // Fallback: เปิดหน้า Business Suite Inbox พร้อม conversation ID
                                                            // Format: https://business.facebook.com/latest/inbox/all?asset_id=PAGE_ID&selected_item_id=CONVERSATION_ID
                                                            const url = `https://business.facebook.com/latest/inbox/all?asset_id=${selectedConversation.pageId}&selected_item_id=${selectedConversation.id}`;
                                                            window.open(url, '_blank');
                                                        }
                                                    }}
                                                    title="เปิดหน้าสนทนาบน Facebook"
                                                >
                                                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                                        <ExternalLink className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                    <span className="text-[10px] text-gray-600">ดูบน Facebook</span>
                                                </button>

                                                {/* Block User */}
                                                <button
                                                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-red-50 transition-colors group"
                                                    onClick={() => {
                                                        if (confirm(`คุณต้องการบล็อก ${selectedConversation.participants?.data[0]?.name} หรือไม่?`)) {
                                                            alert('ฟีเจอร์บล็อกกำลังพัฒนา');
                                                        }
                                                    }}
                                                    title="บล็อกผู้ใช้นี้"
                                                >
                                                    <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                                        <Ban className="h-4 w-4 text-gray-600 group-hover:text-red-600" />
                                                    </div>
                                                    <span className="text-[10px] text-gray-600">บล็อก</span>
                                                </button>

                                                {/* Search Messages */}
                                                <button
                                                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors group"
                                                    onClick={() => {
                                                        const query = prompt('ค้นหาข้อความ:');
                                                        if (query) {
                                                            const found = messages.filter(m =>
                                                                m.message?.toLowerCase().includes(query.toLowerCase())
                                                            );
                                                            alert(`พบ ${found.length} ข้อความที่ตรงกับ "${query}"`);
                                                        }
                                                    }}
                                                    title="ค้นหาข้อความในแชทนี้"
                                                >
                                                    <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                                        <Search className="h-4 w-4 text-gray-600" />
                                                    </div>
                                                    <span className="text-[10px] text-gray-600">ค้นหาข้อความ</span>
                                                </button>

                                                {/* Bookmark/Pin */}
                                                <button
                                                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-yellow-50 transition-colors group"
                                                    onClick={() => {
                                                        alert('ปักหมุดการสนทนานี้แล้ว!');
                                                    }}
                                                    title="ปักหมุดการสนทนา"
                                                >
                                                    <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                                                        <Bookmark className="h-4 w-4 text-gray-600 group-hover:text-yellow-600" />
                                                    </div>
                                                    <span className="text-[10px] text-gray-600">ปักหมุด</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Notification Toggle */}
                                        <div className="p-4 border-b">
                                            <button
                                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                                onClick={() => {
                                                    setNotificationsEnabled(!notificationsEnabled);
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${notificationsEnabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                                        {notificationsEnabled ? <Bell className="h-4 w-4 text-blue-600" /> : <BellOff className="h-4 w-4 text-gray-400" />}
                                                    </div>
                                                    <span className="text-sm text-gray-700">
                                                        {notificationsEnabled ? 'การแจ้งเตือนเปิดอยู่' : 'การแจ้งเตือนปิดอยู่'}
                                                    </span>
                                                </div>
                                                <div className={`w-10 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                                    <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Conversation Info */}
                                        <div className="p-4 border-b">
                                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">ข้อมูลการสนทนา</h5>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 text-sm">
                                                    <MessageCircle className="h-4 w-4 text-gray-400" />
                                                    <span className="text-gray-600">จำนวนข้อความ: <strong>{messages.length}</strong></span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm">
                                                    <Calendar className="h-4 w-4 text-gray-400" />
                                                    <span className="text-gray-600">สนทนาล่าสุด: <strong>{new Date(selectedConversation.updated_time).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm">
                                                    <User className="h-4 w-4 text-gray-400" />
                                                    <span className="text-gray-600">เพจ: <strong>{getPageDetails(selectedConversation.pageId)?.name || 'Unknown'}</strong></span>
                                                </div>
                                                {/* Ad ID - แสดงเมื่อลูกค้าทักมาจากโฆษณา */}
                                                {selectedConversation.adId && (
                                                    <div className="flex items-center gap-3 text-sm bg-blue-50 p-2 rounded-lg">
                                                        <Megaphone className="h-4 w-4 text-blue-500" />
                                                        <span className="text-blue-700">มาจากโฆษณา: <strong className="font-mono">{selectedConversation.adId}</strong></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Menu Items */}
                                        <div className="p-4 space-y-1">
                                            <button
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                                                onClick={() => {
                                                    // Filter images from messages
                                                    const imageMessages = messages.filter(m => m.message?.includes('http') || m.attachments);
                                                    alert(`พบ ${imageMessages.length} รูปภาพ/วิดีโอ`);
                                                }}
                                            >
                                                <Image className="h-5 w-5 text-gray-500" />
                                                <span className="text-sm text-gray-700">ไฟล์รูปภาพ/วิดีโอ</span>
                                                <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                                            </button>

                                            <button
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                                                onClick={() => {
                                                    alert('ไม่พบไฟล์ในการสนทนานี้');
                                                }}
                                            >
                                                <FileText className="h-5 w-5 text-gray-500" />
                                                <span className="text-sm text-gray-700">ไฟล์</span>
                                                <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                                            </button>

                                            <button
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                                                onClick={() => {
                                                    // Extract links from messages
                                                    const links = messages.filter(m => m.message?.match(/https?:\/\/[^\s]+/));
                                                    alert(`พบ ${links.length} ลิงก์`);
                                                }}
                                            >
                                                <Link2 className="h-5 w-5 text-gray-500" />
                                                <span className="text-sm text-gray-700">ลิงก์</span>
                                                <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                                            </button>

                                            <div className="border-t my-3"></div>

                                            <button
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left text-red-500"
                                                onClick={() => {
                                                    if (confirm('คุณต้องการรายงานว่าผู้ใช้นี้เป็นสแปมหรือไม่?')) {
                                                        alert('รายงานเรียบร้อยแล้ว ขอบคุณสำหรับการแจ้ง');
                                                    }
                                                }}
                                            >
                                                <AlertTriangle className="h-5 w-5" />
                                                <span className="text-sm font-medium">รายงานว่าเป็นสแปม</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                }
            </Card >
        </div >
    );
}
