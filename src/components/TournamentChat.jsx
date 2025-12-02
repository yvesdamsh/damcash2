import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function TournamentChat({ tournamentId, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initial Load
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const msgs = await base44.entities.TournamentMessage.filter({ tournament_id: tournamentId }, '-created_date', 50);
                setMessages(msgs.reverse()); // Show oldest first in list
            } catch (e) {
                console.error("Error loading messages", e);
            }
        };
        loadMessages();

        // Socket Connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/functions/tournamentSocket?tournamentId=${tournamentId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => console.log('Connected to Tournament Chat');
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'CHAT_MESSAGE') {
                    setMessages(prev => [...prev, data.payload]);
                }
            } catch (e) {
                console.error(e);
            }
        };

        setSocket(ws);

        return () => {
            if (ws) ws.close();
        };
    }, [tournamentId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        const msgData = {
            tournament_id: tournamentId,
            sender_id: currentUser.id,
            sender_name: currentUser.full_name || currentUser.username || 'Anonyme',
            sender_avatar: currentUser.avatar_url,
            content: newMessage,
            created_date: new Date().toISOString() // Optimistic timestamp
        };

        try {
            // 1. Persist
            await base44.entities.TournamentMessage.create(msgData);
            
            // 2. Broadcast (or let socket handle it if we rely purely on socket for realtime)
            // In this pattern, we persist first, then tell socket to broadcast to others (or just us)
            // But wait, if we persist, we don't get the ID immediately unless we wait. 
            // The socket handler in backend is a simple relay.
            
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'CHAT_MESSAGE',
                    payload: msgData
                }));
            }

            // We can optimistically add it, but the socket will send it back to us too.
            // If we add it here AND receive it from socket, we get duplicates.
            // Simple fix: don't add locally, wait for socket echo.
            // Or: add locally and ignore socket echo if ID matches (but we don't have ID yet).
            // Let's just wait for socket echo for simplicity, it's fast enough.
            
            setNewMessage('');
        } catch (e) {
            console.error("Error sending message", e);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-lg border border-[#d4c5b0] shadow-sm">
            <div className="p-4 bg-[#f5f0e6] border-b border-[#d4c5b0] font-bold text-[#4a3728]">
                Chat du Tournoi
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfbf7]">
                {messages.map((msg, idx) => {
                    const isMe = currentUser && msg.sender_id === currentUser.id;
                    return (
                        <div key={idx} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-[#d4c5b0]">
                                {msg.sender_avatar ? (
                                    <img src={msg.sender_avatar} alt={msg.sender_name} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-full h-full p-1.5 text-gray-400" />
                                )}
                            </div>
                            <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-bold text-[#6b5138]">{msg.sender_name}</span>
                                    <span className="text-[10px] text-gray-400">
                                        {msg.created_date && format(new Date(msg.created_date), 'HH:mm', { locale: fr })}
                                    </span>
                                </div>
                                <div className={`px-3 py-2 rounded-lg text-sm ${
                                    isMe 
                                    ? 'bg-[#4a3728] text-[#e8dcc5] rounded-tr-none' 
                                    : 'bg-white border border-[#d4c5b0] text-gray-800 rounded-tl-none'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-[#d4c5b0] bg-[#f5f0e6] flex gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={currentUser ? "Envoyer un message..." : "Connectez-vous pour chatter"}
                    disabled={!currentUser}
                    className="bg-white border-[#d4c5b0]"
                />
                <Button 
                    type="submit" 
                    disabled={!currentUser || !newMessage.trim()}
                    className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}