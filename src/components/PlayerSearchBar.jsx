import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, User, Loader2, Circle, Sword, Eye, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/components/LanguageContext';
import { toast } from 'sonner';

export default function PlayerSearchBar() {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const wrapperRef = useRef(null);
    const [activeGamesMap, setActiveGamesMap] = useState({});

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const searchUsers = async () => {
            if (!query.trim()) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const users = await base44.entities.User.list();
                const filtered = users.filter(u => 
                    (u.username && u.username.toLowerCase().includes(query.toLowerCase())) || 
                    (u.full_name && u.full_name.toLowerCase().includes(query.toLowerCase()))
                ).slice(0, 5);
                
                // Fetch active games for these users
                const gamesMap = {};
                await Promise.all(filtered.map(async (u) => {
                    const games = await base44.entities.Game.filter({ 
                        status: 'playing', 
                        $or: [{white_player_id: u.id}, {black_player_id: u.id}] 
                    });
                    // Client side filtering because SDK might not support complex OR queries in one go perfectly or to be safe
                    // Actually the SDK filter is limited. Let's check 'playing' games where player is white OR black.
                    // Better: 
                    const white = await base44.entities.Game.filter({ white_player_id: u.id, status: 'playing' });
                    const black = await base44.entities.Game.filter({ black_player_id: u.id, status: 'playing' });
                    const active = [...white, ...black][0]; // Just take first one
                    if (active) gamesMap[u.id] = active.id;
                }));
                
                setActiveGamesMap(gamesMap);
                setResults(filtered);
                setIsOpen(true);
            } catch (e) {
                console.error("Search error", e);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleProfile = (user) => {
        navigate(`/Profile?id=${user.id}`);
        setIsOpen(false);
        setQuery('');
    };

    const handleInvite = async (e, user) => {
        e.stopPropagation();
        // Quick invite: Create private game (Checkers default) and invite
        try {
            const currentUser = await base44.auth.me();
            if (!currentUser) return;

            const { initializeBoard } = await import('@/components/checkersLogic');
            const initialBoard = JSON.stringify(initializeBoard());
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();

            const newGame = await base44.entities.Game.create({
                status: 'waiting',
                game_type: 'checkers',
                white_player_id: currentUser.id,
                white_player_name: currentUser.full_name || 'Hôte',
                current_turn: 'white',
                board_state: initialBoard,
                is_private: true,
                access_code: code,
                initial_time: 10,
                increment: 0
            });

            await base44.entities.Invitation.create({
                from_user_id: currentUser.id,
                from_user_name: currentUser.full_name || currentUser.email,
                to_user_email: user.email,
                game_type: 'checkers',
                game_id: newGame.id,
                status: 'pending'
            });

            await base44.functions.invoke('sendNotification', {
                recipient_id: user.id,
                type: "game_invite",
                title: "Invitation",
                message: `${currentUser.full_name} vous invite à jouer`,
                link: `/Game?id=${newGame.id}`,
                metadata: { gameId: newGame.id }
            });

            navigate(`/Game?id=${newGame.id}`);
            setIsOpen(false);
            setQuery('');
        } catch (err) {
            console.error(err);
            toast.error("Erreur lors de l'invitation");
        }
    };

    const handleSpectate = (e, gameId) => {
        e.stopPropagation();
        navigate(`/Game?id=${gameId}`);
        setIsOpen(false);
        setQuery('');
    };

    const isOnline = (lastSeen) => {
        if (!lastSeen) return false;
        const diff = Date.now() - new Date(lastSeen).getTime();
        return diff < 5 * 60 * 1000; // 5 minutes
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-md mx-auto mb-6">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-[#4a3728] transition-colors" />
                <Input 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && results.length > 0 && setIsOpen(true)}
                    placeholder={t('common.search_player_placeholder')}
                    className="pl-10 h-10 bg-white/90 border-[#d4c5b0] focus:bg-white focus:ring-[#4a3728] shadow-sm transition-all"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#4a3728] w-4 h-4 animate-spin" />}
            </div>
            
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-[#d4c5b0] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {results.map(user => {
                        const online = isOnline(user.last_seen);
                        const playingGameId = activeGamesMap[user.id];
                        
                        return (
                            <div 
                                key={user.id}
                                onClick={() => handleProfile(user)}
                                className="flex items-center justify-between p-3 hover:bg-[#f5f0e6] cursor-pointer transition-colors border-b border-gray-50 last:border-none group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0 border border-white shadow-sm">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-4 h-4 text-gray-500" />
                                            )}
                                        </div>
                                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} title={online ? "En ligne" : "Hors ligne"} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[#4a3728] flex items-center gap-2">
                                            {user.username || user.full_name}
                                            {playingGameId && (
                                                <span className="flex items-center text-[10px] text-amber-600 font-normal bg-amber-100 px-1.5 rounded-full animate-pulse">
                                                    <Gamepad2 className="w-3 h-3 mr-0.5" /> Joue
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-medium">
                                            {user.elo_checkers ? `Dames: ${user.elo_checkers}` : ''} 
                                            {user.elo_checkers && user.elo_chess ? ' • ' : ''}
                                            {user.elo_chess ? `Échecs: ${user.elo_chess}` : ''}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {playingGameId ? (
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-8 w-8 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                                            onClick={(e) => handleSpectate(e, playingGameId)}
                                            title="Regarder"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700"
                                            onClick={(e) => handleInvite(e, user)}
                                            title="Inviter à jouer"
                                        >
                                            <Sword className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}