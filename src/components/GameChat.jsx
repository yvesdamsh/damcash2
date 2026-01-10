import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { safeJSONParse } from '@/components/utils/errorHandler';
import { useRealTime } from '@/components/RealTimeContext';

const EMOJIS = ["😀", "😂", "😍", "😎", "🤔", "😅", "😭", "😡", "👍", "👎", "👏", "🔥", "❤️", "💔", "👋"];

export default function GameChat({ gameId, currentUser, socket, players, externalMessages }) {
    const { t } = useLanguage();
    const { chatByGame, sendGameChat } = useRealTime();
    const [messages, setMessages] = useState([]);
    
    // Sync with shared chat store and external push-in
    useEffect(() => {
        setMessages(chatByGame[gameId] || []);
    }, [chatByGame, gameId]);

    useEffect(() => {
        if (externalMessages && externalMessages.length) {
            setMessages(prev => {
                const known = new Set(prev.map(m => m.id));
                const extra = externalMessages.filter(m => !known.has(m.id));
                return extra.length ? [...prev, ...extra] : prev;
            });
        }
    }, [externalMessages]);

    const quickReplies = [
        t('chat.quick.well_played'),
        t('chat.quick.thanks'),
        t('chat.quick.oops'),
        t('chat.quick.good_game'),
        t('chat.quick.thinking'),
        t('chat.quick.hurry')
    ];
    const [newMessage, setNewMessage] = useState('');
    const scrollRef = useRef(null);

    // Internal polling removed in favor of parent component polling
    // But we keep initial fetch just in case parent hasn't loaded yet
    useEffect(() => {
        if (!gameId) return;
        const initialFetch = async () => {
            try {
                const history = await base44.entities.ChatMessage.filter({ game_id: gameId }, 'created_date', 50);
                setMessages(history);
            } catch (e) {}
        };
        // Only fetch if we don't have messages yet
        if (messages.length === 0) initialFetch();
    }, [gameId]);

    // Chat updates handled via RealTimeContext

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Polling intelligent des messages de chat (pausé si WS ouvert, backoff simple)
    useEffect(() => {
      if (!gameId) return;
      let timer = null;
      let canceled = false;
      let inFlight = false;

      const shouldPoll = () => {
        if (typeof document !== 'undefined' && document.hidden) return false;
        const open = socket && socket.readyState === WebSocket.OPEN;
        return !open; // on poll uniquement si le WS n'est pas ouvert
      };

      const tick = async () => {
        if (canceled) return;
        if (!shouldPoll()) { timer = setTimeout(tick, 1500); return; }
        if (inFlight) { timer = setTimeout(tick, 2000); return; }
        inFlight = true;
        try {
          const msgs = await base44.entities.ChatMessage.filter({ game_id: gameId }, 'created_date', 200);
          if (JSON.stringify(msgs) !== JSON.stringify(chatByGame[gameId])) {
            setMessages(msgs || []);
          }
        } catch (e) {}
        finally {
          inFlight = false;
          if (!canceled) timer = setTimeout(tick, 2000);
        }
      };

      tick();
      return () => { canceled = true; if (timer) clearTimeout(timer); };
    }, [gameId, chatByGame, socket]);

    const handleSend = async (e, contentOverride) => {
        if (e) e.preventDefault();
        const textToSend = contentOverride || newMessage.trim();
        
        if (!textToSend || !currentUser) return;

        if (!contentOverride) setNewMessage('');

        await sendGameChat({ socket, gameId, currentUser, content: textToSend });
    };

    if (!currentUser) return <div className="p-4 text-center text-gray-500 text-sm">{t('chat.login_required')}</div>;

    return (
        <div className="flex flex-col h-full bg-[#fdfbf7]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-xs italic mt-4">
                        <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-20" />
                        {t('chat.start')}
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
                                    {!isMe && (
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <div className="text-[10px] font-bold opacity-70 text-[#4a3728]">{msg.sender_name}</div>
                                            {players && (msg.sender_id !== players.white && msg.sender_id !== players.black) && (
                                                <span className="text-[8px] bg-gray-200 px-1 rounded text-gray-500 uppercase tracking-wide">{t('game.spectator')}</span>
                                            )}
                                        </div>
                                    )}
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
            {/* Quick Replies & Input */}
            <div className="p-2 border-t border-[#d4c5b0] bg-white space-y-2">
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {quickReplies.map((reply, i) => (
                        <button
                            key={i}
                            onClick={() => handleSend(null, reply)}
                            className="whitespace-nowrap px-2 py-1 rounded-full bg-[#f5f0e6] text-[#4a3728] text-[10px] hover:bg-[#e8dcc5] transition-colors border border-[#d4c5b0]"
                        >
                            {reply}
                        </button>
                    ))}
                </div>
                
                <form onSubmit={handleSend} className="flex gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-[#6b5138] hover:bg-[#f5f0e6]">
                                <Smile className="w-5 h-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" side="top">
                            <div className="grid grid-cols-5 gap-2">
                                {EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setNewMessage(prev => prev + emoji)}
                                        className="text-xl hover:bg-slate-100 rounded p-1 transition-colors"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t('chat.placeholder')}
                        className="flex-1 border-[#d4c5b0] focus-visible:ring-[#4a3728] h-9 text-sm"
                    />
                    <Button type="submit" size="icon" className="bg-[#4a3728] hover:bg-[#2c1e12] h-9 w-9 shrink-0">
                        <Send className="w-4 h-4 text-[#e8dcc5]" />
                    </Button>
                </form>
            </div>
        </div>
    );
}