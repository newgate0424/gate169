'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MoreHorizontal, MessageCircle, RefreshCw, Loader2, Settings, Send, Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    fetchPages,
    fetchConversations,
    fetchMessages,
    sendReply,
    fetchConversationsFromDB,
    fetchMessagesFromDB
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

// Notification sound URL (you can replace with your own)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR0BJpTA2PeufBwFFofC4fzAlgMMKnS61/W5jQMQQ4u32/7MlwMFF3vC4/zEnwAMI4C+4//VqQAAFXW55v7cpQAGIYq95//fpwAAI3+85f/jqQAADG+95v/nqgAAI3y73v/kpgABKX+44v/epAAAKYW65P/cpAAAE2ay4P7YnwAAQYK13f7TmgAMGnqw2/vNkwAOGHiu2PnIjgANGnqt1ffDiQAPJYKw1PW+hAAQMIy01fO5fwAPKIaw0fCzegAQMo6zz+6vdQAPNo+xyOepaAATL5SwxuSjYgARLJOvw+KdXAAYPJaxxN+YVgAWPpmvv9mOTwAYPpuuutSETQAbQp6us9F+QgAaN5yurM16OgAaM5usp8ZyMgAaM5unn75qKgAaM5qmmbRhIgAaM5qllq5aGgAYL5mkk6lTEQAWL5ejkKRLCQAWL5eij6FFAQAaL5ehjaE+AAAALpihip0+AAAANJqiiZk+AAAAOpyjiJY+AAAAQp6kiJM+AAAASqClh5I+AAAAUqKmiJI+AAAAWqSnhpE+AAAAYqaoho8+AAAAaqioho0+AAAAcqqohos+AAAAequphok+AAAA';

