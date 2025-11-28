'use client';
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MoreHorizontal, MessageCircle, RefreshCw, Loader2, CheckSquare, Settings, Filter, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchPages, fetchConversations, fetchMessages, sendReply } from '@/app/actions';
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

export default function AssetsPage() {
    const { data: session } = useSession();
    // @ts-ignore
    const facebookToken = session?.user?.facebookAccessToken;

    const [pages, setPages] = useState<any[]>([]);
    const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
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
            const data = await fetchPages(facebookToken);
            setPages(data);
            // Auto-select first page if available and nothing selected
            if (data.length > 0 && selectedPageIds.length === 0) {
                setSelectedPageIds([data[0].id]);
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
            // Filter pages to get the full objects for the selected IDs
            const selectedPages = pages.filter(p => pageIds.includes(p.id));
            const data = await fetchConversations(facebookToken, selectedPages);
            setConversations(data);
        } catch (error) {
            console.error("Failed to load conversations", error);
        } finally {
            setLoadingChat(false);
        }
    };

    const loadMessages = async (conversationId: string, pageId: string) => {
        if (loadingMessages) return; // Prevent concurrent fetches
        console.log(`Loading messages for conversation: ${conversationId}`);
        setLoadingMessages(true);
        try {
            // Find the page to get its token
            const page = pages.find(p => p.id === pageId);
            const data = await fetchMessages(facebookToken, conversationId, pageId, page?.access_token);
            setMessages(data);
        } catch (error) {
            console.error("Failed to load messages", error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConversation) return;

        const currentReply = replyText;
        setReplyText(''); // Clear input immediately
        setSending(true);

        // Optimistic Update: Add message to UI immediately
        const optimisticMsg = {
            id: `temp-${Date.now()}`,
            message: currentReply,
            from: { name: 'Me', id: selectedConversation.pageId },
            created_time: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            // Recipient ID is usually the first participant that is NOT the page itself
            const recipientId = selectedConversation.participants?.data[0]?.id;

            if (!recipientId) {
                console.error("No recipient ID found");
                return;
            }

            const result = await sendReply(facebookToken, selectedConversation.pageId, recipientId, currentReply);

            if (result.success) {
                // Success - wait a bit for Facebook to index the message before refreshing
                setTimeout(() => {
                    loadMessages(selectedConversation.id, selectedConversation.pageId);
                }, 2000);
            } else {
                console.error("Failed to send reply:", result.error);
                // Revert optimistic update by reloading real messages
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
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-6">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
                    <p className="text-sm text-gray-500">Manage messages from all your connected pages</p>
                </div>
            </div>

            {/* Main Content: Chat Interface */}
            <Card className="flex-1 flex overflow-hidden border-gray-200 shadow-sm">
                {/* Conversation List (Left) */}
                <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white gap-2">
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
                    <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search messages..."
                                className="pl-9 bg-white border-gray-200 h-9"
                            />
                        </div>
                    </div>
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
                                        className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${selectedConversation?.id === conv.id ? 'bg-blue-50/50' : ''}`}
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

                                        {/* Page Indicator */}
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <Avatar className="h-4 w-4">
                                                <AvatarImage src={page?.picture?.data?.url} />
                                                <AvatarFallback className="text-[8px]">{page?.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                                                via {page?.name}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </ScrollArea>
                </div>

                {/* Message View (Right) */}
                <div className="flex-1 flex flex-col bg-gray-50/30">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                        {(selectedConversation.participants?.data[0]?.name || 'U').charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-gray-900">
                                            {selectedConversation.participants?.data[0]?.name || 'Unknown User'}
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>via {getPageDetails(selectedConversation.pageId)?.name || 'Unknown Page'}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-5 w-5 text-gray-500" />
                                </Button>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                                {loadingMessages ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    </div>
                                ) : messages.length > 0 ? (
                                    messages.map((msg) => {
                                        const isFromPage = msg.from?.id === selectedConversation.pageId;
                                        return (
                                            <div key={msg.id} className={`flex ${isFromPage ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isFromPage
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none shadow-sm'
                                                    }`}>
                                                    <p>{msg.message}</p>
                                                    <p className={`text-[10px] mt-1 ${isFromPage ? 'text-blue-100' : 'text-gray-400'}`}>
                                                        {new Date(msg.created_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
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
                            <div className="p-4 bg-white border-t border-gray-200">
                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="Type your reply..."
                                        className="min-h-[50px] max-h-[150px] resize-none"
                                        value={replyText}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
