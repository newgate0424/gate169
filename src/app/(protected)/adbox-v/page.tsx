'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Search, MessageCircle, RefreshCw, Loader2, Settings, Send, Bell, BellOff, Ban, Image, FileText, Mail, User, Plus, Megaphone, Shield, X, Bookmark, Link2, AlertTriangle, ExternalLink, Calendar, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    fetchPages,
    fetchConversationsFromDB,
    fetchMessagesFromDB,
    sendReply,
    syncConversationsOnce,
    syncMessagesOnce,
    markConversationAsRead,
    updateConversationViewer
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
import { useAppSettings } from '@/hooks/useAppSettings';

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

export default function AdBoxVPage() {
    const { data: session } = useSession();
    const { t } = useLanguage();
    // @ts-expect-error
    const facebookToken = session?.user?.facebookPageToken;

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
    const [loading, setLoading] = useState(true);
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
    const { notificationsEnabled, soundEnabled } = useAppSettings();
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

    // Detail panel state
    const [showDetailPanel, setShowDetailPanel] = useState(true);
    const [detailTab, setDetailTab] = useState('info');
    const [customerNote, setCustomerNote] = useState('');

    // Ad Data
    const [adData, setAdData] = useState<any>(null);
    const [loadingAdData, setLoadingAdData] = useState(false);

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

    // Save selectedPageIds to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('selectedPageIds', JSON.stringify(selectedPageIds));
            console.log('💾 Saved selectedPageIds to localStorage:', selectedPageIds);
        }
    }, [selectedPageIds]);

    // Initialize notification sound
    useEffect(() => {
        notificationSoundRef.current = createNotificationSound();
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

    // Fetch Ad Data when selected conversation changes and has adId
    useEffect(() => {
        if (selectedConversation?.adId) {
            setLoadingAdData(true);
            setAdData(null);

            // Dynamic import to avoid server-side issues if any
            import('@/app/actions').then(({ fetchAdDetails }) => {
                fetchAdDetails(selectedConversation.adId!)
                    .then(data => {
                        setAdData(data);
                    })
                    .catch(err => console.error("Failed to fetch ad data", err))
                    .finally(() => setLoadingAdData(false));
            });
        } else {
            setAdData(null);
        }
    }, [selectedConversation?.id, selectedConversation?.adId]);

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
                            const updated = [...prev];
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

                            // Sort by updated_time
                            return updated.sort((a, b) => new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime());
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
        let hasData = false;

        // 1. Load from DB immediately for instant UI
        try {
            const dbData = await fetchConversationsFromDB(pageIds);
            if (dbData.length > 0) {
                setConversations(dbData);
                hasData = true;
                setLoadingChat(false); // Show data immediately
            }
        } catch (dbErr) {
            console.error("DB load failed", dbErr);
        }

        // 2. Sync from API
        if (forceSync) {
            const syncTask = async () => {
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
                } finally {
                    if (!hasData) setLoadingChat(false);
                }
            };

            // If we already have data, run sync in background (fire and forget)
            // If we don't have data, we must wait for sync
            if (hasData) {
                syncTask();
            } else {
                await syncTask();
            }
        } else {
            if (!hasData) setLoadingChat(false);
        }
    };

    const loadMessages = async (conversationId: string, pageId: string, forceSync = false) => {
        // REMOVED: if (loadingMessages) return; -> This caused the bug where switching chats quickly blocked loading
        console.log(`Loading messages for conversation: ${conversationId}`);

        // Only set loading if we don't have messages yet (prevent flickering if we have cache)
        if (messages.length === 0) {
            setLoadingMessages(true);
        }

        let hasData = false;

        // 1. Load from DB immediately
        try {
            const dbData = await fetchMessagesFromDB(conversationId);

            // Check if we are still on the same conversation
            if (currentConversationIdRef.current !== conversationId) return;

            if (dbData.length > 0) {
                setMessages(dbData);
                setMessageCache(prev => ({ ...prev, [conversationId]: dbData }));
                hasData = true;
                setLoadingMessages(false); // Show data immediately
            } else {
                // If DB is empty, force sync from API
                console.log(`[Frontend] DB empty for ${conversationId}, forcing API sync`);
                forceSync = true;
            }
        } catch (dbErr) {
            console.error("DB message load failed", dbErr);
        }

        // 2. Sync from API
        if (forceSync) {
            const syncTask = async () => {
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
                } finally {
                    // Only turn off loading if we are still on the same conversation
                    if (currentConversationIdRef.current === conversationId && !hasData) {
                        setLoadingMessages(false);
                    }
                }
            };

            if (hasData) {
                syncTask();
            } else {
                await syncTask();
            }
        } else {
            if (currentConversationIdRef.current === conversationId && !hasData) {
                setLoadingMessages(false);
            }
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
            {/* Chat Container */}
            <div className="flex-1 flex flex-row gap-3 overflow-hidden mb-0">
                {/* Left Panel - Conversation List */}
                <Card className="w-[500px] flex-shrink-0 flex flex-col bg-white rounded-2xl border shadow-lg overflow-hidden">
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
                                <Button variant="ghost" size="icon" title="ตั้งค่าสิทธิ์">
                                    <Shield className="h-4 w-4 text-gray-500" />
                                </Button>
                            </Link>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="จัดการเพจ">
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
                            <Button variant="ghost" size="icon" onClick={() => loadConversations(selectedPageIds, true)} disabled={loadingChat} title="ซิงค์ข้อมูลจาก Facebook">
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
                            // Helper for time formatting
                            const formatTime = (dateString: string) => {
                                if (!dateString) return '';
                                const date = new Date(dateString);
                                if (isNaN(date.getTime())) return '';

                                const now = new Date();
                                const isToday = date.getDate() === now.getDate() &&
                                    date.getMonth() === now.getMonth() &&
                                    date.getFullYear() === now.getFullYear();

                                // Check for yesterday
                                const yesterday = new Date(now);
                                yesterday.setDate(now.getDate() - 1);
                                const isYesterday = date.getDate() === yesterday.getDate() &&
                                    date.getMonth() === yesterday.getMonth() &&
                                    date.getFullYear() === yesterday.getFullYear();

                                if (isToday) {
                                    // 12-hour format with am/pm
                                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).replace('AM', 'am').replace('PM', 'pm');
                                }
                                if (isYesterday) {
                                    // Show time before 'yesterday'
                                    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).replace('AM', 'am').replace('PM', 'pm');
                                    return `${timeStr} yesterday`;
                                }
                                return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                            };

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

                            // Sort conversations by updated_time (descending)
                            const sorted = filtered.sort((a, b) => {
                                return new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime();
                            });

                            if (sorted.length === 0) {
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

                            return sorted.map((conv) => {
                                const page = getPageDetails(conv.pageId);
                                const unreadCount = Number(conv.unread_count || 0);
                                const isUnread = unreadCount > 0;
                                const isSelected = selectedConversation?.id === conv.id;

                                // Determine source type
                                const isComment = conv.facebookLink && (conv.facebookLink.includes('comment') || conv.facebookLink.includes('posts'));

                                return (
                                    <div
                                        key={conv.id}
                                        className={`grid grid-cols-[auto_1fr_auto] gap-3 p-3 cursor-pointer transition-colors border-l-2 relative ${isSelected
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
                                            if (unreadCount > 0) {
                                                markConversationAsRead(conv.id).catch(console.error);
                                            }
                                            // Update viewer (fire and forget)
                                            updateConversationViewer(conv.id).catch(console.error);
                                        }}
                                    >
                                        {/* Col 1: Avatar Section */}
                                        <div className="relative">
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
                                                <span className="absolute bottom-0 right-0 h-5 w-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold z-10 shadow-sm">
                                                    {unreadCount > 9 ? '9+' : unreadCount}
                                                </span>
                                            )}
                                        </div>

                                        {/* Col 2: Content Section (Name & Snippet) */}
                                        <div className="min-w-0 flex flex-col justify-center gap-1">
                                            {/* Name Row */}
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {page?.picture?.data?.url && (
                                                    <Avatar className="h-3.5 w-3.5 flex-shrink-0">
                                                        <AvatarImage src={page.picture.data.url} />
                                                        <AvatarFallback>{page.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                )}
                                                <span className="text-gray-400 text-[10px] flex-shrink-0">{'>'}</span>
                                                <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                    {conv.participants?.data[0]?.name || 'ผู้ใช้ไม่ระบุชื่อ'}
                                                </span>
                                            </div>

                                            {/* Snippet Row */}
                                            <div className="flex items-center w-full">
                                                <span className={`text-xs truncate ${isUnread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                                    {conv.snippet || 'ไม่มีข้อความ'}
                                                </span>
                                            </div>

                                            {/* Viewed by indicator */}
                                            {conv.viewedByName && (
                                                <div className="flex items-center gap-1">
                                                    <User className="h-2.5 w-2.5 text-gray-300" />
                                                    <span className="text-[9px] text-gray-400 truncate max-w-[100px]">
                                                        {conv.viewedByName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Col 3: Meta Section (Time & Icon) */}
                                        <div className="flex flex-col items-end gap-1 ml-1">
                                            <span className={`text-xs whitespace-nowrap ${isUnread ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                                                {formatTime(conv.updated_time) || ''}
                                            </span>
                                            <div title={isComment ? "จากคอมเมนต์" : "จากข้อความ"}>
                                                {isComment ? (
                                                    <MessageCircle className="h-4 w-4 text-gray-500" />
                                                ) : (
                                                    <Mail className="h-4 w-4 text-gray-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </ScrollArea >
                </Card >

                {/* Middle Panel - Chat View */}
                <Card className="flex-1 flex flex-col bg-white min-w-0 rounded-2xl border shadow-lg overflow-hidden">
                    {
                        selectedConversation ? (
                            <>
                                {/* Chat Header */}
                                < div className="px-4 py-3 border-b bg-white flex items-center justify-between" >
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
                                                {selectedConversation.participants?.data[0]?.name || 'ผู้ใช้ไม่ระบุชื่อ'}
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
                                                setConversations(prev => prev.map(c =>
                                                    c.id === selectedConversation.id ? { ...c, unread_count: 1 } : c
                                                ));
                                                setToastMessage("ทำเครื่องหมายว่ายังไม่อ่านแล้ว");
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
                                </div >

                                {/* Messages Area */}
                                < div
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
                                            <div className="flex justify-center">
                                                <span className="bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full">
                                                    วันนี้
                                                </span>
                                            </div>
                                            {messages.map((msg, idx) => {
                                                const isMe = msg.from?.id === selectedConversation.pageId;
                                                let attachments: any[] = [];
                                                try {
                                                    if (msg.attachments) {
                                                        const parsed = typeof msg.attachments === 'string'
                                                            ? JSON.parse(msg.attachments)
                                                            : msg.attachments;
                                                        if (parsed && parsed.data && Array.isArray(parsed.data)) {
                                                            attachments = parsed.data;
                                                        } else if (Array.isArray(parsed)) {
                                                            attachments = parsed;
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Error parsing attachments", e);
                                                }

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
                                                    >
                                                        {!isMe && (
                                                            <Avatar className="h-8 w-8 mr-2 mt-1">
                                                                <AvatarImage
                                                                    src={getProfilePictureUrl(msg.from?.id, selectedConversation.pageId, 'small', msg.from?.name)}
                                                                />
                                                                <AvatarFallback>{msg.from?.name?.charAt(0) || 'U'}</AvatarFallback>
                                                            </Avatar>
                                                        )}
                                                        <div
                                                            className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe
                                                                ? 'bg-blue-500 text-white rounded-br-none'
                                                                : 'bg-white text-gray-900 shadow-sm rounded-bl-none'
                                                                }`}
                                                        >
                                                            {msg.message}
                                                            {attachments.map((att: any, i: number) => (
                                                                <div key={i} className="mt-2">
                                                                    {att.image_data ? (
                                                                        <img
                                                                            src={att.image_data.url}
                                                                            alt="attachment"
                                                                            className="rounded-lg max-w-full cursor-pointer hover:opacity-90"
                                                                            onClick={() => window.open(att.image_data.url, '_blank')}
                                                                        />
                                                                    ) : att.url ? (
                                                                        <img
                                                                            src={att.url}
                                                                            alt="attachment"
                                                                            className="rounded-lg max-w-full cursor-pointer hover:opacity-90"
                                                                            onClick={() => window.open(att.url, '_blank')}
                                                                        />
                                                                    ) : (
                                                                        <a href={att.file_url || att.url} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-80">
                                                                            ไฟล์แนบ
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                                                {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <div className="text-center py-12 text-gray-400">
                                            <p>เริ่มต้นการสนทนา</p>
                                        </div>
                                    )}
                                </div >

                                {/* Input Area */}
                                < div className="p-4 bg-white border-t" >
                                    <div className="flex items-end gap-2">
                                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600">
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600">
                                            <Image className="h-5 w-5" />
                                        </Button>
                                        <div className="flex-1 relative">
                                            <Textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="พิมพ์ข้อความ..."
                                                className="min-h-[44px] max-h-[120px] py-3 pr-10 resize-none rounded-xl bg-gray-100 border-0 focus-visible:ring-0 focus-visible:bg-gray-50"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendReply();
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 bottom-1 text-gray-400 hover:text-blue-600"
                                            >
                                                <Megaphone className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={handleSendReply}
                                            disabled={!replyText.trim() || sending}
                                            className={`rounded-xl h-[44px] w-[44px] p-0 ${replyText.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 text-gray-400'}`}
                                        >
                                            {sending ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <Send className="h-5 w-5" />
                                            )}
                                        </Button>
                                    </div>
                                </div >
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                                    <MessageCircle className="h-12 w-12 text-blue-100 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-1">{t('adbox.selectConversation')}</h3>
                                <p className="text-sm text-gray-500 max-w-xs text-center">
                                    เลือกแชทจากรายการทางซ้ายเพื่อเริ่มสนทนา หรือตอบกลับลูกค้า
                                </p>
                            </div>
                        )
                    }
                </Card >

                {/* Right Panel - Customer Details (Pancake style with tabs) */}
                {
                    selectedConversation && showDetailPanel && (
                        <Card className="w-[320px] bg-white flex-shrink-0 flex flex-col min-h-0 rounded-2xl border shadow-lg overflow-hidden">
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
                                                <Avatar className="h-24 w-24 mx-auto mb-3 border-4 border-white shadow-lg">
                                                    <AvatarImage
                                                        src={getProfilePictureUrl(selectedConversation.participants?.data[0]?.id, selectedConversation.pageId, 'large', selectedConversation.participants?.data[0]?.name)}
                                                    />
                                                    <AvatarFallback className="text-xl bg-blue-100 text-blue-600">
                                                        {(selectedConversation.participants?.data[0]?.name || 'U').charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
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
                                                    // Toggle notification logic here if needed
                                                    alert('ตั้งค่าการแจ้งเตือนที่หน้า Settings');
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
                        </Card>
                    )
                }
            </div >
        </div >
    );
}
