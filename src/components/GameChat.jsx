import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export default function GameChat({ gameId, currentUser, socket }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const scrollRef = useRef(null);

    // Fetch history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await base44.entities.ChatMessage.list({ game_id: gameId }, { created_date: 1 }, 50);
                setMessages(history);
            } catch (e) {
                console.error("Failed to load chat history", e);
            }
        };
        if (gameId) fetchHistory();
    }, [gameId]);

    // Handle Socket Messages
    useEffect(() => {
        if (!socket) return;

        const handleMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'CHAT_UPDATE') {
                    setMessages(prev => {
                        // Dedup check
                        if (prev.some(m => m.id === data.payload.id)) return prev;
                        return [...prev, data.payload];
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };

        socket.addEventListener('message', handleMessage);
        return () => socket.removeEventListener('message', handleMessage);
    }, [socket]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        const content = newMessage.trim();
        setNewMessage('');

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'CHAT_MESSAGE',
                payload: {
                    sender_id: currentUser.id,
                    sender_name: currentUser.full_name || currentUser.username || 'Joueur',
                    content
                }
            }));
        } else {
            // Fallback HTTP
            try {
                const msg = await base44.entities.ChatMessage.create({
                    game_id: gameId,
                    sender_id: currentUser.id,
                    sender_name: currentUser.full_name || currentUser.username || 'Joueur',
                    content
                });
                setMessages(prev => [...prev, msg]);
            } catch (e) {
                console.error("Send error", e);
            }
        }
    };

    if (!currentUser) return <div className="p-4 text-center text-gray-500 text-sm">Connectez-vous pour chatter</div>;

    return (
        <div className="flex flex-col h-full bg-[#fdfbf7]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-xs italic mt-4">
                        <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-20" />
                        Début de la discussion...
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.sender_id === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div 
                                    className={`px-3 py-2 rounded-lg text-sm shadow-sm break-words ${
                                        isMe 
                                            ? 'bg-[#6b5138] text-[#e8dcc5]' 
                                            : 'bg-white border border-[#d4c5b0] text-gray-800'
                                    }`}
                                >
                                    {!isMe && <div className="text-[10px] font-bold opacity-70 mb-0.5 text-[#4a3728]">{msg.sender_name}</div>}
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-gray-400 min-w-[30px] text-center">
                                    {msg.created_date ? format(new Date(msg.created_date), 'HH:mm') : ''}
                                </span>
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
                    className="flex-1 border-[#d4c5b0] focus-visible:ring-[#4a3728] h-9 text-sm"
                />
                <Button type="submit" size="icon" className="bg-[#4a3728] hover:bg-[#2c1e12] h-9 w-9 shrink-0">
                    <Send className="w-4 h-4 text-[#e8dcc5]" />
                </Button>
            </form>
        </div>
    );
}