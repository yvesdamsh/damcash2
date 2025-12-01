import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, X, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';

export default function DirectChat({ friend, onClose, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [conversation, setConversation] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (!friend || !currentUser) return;
        
        let interval;
        const initChat = async () => {
            try {
                // Find existing conversation
                // This is tricky with current filter capabilities if we can't query arrays perfectly.
                // Workaround: List conversations and filter client side or assume we create one if not found.
                // Better: 'participants' filter support? 
                // Assuming we can filter by participants containing ID might be hard.
                // Let's try to fetch all conversations for current user? 
                // Actually, let's just list recent conversations or create a new one if we don't find it in a small list.
                // For robustness:
                // 1. Fetch all conversations where I am a participant (needs backend support or filtering list).
                // Let's try filtering by one participant if possible, or just fetching all.
                // Actually, let's rely on the fact that we can fetch all conversations and filter.
                
                const allConvos = await base44.entities.Conversation.list(); // Not scalable but works for now
                let conv = allConvos.find(c => 
                    c.participants.includes(currentUser.id) && 
                    c.participants.includes(friend.id)
                );

                if (!conv) {
                    // Create new if sending message, or just wait?
                    // Let's wait until first message to create? Or create now?
                    // Better to wait until send, but we need ID to listen.
                    // Let's create it if it doesn't exist to simplify.
                    conv = await base44.entities.Conversation.create({
                        participants: [currentUser.id, friend.id],
                        last_message_at: new Date().toISOString(),
                        last_message_preview: 'Démarrage de la conversation'
                    });
                }
                setConversation(conv);

                // Load messages
                const msgs = await base44.entities.DirectMessage.filter({ conversation_id: conv.id }, 'created_date', 50);
                // Sort by date asc
                setMessages(msgs.sort((a,b) => new Date(a.created_date) - new Date(b.created_date)));

                // Mark as read
                // (Optional: mark incoming messages as read)

            } catch (e) {
                console.error("Chat init error", e);
            }
        };

        initChat();

        // Polling
        interval = setInterval(async () => {
            if (conversation) {
                const msgs = await base44.entities.DirectMessage.filter({ conversation_id: conversation.id }, 'created_date', 50);
                setMessages(msgs.sort((a,b) => new Date(a.created_date) - new Date(b.created_date)));
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [friend, currentUser, conversation?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isMinimized]);

    const handleSend = async () => {
        if (!newMessage.trim() || !conversation) return;

        try {
            await base44.entities.DirectMessage.create({
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: newMessage,
                read: false
            });

            await base44.entities.Conversation.update(conversation.id, {
                last_message_at: new Date().toISOString(),
                last_message_preview: newMessage
            });

            // Send Notification to friend
            await base44.entities.Notification.create({
                recipient_id: friend.id,
                type: 'message',
                sender_id: currentUser.id,
                title: 'Nouveau message',
                message: `${currentUser.username || currentUser.full_name}: ${newMessage.substring(0, 30)}${newMessage.length > 30 ? '...' : ''}`,
                read: false
            });

            setNewMessage("");
            // Optimistic update
            setMessages(prev => [...prev, {
                id: 'temp-' + Date.now(),
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: newMessage,
                created_date: new Date().toISOString()
            }]);
        } catch (e) {
            console.error("Send error", e);
        }
    };

    if (!friend) return null;

    if (isMinimized) {
        return (
            <div className="fixed bottom-0 right-20 w-64 bg-white border border-[#d4c5b0] shadow-xl rounded-t-lg z-50">
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

    return (
        <div className="fixed bottom-0 right-20 w-80 bg-[#fdfbf7] border border-[#d4c5b0] shadow-2xl rounded-t-lg z-50 flex flex-col h-96">
            <div className="p-3 bg-[#4a3728] text-[#e8dcc5] rounded-t-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8 border border-[#e8dcc5]">
                        <AvatarImage src={friend.avatar_url} />
                        <AvatarFallback>{friend.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-bold text-sm">{friend.username || friend.full_name}</div>
                        <div className="text-[10px] text-green-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> En ligne</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Minimize2 className="w-4 h-4 cursor-pointer hover:text-white" onClick={() => setIsMinimized(true)} />
                    <X className="w-4 h-4 cursor-pointer hover:text-red-300" onClick={onClose} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f5f0e6]" ref={scrollRef}>
                {messages.map((msg) => {
                    const isMe = msg.sender_id === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-2 text-sm ${isMe ? 'bg-[#4a3728] text-white rounded-tr-none' : 'bg-white text-gray-800 border border-[#d4c5b0] rounded-tl-none'}`}>
                                <p>{msg.content}</p>
                                <span className="text-[10px] opacity-70 block text-right mt-1">
                                    {format(new Date(msg.created_date), 'HH:mm')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-3 bg-white border-t border-[#d4c5b0]">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        placeholder="Votre message..." 
                        className="h-9 text-sm"
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 bg-[#4a3728] hover:bg-[#2c1e12]">
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}