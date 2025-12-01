import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare } from 'lucide-react';

export default function GameChat({ gameId, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef(null);

    // Polling for messages
    useEffect(() => {
        if (!gameId) return;

        const fetchMessages = async () => {
            try {
                // Sorting by created_date is automatic usually, but let's ensure
                const msgs = await base44.entities.ChatMessage.list({
                   "game_id": gameId 
                }, { "created_date": 1 }, 50);
                setMessages(msgs);
            } catch (error) {
                console.error("Error fetching messages", error);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [gameId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await base44.entities.ChatMessage.create({
                game_id: gameId,
                sender_id: currentUser.id,
                sender_name: currentUser.full_name || currentUser.email.split('@')[0],
                content: newMessage.trim()
            });
            setNewMessage("");
            // Optimistic update could happen here but polling will catch it
        } catch (error) {
            console.error("Error sending message", error);
        }
    };

    return (
        <div className="bg-[#fff8f0] rounded-lg border-2 border-[#d4c5b0] shadow-md flex flex-col h-[300px] md:h-[400px]">
            <div className="bg-[#e8dcc5] p-3 border-b border-[#d4c5b0] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#5c4430]" />
                <h3 className="font-bold text-[#5c4430] text-sm">Chat en direct</h3>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-white/50">
                {messages.length === 0 && (
                    <p className="text-center text-gray-400 text-xs italic mt-4">Aucun message. Dites bonjour !</p>
                )}
                {messages.map((msg) => {
                    const isMe = msg.sender_id === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[80%] rounded-lg p-2 text-xs md:text-sm
                                ${isMe 
                                    ? 'bg-[#6b5138] text-white rounded-br-none' 
                                    : 'bg-[#e8dcc5] text-[#4a3728] rounded-bl-none'
                                }
                            `}>
                                <p className="font-bold text-[10px] opacity-70 mb-0.5">{msg.sender_name}</p>
                                <p>{msg.content}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={handleSend} className="p-2 border-t border-[#d4c5b0] bg-white flex gap-2">
                <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className="h-8 text-sm"
                />
                <Button type="submit" size="sm" className="h-8 w-8 p-0 bg-[#6b5138] hover:bg-[#5c4430]">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}