import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, MessageSquare, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Messages() {
    const [conversations, setConversations] = useState([]);
    const [selectedConvId, setSelectedConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [usersMap, setUsersMap] = useState({});
    
    const location = useLocation();
    const navigate = useNavigate();
    const scrollRef = useRef(null);

    // Fetch User & Conversations
    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);

                // Fetch all conversations (filtering client side as SDK limitation)
                const allConvos = await base44.entities.Conversation.list('-last_message_at', 50);
                const myConvos = allConvos.filter(c => c.participants.includes(u.id));
                
                // Fetch participants details
                const participantIds = new Set();
                myConvos.forEach(c => c.participants.forEach(pid => participantIds.add(pid)));
                const allUsers = await base44.entities.User.list(); // Optim: fetch only needed if possible
                const uMap = {};
                allUsers.forEach(usr => uMap[usr.id] = usr);
                setUsersMap(uMap);
                
                setConversations(myConvos);

                // Check URL param
                const params = new URLSearchParams(location.search);
                const urlConvId = params.get('conversationId');
                const urlUserId = params.get('userId');

                if (urlConvId && myConvos.find(c => c.id === urlConvId)) {
                    setSelectedConvId(urlConvId);
                } else if (urlUserId) {
                    // Try to find existing conversation with this user
                    const existing = myConvos.find(c => c.participants.includes(urlUserId));
                    if (existing) {
                        setSelectedConvId(existing.id);
                    } else {
                        // Create new conversation if it doesn't exist
                        try {
                            const newConv = await base44.entities.Conversation.create({
                                participants: [u.id, urlUserId],
                                last_message_at: new Date().toISOString(),
                                last_message_preview: 'Nouvelle conversation'
                            });
                            setConversations(prev => [newConv, ...prev]);
                            setSelectedConvId(newConv.id);
                            
                            // Fetch user details if not already in map
                            if (!uMap[urlUserId]) {
                                const targetUser = await base44.entities.User.get(urlUserId);
                                setUsersMap(prev => ({...prev, [urlUserId]: targetUser}));
                            }
                        } catch (err) {
                            console.error("Error creating conversation", err);
                        }
                    }
                } else if (myConvos.length > 0 && window.innerWidth >= 768) {
                    setSelectedConvId(myConvos[0].id);
                }

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Fetch Messages for selected conversation
    useEffect(() => {
        if (!selectedConvId) return;
        
        const fetchMessages = async () => {
            const msgs = await base44.entities.DirectMessage.filter({ conversation_id: selectedConvId }, 'created_at', 50);
            // Sort by date asc
            setMessages(msgs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
            
            // Mark as read logic could go here
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 30000); // Poll for new messages
        return () => clearInterval(interval);
    }, [selectedConvId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConvId) return;

        const conversation = conversations.find(c => c.id === selectedConvId);
        const recipientId = conversation.participants.find(p => p !== user.id);

        try {
            // Optimistic update
            const tempMsg = {
                id: 'temp-' + Date.now(),
                conversation_id: selectedConvId,
                sender_id: user.id,
                content: newMessage,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, tempMsg]);
            setNewMessage("");

            // Send via backend function to handle notifications
            await base44.functions.invoke('sendDirectMessage', {
                recipientId,
                content: tempMsg.content
            });
            
            // Update conversation list preview locally
            setConversations(prev => prev.map(c => 
                c.id === selectedConvId 
                ? { ...c, last_message_at: new Date().toISOString(), last_message_preview: tempMsg.content }
                : c
            ).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)));

        } catch (e) {
            console.error("Send failed", e);
        }
    };

    const getOtherParticipant = (conv) => {
        if (!user) return null;
        const otherId = conv.participants.find(p => p !== user.id) || user.id; // Fallback to self if solo chat
        return usersMap[otherId] || { username: 'Utilisateur inconnu', avatar_url: null };
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-[#4a3728]" /></div>;

    return (
        <div className="h-[calc(100vh-100px)] max-w-6xl mx-auto p-4 flex gap-4">
            {/* Sidebar (Conversations) */}
            <Card className={`flex-col w-full md:w-1/3 lg:w-1/4 border-[#d4c5b0] bg-white/90 ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-[#e8dcc5] bg-[#fdfbf7]">
                    <h2 className="font-bold text-[#4a3728] flex items-center gap-2 text-xl">
                        <MessageSquare className="w-5 h-5" /> Messages
                    </h2>
                </div>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-[#f0e6d2]">
                        {conversations.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Aucune conversation</div>
                        ) : (
                            conversations.map(conv => {
                                const other = getOtherParticipant(conv);
                                return (
                                    <div 
                                        key={conv.id}
                                        onClick={() => setSelectedConvId(conv.id)}
                                        className={`p-4 cursor-pointer hover:bg-[#f0e6d2] transition-colors flex gap-3 items-center ${selectedConvId === conv.id ? 'bg-[#f5f0e6] border-l-4 border-[#4a3728]' : ''}`}
                                    >
                                        <Avatar>
                                            <AvatarImage src={other.avatar_url} />
                                            <AvatarFallback>{other.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <span className="font-bold text-[#4a3728] truncate">{other.username || other.full_name}</span>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                    {conv.last_message_at ? format(new Date(conv.last_message_at), 'dd/MM') : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate mt-1">
                                                {conv.last_message_preview || 'Nouvelle conversation'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </Card>

            {/* Chat Area */}
            <Card className={`flex-col flex-1 border-[#d4c5b0] bg-white/90 relative ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
                {!selectedConvId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <p>Sélectionnez une conversation pour commencer</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-[#e8dcc5] bg-[#fdfbf7] flex items-center gap-3 shadow-sm z-10">
                            <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setSelectedConvId(null)}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            {(() => {
                                const conv = conversations.find(c => c.id === selectedConvId);
                                const other = getOtherParticipant(conv);
                                return (
                                    <>
                                        <Avatar className="border-2 border-white shadow-sm">
                                            <AvatarImage src={other.avatar_url} />
                                            <AvatarFallback>{other.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-bold text-[#4a3728]">{other.username || other.full_name}</div>
                                            <div className={`text-xs ${Date.now() - new Date(other.last_seen).getTime() < 5 * 60 * 1000 ? 'text-green-600' : 'text-gray-400'} flex items-center gap-1`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${Date.now() - new Date(other.last_seen).getTime() < 5 * 60 * 1000 ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                {Date.now() - new Date(other.last_seen).getTime() < 5 * 60 * 1000 ? 'En ligne' : 'Hors ligne'}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcf9f5]" ref={scrollRef}>
                            {messages.map(msg => {
                                const isMe = msg.sender_id === user.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm text-sm ${
                                            isMe 
                                            ? 'bg-[#4a3728] text-white rounded-tr-none' 
                                            : 'bg-white text-gray-800 border border-[#e8dcc5] rounded-tl-none'
                                        }`}>
                                            <p>{msg.content}</p>
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                                                {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : '...'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-white border-t border-[#d4c5b0]">
                            <form onSubmit={handleSend} className="flex gap-2">
                                <Input 
                                    value={newMessage} 
                                    onChange={e => setNewMessage(e.target.value)}
                                    placeholder="Écrivez votre message..."
                                    className="bg-[#f5f0e6] border-none focus-visible:ring-[#4a3728]"
                                />
                                <Button type="submit" className="bg-[#4a3728] hover:bg-[#2c1e12] text-white shadow-md">
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}