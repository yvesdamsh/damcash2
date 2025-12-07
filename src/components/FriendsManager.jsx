import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, UserPlus, Search, Check, X, MessageSquare, Gamepad2, Circle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import DirectChat from './DirectChat';

export default function FriendsManager() {
    const [isOpen, setIsOpen] = useState(false);
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeChatFriend, setActiveChatFriend] = useState(null);
    const [challengeConfigOpen, setChallengeConfigOpen] = useState(false);
    const [challengeTarget, setChallengeTarget] = useState(null);
    const [challengeConfig, setChallengeConfig] = useState({ time: 10, increment: 0, gameType: 'checkers' });
    const navigate = useNavigate();

    // Listen for open-chat events from Notifications
    useEffect(() => {
        const handleOpenChat = (e) => {
            const { senderId } = e.detail;
            if (senderId) {
                // We need to fetch the user details to open chat
                base44.entities.User.get(senderId).then(user => {
                    if (user) {
                        setActiveChatFriend(user);
                        setIsOpen(false); // Close list if open
                    }
                });
            }
        };

        window.addEventListener('open-chat', handleOpenChat);
        return () => window.removeEventListener('open-chat', handleOpenChat);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);
            if (!user) return;

            // Fetch friendships where user is requester or recipient
            const [asRequester, asRecipient] = await Promise.all([
                base44.entities.Friendship.filter({ requester_id: user.id }),
                base44.entities.Friendship.filter({ recipient_id: user.id })
            ]);

            const friendList = [];
            const requestList = [];

            // Process asRequester
            for (const f of asRequester) {
                if (f.status === 'accepted') {
                    friendList.push({ friendshipId: f.id, userId: f.recipient_id });
                }
            }

            // Process asRecipient
            for (const f of asRecipient) {
                if (f.status === 'accepted') {
                    friendList.push({ friendshipId: f.id, userId: f.requester_id });
                } else if (f.status === 'pending') {
                    requestList.push({ friendshipId: f.id, userId: f.requester_id });
                }
            }

            // Fetch User details for friends
            const enrichedFriends = await Promise.all(friendList.map(async (f) => {
                try {
                    const u = await base44.entities.User.get(f.userId);
                    return { ...u, friendshipId: f.friendshipId };
                } catch { return null; }
            }));
            setFriends(enrichedFriends.filter(Boolean));

            // Fetch User details for requests
            const enrichedRequests = await Promise.all(requestList.map(async (r) => {
                try {
                    const u = await base44.entities.User.get(r.userId);
                    return { ...u, friendshipId: r.friendshipId };
                } catch { return null; }
            }));
            setRequests(enrichedRequests.filter(Boolean));

        } catch (e) {
            console.error("Error loading friends", e);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            // Simple search by username or email (exact match or contains depending on API capability, usually exact or regex if supported, let's assume exact for safety or list and filter)
            // Since we can't do LIKE query easily on all fields, we list and filter client side or use specific filter
            // Optimization: Backend function for search would be better, but let's try client side filter of list() for now if small userbase, else use exact email match.
            // Assuming filter supports partial? No, usually exact. Let's try listing all users (bad for scale) or just assume exact email/username match for now.
            // Let's try exact email match first.
            
            const users = await base44.entities.User.list(); // BAD for scale, but limited tools right now.
            const filtered = users.filter(u => 
                u.id !== currentUser.id && 
                ((u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) || 
                 (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())))
            );
            setSearchResults(filtered.slice(0, 5));
        } catch (e) {
            console.error(e);
        }
    };

    const sendRequest = async (targetId) => {
        try {
            const res = await base44.functions.invoke('sendFriendRequest', { targetId });
            if (res.data?.error) {
                toast.error(res.data.error);
                return;
            }

            toast.success("Demande envoyée");
            setSearchResults(prev => prev.filter(u => u.id !== targetId));
        } catch (e) {
            toast.error("Erreur lors de l'envoi");
        }
    };

    const acceptRequest = async (friendshipId, requesterId) => {
        try {
            await base44.entities.Friendship.update(friendshipId, { status: 'accepted' });
            toast.success("Ami ajouté !");
            
            // Notify requester
            await base44.functions.invoke('sendNotification', {
                recipient_id: requesterId,
                type: "success",
                title: "Demande acceptée",
                message: `${currentUser.username || 'Votre ami'} a accepté votre demande.`
            });

            loadData();
        } catch (e) {
            toast.error("Erreur");
        }
    };

    const rejectRequest = async (friendshipId) => {
        try {
            await base44.entities.Friendship.delete(friendshipId);
            loadData();
        } catch (e) { console.error(e); }
    };

    const openChallengeModal = (friend) => {
        setChallengeTarget(friend);
        setChallengeConfigOpen(true);
        setIsOpen(false); // Close friend list
    };

    const handleSendChallenge = async () => {
        if (!challengeTarget) return;
        
        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            let initialBoard = '[]';
            if (challengeConfig.gameType === 'checkers') {
                const { initializeBoard } = await import('@/components/checkersLogic');
                initialBoard = JSON.stringify(initializeBoard());
            } else {
                const { initializeChessBoard } = await import('@/components/chessLogic');
                initialBoard = JSON.stringify({ board: initializeChessBoard(), castlingRights: { wK: true, wQ: true, bK: true, bQ: true }, lastMove: null });
            }

            const game = await base44.entities.Game.create({
                status: 'waiting',
                game_type: challengeConfig.gameType,
                white_player_id: currentUser.id,
                white_player_name: currentUser.username || 'Hôte',
                current_turn: 'white',
                board_state: initialBoard,
                is_private: true,
                access_code: code,
                initial_time: challengeConfig.time,
                increment: challengeConfig.increment,
                white_seconds_left: challengeConfig.time * 60,
                black_seconds_left: challengeConfig.time * 60,
                series_length: 1
            });

            await base44.entities.Invitation.create({
                from_user_id: currentUser.id,
                from_user_name: currentUser.username || 'Ami',
                to_user_email: challengeTarget.email,
                game_type: challengeConfig.gameType,
                game_id: game.id,
                status: 'pending'
            });

            await base44.functions.invoke('sendNotification', {
                recipient_id: challengeTarget.id,
                type: "game_invite",
                title: "Défi reçu",
                message: `${currentUser.username || 'Ami'} vous défie aux ${challengeConfig.gameType === 'chess' ? 'Échecs' : 'Dames'} (${challengeConfig.time}+${challengeConfig.increment})`,
                link: `/Game?id=${game.id}`,
                metadata: { gameId: game.id }
            });

            toast.success(`Défi envoyé à ${challengeTarget.username}`);
            navigate(`/Game?id=${game.id}`);
            setChallengeConfigOpen(false);
            setChallengeTarget(null);
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors du défi");
        }
    };

    return (
        <>
            {activeChatFriend && <DirectChat friend={activeChatFriend} currentUser={currentUser} onClose={() => setActiveChatFriend(null)} />}
            
            <Dialog open={challengeConfigOpen} onOpenChange={setChallengeConfigOpen}>
                <DialogContent className="sm:max-w-[400px] bg-[#fdfbf7] border-[#d4c5b0]">
                    <DialogHeader>
                        <DialogTitle className="text-[#4a3728]">Défier {challengeTarget?.username}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Jeu</label>
                            <div className="flex gap-2">
                                <Button variant={challengeConfig.gameType === 'checkers' ? "default" : "outline"} onClick={() => setChallengeConfig({...challengeConfig, gameType: 'checkers'})} className="flex-1">Dames</Button>
                                <Button variant={challengeConfig.gameType === 'chess' ? "default" : "outline"} onClick={() => setChallengeConfig({...challengeConfig, gameType: 'chess'})} className="flex-1">Échecs</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Temps (min)</label>
                            <div className="flex gap-2 flex-wrap">
                                {[3, 5, 10, 15].map(t => (
                                    <Button key={t} size="sm" variant={challengeConfig.time === t ? "default" : "outline"} onClick={() => setChallengeConfig({...challengeConfig, time: t})}>{t}</Button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setChallengeConfigOpen(false)}>Annuler</Button>
                        <Button onClick={handleSendChallenge} className="bg-[#4a3728] hover:bg-[#2c1e12]">Envoyer Défi</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white">
                        <Users className="w-5 h-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0 border-[#4a3728] bg-[#fdfbf7]" align="end">
                    <div className="p-4 border-b border-[#d4c5b0] bg-[#4a3728] text-[#e8dcc5]">
                        <h4 className="font-bold flex items-center gap-2">
                            <Users className="w-4 h-4" /> Amis & Contacts
                        </h4>
                    </div>
                
                <Tabs defaultValue="list" className="w-full">
                    <TabsList className="w-full grid grid-cols-2 rounded-none bg-[#e8dcc5] p-0">
                        <TabsTrigger value="list" className="data-[state=active]:bg-[#fdfbf7] rounded-none border-b-2 border-transparent data-[state=active]:border-[#4a3728]">Mes Amis</TabsTrigger>
                        <TabsTrigger value="add" className="data-[state=active]:bg-[#fdfbf7] rounded-none border-b-2 border-transparent data-[state=active]:border-[#4a3728]">Ajouter</TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="p-0 m-0">
                        <ScrollArea className="h-[300px] p-4">
                            {requests.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    <h5 className="text-xs font-bold uppercase text-gray-500">Demandes en attente</h5>
                                    {requests.map(req => (
                                        <div key={req.id} className="flex items-center justify-between bg-white p-2 rounded border border-yellow-200">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-8 h-8">
                                                    <AvatarImage src={req.avatar_url} />
                                                    <AvatarFallback>{req.username?.[0] || '?'}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium truncate max-w-[100px]">{req.username || `Joueur ${req.id.substring(0,4)}`}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => acceptRequest(req.friendshipId, req.id)}>
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={() => rejectRequest(req.friendshipId)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h5 className="text-xs font-bold uppercase text-gray-500 mb-2">Mes Amis ({friends.length})</h5>
                            {friends.length === 0 ? (
                                <p className="text-sm text-gray-400 italic text-center py-4">Aucun ami pour le moment</p>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map(friend => (
                                        <div key={friend.id} className="flex items-center justify-between group hover:bg-[#f0e6d2] p-2 rounded transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarImage src={friend.avatar_url} />
                                                        <AvatarFallback>{friend.username?.[0] || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${
                                                        (Date.now() - new Date(friend.last_seen).getTime() < 5 * 60 * 1000) ? 'bg-green-500' : 'bg-gray-300'
                                                    }`} title={(Date.now() - new Date(friend.last_seen).getTime() < 5 * 60 * 1000) ? "En ligne" : "Hors ligne"}></span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-[#4a3728]">{friend.username || `Joueur ${friend.id.substring(0,4)}`}</p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {(Date.now() - new Date(friend.last_seen).getTime() < 5 * 60 * 1000) ? "En ligne" : "Hors ligne"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-[#4a3728] hover:bg-[#d4c5b0]"
                                                    onClick={() => { setActiveChatFriend(friend); setIsOpen(false); }}
                                                    title="Message"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-[#4a3728] hover:bg-[#d4c5b0]"
                                                    onClick={() => openChallengeModal(friend)}
                                                    title="Défier"
                                                >
                                                    <Gamepad2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="add" className="p-4 m-0">
                        <div className="flex gap-2 mb-4">
                            <Input 
                                placeholder="Pseudo ou email..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="bg-white border-[#d4c5b0]"
                            />
                            <Button size="icon" onClick={handleSearch} className="bg-[#4a3728] hover:bg-[#2c1e12]">
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        <ScrollArea className="h-[240px]">
                            {searchResults.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={user.avatar_url} />
                                            <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium truncate w-32">{user.username || `Joueur ${user.id.substring(0,4)}`}</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => sendRequest(user.id)}>
                                        <UserPlus className="w-4 h-4 text-[#4a3728]" />
                                    </Button>
                                </div>
                            ))}
                            {searchResults.length === 0 && searchQuery && (
                                <p className="text-center text-sm text-gray-400 mt-4">Aucun utilisateur trouvé</p>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
        </>
    );
}