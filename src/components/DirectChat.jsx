import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, X, Minimize2, Maximize2, Paperclip, Image as ImageIcon, Smile, MoreVertical, Reply, Pin, FileText, Trash2, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

export default function DirectChat({ friend, onClose, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [conversation, setConversation] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [showPinned, setShowPinned] = useState(false);
    
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

    const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

    useEffect(() => {
        if (!friend || !currentUser) return;
        let cancelled = false;
        const initChat = async () => {
            try {
                const allConvos = await base44.entities.Conversation.list();
                let conv = allConvos.find(c => 
                    c.participants.includes(currentUser.id) && 
                    c.participants.includes(friend.id)
                );
                if (!conv) {
                    conv = await base44.entities.Conversation.create({
                        participants: [currentUser.id, friend.id],
                        last_message_at: new Date().toISOString(),
                        last_message_preview: 'Démarrage de la conversation'
                    });
                }
                if (cancelled) return;
                setConversation(conv);
                const msgs = await base44.entities.DirectMessage.filter({ conversation_id: conv.id }, 'created_date', 50);
                const sortedMsgs = msgs.sort((a,b) => new Date(a.created_date) - new Date(b.created_date));
                if (cancelled) return;
                setMessages(sortedMsgs);
                setPinnedMessages(sortedMsgs.filter(m => m.is_pinned));
            } catch (e) {
                console.error('Chat init error', e);
            }
        };
        initChat();
        const onDM = (e) => {
            const d = e.detail || {};
            if (d.senderId === friend.id) {
                const msg = {
                    id: 'live-' + Date.now(),
                    conversation_id: conversation?.id,
                    sender_id: d.senderId,
                    content: d.content || d.message || '',
                    created_date: new Date().toISOString(),
                    reactions: [],
                    is_pinned: false
                };
                setMessages(prev => [...prev, msg]);
            }
        };
        window.addEventListener('direct-message', onDM);
        return () => { cancelled = true; window.removeEventListener('direct-message', onDM); };
    }, [friend?.id, currentUser?.id]);

    useEffect(() => {
        if (scrollRef.current && !showPinned) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isMinimized, attachments, replyingTo, showPinned]);

    const handleSend = async () => {
        if ((!newMessage.trim() && attachments.length === 0) || !conversation) return;

        const msgContent = newMessage;
        const msgAttachments = [...attachments];
        const msgReplyTo = replyingTo?.id;

        // Clear state immediately
        setNewMessage("");
        setAttachments([]);
        setReplyingTo(null);

        try {
            await base44.entities.DirectMessage.create({
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: msgContent,
                attachments: msgAttachments,
                reply_to_id: msgReplyTo,
                read: false,
                reactions: [],
                is_pinned: false
            });

            await base44.entities.Conversation.update(conversation.id, {
                last_message_at: new Date().toISOString(),
                last_message_preview: msgContent || (msgAttachments.length ? 'Pièce jointe envoyée' : '')
            });

            // Notification logic remains...
            await base44.entities.Notification.create({
                recipient_id: friend.id,
                type: 'message',
                sender_id: currentUser.id,
                title: 'Nouveau message',
                message: `${currentUser.username || currentUser.full_name}: ${msgContent || 'Pièce jointe'}`,
                read: false
            });

            // Optimistic update
            const optimisticMsg = {
                id: 'temp-' + Date.now(),
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: msgContent,
                attachments: msgAttachments,
                reply_to_id: msgReplyTo,
                created_date: new Date().toISOString(),
                reactions: [],
                is_pinned: false
            };
            setMessages(prev => [...prev, optimisticMsg]);

        } catch (e) {
            console.error("Send error", e);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Using UploadFile integration
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            if (file_url) {
                setAttachments(prev => [...prev, {
                    type: file.type.startsWith('image/') ? 'image' : 'file',
                    url: file_url,
                    name: file.name
                }]);
            }
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const toggleReaction = async (msg, emoji) => {
        const currentReactions = msg.reactions || [];
        const existingIndex = currentReactions.findIndex(r => r.user_id === currentUser.id && r.emoji === emoji);
        let newReactions;
        
        if (existingIndex >= 0) {
            newReactions = currentReactions.filter((_, i) => i !== existingIndex);
        } else {
            newReactions = [...currentReactions, { user_id: currentUser.id, emoji }];
        }

        // Optimistic update local state
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: newReactions } : m));
        
        if (!msg.id.startsWith('temp-')) {
            await base44.entities.DirectMessage.update(msg.id, { reactions: newReactions });
        }
    };

    const togglePin = async (msg) => {
        const newStatus = !msg.is_pinned;
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: newStatus } : m));
        if (!msg.id.startsWith('temp-')) {
            await base44.entities.DirectMessage.update(msg.id, { is_pinned: newStatus });
        }
    };

    if (!friend) return null;

    if (isMinimized) {
        return (
            <div className="fixed bottom-0 right-20 w-64 bg-white border border-[#d4c5b0] shadow-xl rounded-t-lg z-50 animate-in slide-in-from-bottom-10">
                <div 
                    className="p-3 bg-[#4a3728] text-[#e8dcc5] rounded-t-lg flex justify-between items-center cursor-pointer"
                    onClick={() => setIsMinimized(false)}
                >
                    <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                            <AvatarImage src={friend.avatar_url} />
                            <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-sm truncate">{friend.username || friend.full_name}</span>
                    </div>
                    <div className="flex gap-1">
                        <Maximize2 className="w-4 h-4" />
                        <X className="w-4 h-4 hover:text-red-300" onClick={(e) => { e.stopPropagation(); onClose(); }} />
                    </div>
                </div>
            </div>
        );
    }

    const displayMessages = showPinned ? pinnedMessages : messages;

    return (
        <div className="fixed bottom-0 right-20 w-96 bg-[#fdfbf7] border border-[#d4c5b0] shadow-2xl rounded-t-lg z-50 flex flex-col h-[500px] animate-in slide-in-from-bottom-10">
            {/* Header */}
            <div className="p-3 bg-[#4a3728] text-[#e8dcc5] rounded-t-lg flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 border-2 border-[#e8dcc5]">
                        <AvatarImage src={friend.avatar_url} />
                        <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-bold text-sm">{friend.username || friend.full_name}</div>
                        <div className={`text-[10px] ${Date.now() - new Date(friend.last_seen).getTime() < 5 * 60 * 1000 ? 'text-green-400' : 'text-gray-400'} flex items-center gap-1`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${Date.now() - new Date(friend.last_seen).getTime() < 5 * 60 * 1000 ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                            {Date.now() - new Date(friend.last_seen).getTime() < 5 * 60 * 1000 ? 'En ligne' : 'Hors ligne'}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    <Pin 
                        className={`w-4 h-4 cursor-pointer transition-colors ${showPinned ? 'text-[#b8860b] fill-current' : 'hover:text-white'}`} 
                        onClick={() => setShowPinned(!showPinned)} 
                        title="Voir les messages épinglés"
                    />
                    <Minimize2 className="w-4 h-4 cursor-pointer hover:text-white" onClick={() => setIsMinimized(true)} />
                    <X className="w-4 h-4 cursor-pointer hover:text-red-300" onClick={onClose} />
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f5f0e6] scroll-smooth" ref={scrollRef}>
                {showPinned && pinnedMessages.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-4 italic">Aucun message épinglé</div>
                )}
                
                {displayMessages.map((msg) => {
                    const isMe = msg.sender_id === currentUser.id;
                    const parentMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                            {/* Reply Context */}
                            {parentMsg && (
                                <div className={`text-xs mb-1 px-2 py-1 rounded bg-black/5 border-l-2 border-[#b8860b] max-w-[80%] truncate opacity-70 ${isMe ? 'mr-1' : 'ml-1'}`}>
                                    <span className="font-bold mr-1">{parentMsg.sender_id === currentUser.id ? 'Moi' : (friend.username || 'Ami')}:</span>
                                    {parentMsg.content || 'Pièce jointe'}
                                </div>
                            )}

                            <div className={`max-w-[85%] relative group`}>
                                {/* Message Bubble */}
                                <div className={`rounded-2xl p-3 text-sm shadow-sm relative ${
                                    isMe 
                                        ? 'bg-[#4a3728] text-white rounded-tr-sm' 
                                        : 'bg-white text-gray-800 border border-[#d4c5b0] rounded-tl-sm'
                                }`}>
                                    {/* Attachments */}
                                    {msg.attachments && msg.attachments.map((att, idx) => (
                                        <div key={idx} className="mb-2 rounded overflow-hidden">
                                            {att.type === 'image' ? (
                                                <img src={att.url} alt="attachment" className="max-w-full h-auto rounded border border-white/20" />
                                            ) : (
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded ${isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}>
                                                    <FileText className="w-4 h-4" />
                                                    <span className="underline truncate max-w-[150px]">{att.name}</span>
                                                </a>
                                            )}
                                        </div>
                                    ))}

                                    {/* Text Content */}
                                    {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                                    
                                    {/* Meta */}
                                    <div className="flex justify-between items-center mt-1 gap-4">
                                        {msg.is_pinned && <Pin className="w-3 h-3 transform rotate-45" />}
                                        <span className={`text-[10px] ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                            {format(new Date(msg.created_date), 'HH:mm')}
                                        </span>
                                    </div>
                                </div>

                                {/* Hover Actions (Desktop) */}
                                <div className={`absolute top-0 ${isMe ? '-left-20' : '-right-20'} hidden group-hover:flex items-center gap-1 p-1 bg-white/90 backdrop-blur rounded-full shadow-sm border border-[#d4c5b0] transition-opacity opacity-0 group-hover:opacity-100`}>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#e8dcc5] rounded-full"><Smile className="w-3 h-3 text-[#4a3728]" /></Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-1 flex gap-1 bg-[#fdfbf7] border-[#d4c5b0]">
                                            {REACTION_EMOJIS.map(emoji => (
                                                <button 
                                                    key={emoji} 
                                                    onClick={() => toggleReaction(msg, emoji)}
                                                    className="w-7 h-7 hover:bg-[#e8dcc5] rounded flex items-center justify-center text-lg transition-transform hover:scale-125"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </PopoverContent>
                                    </Popover>
                                    
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#e8dcc5] rounded-full" onClick={() => setReplyingTo(msg)}>
                                        <Reply className="w-3 h-3 text-[#4a3728]" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#e8dcc5] rounded-full" onClick={() => togglePin(msg)}>
                                        <Pin className={`w-3 h-3 ${msg.is_pinned ? 'fill-[#4a3728]' : ''} text-[#4a3728]`} />
                                    </Button>
                                </div>

                                {/* Reactions Display */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        {Object.entries(msg.reactions.reduce((acc, r) => {
                                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                            return acc;
                                        }, {})).map(([emoji, count]) => (
                                            <div key={emoji} className="bg-white border border-[#d4c5b0] rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center gap-1">
                                                <span>{emoji}</span>
                                                <span className="font-bold text-gray-600">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-[#d4c5b0]">
                {/* Reply Banner */}
                {replyingTo && (
                    <div className="flex justify-between items-center bg-[#f5f0e6] p-2 rounded mb-2 text-xs border-l-4 border-[#b8860b] animate-in slide-in-from-bottom-2">
                        <div className="truncate">
                            <span className="font-bold text-[#4a3728]">Réponse à : </span>
                            {replyingTo.content || 'Pièce jointe'}
                        </div>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setReplyingTo(null)}>
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                )}

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                        {attachments.map((att, idx) => (
                            <div key={idx} className="relative group bg-gray-100 rounded p-1 border border-gray-200">
                                {att.type === 'image' ? (
                                    <div className="w-12 h-12">
                                        <img src={att.url} className="w-full h-full object-cover rounded" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 flex items-center justify-center">
                                        <FileText className="w-6 h-6 text-gray-500" />
                                    </div>
                                )}
                                <button 
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                >
                                    <X className="w-2 h-2" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-end">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload} 
                        accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                    
                    <div className="flex gap-1">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-gray-500 hover:text-[#4a3728] hover:bg-[#f5f0e6]"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                        </Button>
                    </div>

                    <Input 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        placeholder="Votre message..." 
                        className="h-9 text-sm bg-[#fdfbf7] border-[#e8dcc5] focus-visible:ring-[#4a3728]"
                    />
                    
                    <Button type="submit" size="icon" className="h-9 w-9 bg-[#4a3728] hover:bg-[#2c1e12] transition-transform active:scale-95">
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}