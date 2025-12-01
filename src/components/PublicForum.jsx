import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PublicForum() {
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState("");
    const [user, setUser] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
            } catch(e) {}
            fetchPosts();
        };
        init();

        const interval = setInterval(fetchPosts, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchPosts = async () => {
        try {
            const data = await base44.entities.ForumPost.list({}, { created_date: -1 }, 50);
            setPosts(data.reverse()); // Show newest at bottom like chat
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [posts]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newPost.trim() || !user) return;

        try {
            await base44.entities.ForumPost.create({
                author_id: user.id,
                author_name: user.full_name || user.username || "Anonyme",
                author_avatar: user.avatar_url,
                content: newPost.trim()
            });
            setNewPost("");
            fetchPosts();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden flex flex-col h-[500px]">
            <div className="bg-[#4a3728] p-3 flex items-center gap-2 text-[#e8dcc5]">
                <MessageCircle className="w-5 h-5" />
                <h3 className="font-bold">Forum Communautaire</h3>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfbf7]">
                {posts.map((post) => {
                    const isMe = user && post.author_id === user.id;
                    return (
                        <div key={post.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden border border-[#d4c5b0]">
                                {post.author_avatar ? <img src={post.author_avatar} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-1.5 text-gray-500" />}
                            </div>
                            <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-bold text-[#4a3728]">{post.author_name}</span>
                                    <span className="text-[10px] text-gray-400">
                                        {formatDistanceToNow(new Date(post.created_date), { addSuffix: true, locale: fr })}
                                    </span>
                                </div>
                                <div className={`px-3 py-2 rounded-lg text-sm shadow-sm ${isMe ? 'bg-[#6b5138] text-white rounded-tr-none' : 'bg-white border border-[#d4c5b0] text-gray-800 rounded-tl-none'}`}>
                                    {post.content}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {posts.length === 0 && (
                    <div className="text-center text-gray-400 italic mt-10">Soyez le premier à poster !</div>
                )}
            </div>

            <form onSubmit={handleSend} className="p-3 bg-[#f5f0e6] border-t border-[#d4c5b0] flex gap-2">
                <Input 
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder={user ? "Participez à la discussion..." : "Connectez-vous pour parler"}
                    disabled={!user}
                    className="bg-white"
                />
                <Button type="submit" disabled={!user || !newPost.trim()} className="bg-[#6b5138] hover:bg-[#5c4430]">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}