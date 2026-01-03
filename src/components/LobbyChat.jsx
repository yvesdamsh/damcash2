import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User, Users, Hash } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { logger } from '@/utils/logger';

export default function LobbyChat({ channelId, channelName, currentUser, height = "500px" }) {
    const { t, formatDate } = useLanguage();
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

    useEffect(() => {
        if (!channelId) return;

        const loadMessages = async () => {
            try {
                const msgs = await base44.entities.ChannelMessage.filter({ channel_id: channelId }, '-created_at', 50);
                setMessages(msgs.reverse());
            } catch (e) {
                logger.error("Error loading messages", e);
            }
        };
        loadMessages();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/functions/channelSocket?channelId=${channelId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => logger.log(`Connected to ${channelId} Chat`);
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'CHAT_MESSAGE') {
                    setMessages(prev => [...prev, data.payload]);
                }
            } catch (e) {
                logger.error(e);
            }
        };

        setSocket(ws);

        return () => {
            if (ws) ws.close();
        };
    }, [channelId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        const msgData = {
            channel_id: channelId,
            sender_id: currentUser.id,
            sender_name: currentUser.full_name || currentUser.username || t('common.anonymous'),
            sender_avatar: currentUser.avatar_url,
            content: newMessage,
            created_at: new Date().toISOString()
        };

        try {
            await base44.entities.ChannelMessage.create(msgData);
            
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'CHAT_MESSAGE',
                    payload: msgData
                }));
            }
            setNewMessage('');
        } catch (e) {
            logger.error("Error sending message", e);
        }
    };

    return (
        <div className={`flex flex-col bg-white rounded-lg border border-[#d4c5b0] shadow-sm h-full max-h-[${height}]`}>
            <div className="p-3 bg-[#f5f0e6] border-b border-[#d4c5b0] font-bold text-[#4a3728] flex items-center gap-2">
                {channelId === 'global' ? <Hash className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {channelName}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfbf7] min-h-[300px]">
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
                            <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-bold text-[#6b5138]">{msg.sender_name}</span>
                                    <span className="text-[10px] text-gray-400">
                                        {msg.created_at && formatDate(msg.created_at, 'HH:mm')}
                                    </span>
                                </div>
                                <div className={`px-3 py-2 rounded-lg text-sm break-words ${
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
                    placeholder={currentUser ? t('chat.placeholder') : t('chat.login')}
                    disabled={!currentUser}
                    className="bg-white border-[#d4c5b0]"
                />
                <Button 
                    type="submit" 
                    disabled={!currentUser || !newMessage.trim()}
                    size="icon"
                    className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] shrink-0"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}