export default function AssetsPage() {
    const { data: session } = useSession();
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
    const lastCheckTimeRef = useRef<string>(new Date().toISOString());
    const [unreadCount, setUnreadCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Save selectedPageIds to localStorage whenever it changes
    useEffect(() => {
        if (selectedPageIds.length > 0) {
            localStorage.setItem('selectedPageIds', JSON.stringify(selectedPageIds));
        }
    }, [selectedPageIds]);

    // Initialize audio element
    useEffect(() => {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.5;

        // Request notification permission on mount
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Play notification sound
    const playNotificationSound = useCallback(() => {
        if (soundEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => console.log('Audio play failed:', err));
        }
    }, [soundEnabled]);

    // Show browser notification
    const showNotification = useCallback((title: string, body: string) => {
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: 'new-message',
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        }
    }, [notificationsEnabled]);

    // Poll for new messages - Real-time polling every 2 seconds
    useEffect(() => {
        if (selectedPageIds.length === 0) return;

        const pollForMessages = async () => {
            try {
                const response = await fetch(
                    `/api/messages/stream?pageIds=${selectedPageIds.join(',')}&lastCheck=${lastCheckTimeRef.current}`
                );

                if (response.ok) {
                    const data = await response.json();

                    if (data.messages && data.messages.length > 0) {
                        // New messages received!
                        console.log('📩 New messages:', data.messages.length);
                        playNotificationSound();

                        const latestMessage = data.messages[0];
                        showNotification(
                            '💬 ข้อความใหม่',
                            `${latestMessage.senderName || 'ลูกค้า'}: ${latestMessage.content?.substring(0, 50) || 'ส่งข้อความ'}`
                        );

                        // Refresh conversations list
                        loadConversations(selectedPageIds);

                        // If viewing the conversation that received new message, refresh messages
                        if (selectedConversation && data.messages.some((m: any) => m.conversationId === selectedConversation.id)) {
                            loadMessages(selectedConversation.id, selectedConversation.pageId);
                        }
                    }

                    // Update unread count
                    if (data.unreadConversations) {
                        const totalUnread = data.unreadConversations.reduce((sum: number, c: any) => sum + c.unreadCount, 0);
                        setUnreadCount(totalUnread);
                    }

                    lastCheckTimeRef.current = data.timestamp || new Date().toISOString();
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Initial poll
        pollForMessages();

        // Poll every 2 seconds for near real-time updates
        const pollInterval = setInterval(pollForMessages, 2000);

        return () => clearInterval(pollInterval);
    }, [selectedPageIds, selectedConversation, playNotificationSound, showNotification]);

    useEffect(() => {
        if (facebookToken) {
            loadPages();
        }
    }, [facebookToken]);

    useEffect(() => {
        if (selectedPageIds.length > 0 && facebookToken) {
            loadConversations(selectedPageIds);
        } else {
            setConversations([]);
        }
    }, [selectedPageIds, facebookToken]);

    useEffect(() => {
        if (selectedConversation && facebookToken) {
            loadMessages(selectedConversation.id, selectedConversation.pageId);
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

    const loadConversations = async (pageIds: string[]) => {
        setLoadingChat(true);
        try {
            const selectedPages = pages.filter(p => pageIds.includes(p.id));
            const data = await fetchConversations(selectedPages);

            if (data.length === 0) {
                console.log("API returned empty, trying DB fallback...");
                const dbData = await fetchConversationsFromDB(pageIds);
                setConversations(dbData);
            } else {
                setConversations(data);
            }
        } catch (error) {
            console.error("Failed to load conversations", error);
            try {
                const dbData = await fetchConversationsFromDB(pageIds);
                setConversations(dbData);
            } catch (dbErr) {
                console.error("DB fallback failed", dbErr);
            }
        } finally {
            setLoadingChat(false);
        }
    };

    const loadMessages = async (conversationId: string, pageId: string) => {
        if (loadingMessages) return;
        console.log(`Loading messages for conversation: ${conversationId}`);
        setLoadingMessages(true);
        try {
            const page = pages.find(p => p.id === pageId);
            const data = await fetchMessages(conversationId, pageId, page?.access_token);

            if (data.length === 0) {
                console.log("API messages empty, trying DB...");
                const dbData = await fetchMessagesFromDB(conversationId);
                if (dbData.length > 0) {
                    setMessages(dbData);
                } else {
                    setMessages([]);
                }
            } else {
                setMessages(data);
            }
        } catch (error) {
            console.error("Failed to load messages", error);
            try {
                const dbData = await fetchMessagesFromDB(conversationId);
                setMessages(dbData);
            } catch (dbErr) {
                console.error("DB message fallback failed", dbErr);
            }
        } finally {
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

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const recipientId = selectedConversation.participants?.data[0]?.id;

            if (!recipientId) {
                console.error("No recipient ID found");
                return;
            }

            const result = await sendReply(selectedConversation.pageId, recipientId, currentReply);

            if (result.success) {
                setTimeout(() => {
                    loadMessages(selectedConversation.id, selectedConversation.pageId);
                }, 2000);
            } else {
                console.error("Failed to send reply:", result.error);
                loadMessages(selectedConversation.id, selectedConversation.pageId);
            }
        } catch (error) {
            console.error("Error sending reply", error);
            loadMessages(selectedConversation.id, selectedConversation.pageId);
        } finally {
            setSending(false);
        }
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
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Inbox
                        {unreadCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500">Manage messages from all your connected pages</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if ('Notification' in window && Notification.permission !== 'granted') {
                                Notification.requestPermission();
                            }
                            setNotificationsEnabled(!notificationsEnabled);
                        }}
                        title={notificationsEnabled ? 'ปิดการแจ้งเตือน' : 'เปิดการแจ้งเตือน'}
                        className={notificationsEnabled ? 'text-blue-600' : 'text-gray-400'}
                    >
                        {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        title={soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
                        className={soundEnabled ? 'text-blue-600' : 'text-gray-400'}
                    >
                        {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Chat Container */}
            <Card className="flex-1 flex flex-row overflow-hidden">
                {/* Left Panel - Conversation List */}
                <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
                    {/* Header */}
                    <div className="p-4 border-b flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Messages</h2>
                        <div className="flex items-center gap-1">
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Manage Pages">
                                        <Settings className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Select Pages</DialogTitle>
                                        <DialogDescription>
                                            Choose which pages you want to see messages from.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-500">{pages.length} Pages Available</span>
                                            <Button variant="ghost" size="sm" onClick={toggleTempSelectAll} className="text-xs h-8">
                                                {tempSelectedPageIds.length === pages.length ? 'Deselect All' : 'Select All'}
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
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                        <Button onClick={handleSaveSelection}>Apply Changes</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="icon" onClick={() => loadConversations(selectedPageIds)} disabled={loadingChat} title="Refresh Messages">
                                <RefreshCw className={`h-4 w-4 ${loadingChat ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="p-2 border-b bg-gray-50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input placeholder="Search messages..." className="pl-9 bg-white h-9" />
                        </div>
                    </div>

                    {/* Conversation List */}
                    <ScrollArea className="flex-1">
                        {loadingChat ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : (!conversations || conversations.length === 0) ? (
                            <div className="text-center py-12 text-gray-500 text-sm px-4">
                                <MessageCircle className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                                <p>No messages found.</p>
                                <p className="text-xs mt-1">Try selecting more pages or check back later.</p>
                            </div>
                        ) : (
                            conversations.map((conv) => {
                                const page = getPageDetails(conv.pageId);
                                return (
                                    <div
                                        key={conv.id}
                                        className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${selectedConversation?.id === conv.id ? 'bg-blue-50' : ''}`}
                                        onClick={() => setSelectedConversation(conv)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-medium text-gray-900 truncate max-w-[140px]">
                                                {conv.participants?.data[0]?.name || 'Unknown User'}
                                            </div>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                                {new Date(conv.updated_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500 truncate mb-2">
                                            {conv.snippet || 'No messages'}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Avatar className="h-4 w-4">
                                                <AvatarImage src={page?.picture?.data?.url} />
                                                <AvatarFallback className="text-[8px]">{page?.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] text-gray-400 truncate">
                                                via {page?.name}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </ScrollArea>
                </div>

                {/* Right Panel - Chat View */}
                <div className="flex-1 flex flex-col bg-gray-50">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                        {(selectedConversation.participants?.data[0]?.name || 'U').charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-gray-900">
                                            {selectedConversation.participants?.data[0]?.name || 'Unknown User'}
                                        </h2>
                                        <div className="text-xs text-gray-500">
                                            via {getPageDetails(selectedConversation.pageId)?.name || 'Unknown Page'}
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-5 w-5 text-gray-500" />
                                </Button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                                {loadingMessages ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    </div>
                                ) : messages.length > 0 ? (
                                    messages.map((msg) => {
                                        const page = pages.find(p => p.id === selectedConversation.pageId);
                                        const participantId = selectedConversation.participants?.data[0]?.id;
                                        const isFromPage =
                                            (msg.from?.id === selectedConversation.pageId) ||
                                            (page && msg.from?.name === page.name) ||
                                            (participantId && msg.from?.id !== participantId);

                                        return (
                                            <div key={msg.id} className={`flex ${isFromPage ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isFromPage
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-white border text-gray-900 rounded-bl-none shadow-sm'
                                                    }`}>
                                                    <p>{msg.message}</p>
                                                    <div className={`text-[10px] mt-1 ${isFromPage ? 'text-blue-100' : 'text-gray-400'}`}>
                                                        {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        <span className="opacity-50"> • {msg.from?.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No messages loaded.
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white border-t">
                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="Type your reply..."
                                        className="min-h-[50px] max-h-[150px] resize-none flex-1"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendReply();
                                            }
                                        }}
                                    />
                                    <Button
                                        className="h-[50px] w-[50px] shrink-0"
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
                        <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4">
                            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
                                <MessageCircle className="h-8 w-8" />
                            </div>
                            <p>Select a conversation to start chatting</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
