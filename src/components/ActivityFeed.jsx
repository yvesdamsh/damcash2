import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Activity, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function ActivityFeed() {
    const [activities, setActivities] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const loadActivities = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);

                // Get friends
                const friendships = await base44.entities.Friendship.filter({ requester_id: user.id, status: 'accepted' });
                const friendships2 = await base44.entities.Friendship.filter({ recipient_id: user.id, status: 'accepted' });
                
                const friendIds = [
                    ...friendships.map(f => f.recipient_id),
                    ...friendships2.map(f => f.requester_id)
                ];

                if (friendIds.length === 0) return;

                // Get finished games where a friend played
                // Note: Complex filtering like "white_player_id IN friendIds" might not be supported directly in one query depending on backend.
                // We'll fetch recent finished games and filter in memory for this MVP.
                // Ideally: backend function `getFriendActivity`.
                
                const recentGames = await base44.entities.Game.filter({ status: 'finished' }, '-updated_date', 100);
                
                const friendGames = recentGames.filter(g => 
                    (friendIds.includes(g.white_player_id) || friendIds.includes(g.black_player_id)) &&
                    g.white_player_id !== user.id && g.black_player_id !== user.id // Exclude games with me (optional)
                );

                // Enrich with user data
                // We need names/avatars. Game object usually has names, but let's stick to game data.
                // Map to activity format
                const feed = friendGames.slice(0, 10).map(g => {
                    const isWhiteFriend = friendIds.includes(g.white_player_id);
                    const friendId = isWhiteFriend ? g.white_player_id : g.black_player_id;
                    const friendName = isWhiteFriend ? g.white_player_name : g.black_player_name;
                    const isWinner = g.winner_id === friendId;
                    
                    return {
                        id: g.id,
                        type: 'game_finished',
                        friendId,
                        friendName,
                        gameType: g.game_type,
                        isWinner,
                        opponentName: isWhiteFriend ? g.black_player_name : g.white_player_name,
                        date: g.updated_date
                    };
                });

                setActivities(feed);
            } catch (e) {
                console.error("Feed error", e);
            }
        };
        loadActivities();
    }, []);

    if (activities.length === 0) return null;

    return (
        <Card className="bg-white/80 border-[#d4c5b0] shadow-sm mt-8">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#4a3728] flex items-center gap-2">
                    <Activity className="w-5 h-5" /> Activité des amis
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {activities.map(activity => (
                        <div key={activity.id} className="flex items-start gap-3 border-b border-[#f0e6d2] pb-3 last:border-0 last:pb-0">
                            <div className={`p-2 rounded-full ${activity.isWinner ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                                {activity.isWinner ? <Trophy className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="text-sm text-[#4a3728]">
                                    <span className="font-bold">{activity.friendName}</span> 
                                    {activity.isWinner ? ' a gagné ' : ' a terminé '} 
                                    une partie de <span className="font-medium">{activity.gameType === 'chess' ? 'Échecs' : 'Dames'}</span> 
                                    {' contre '} <span className="italic">{activity.opponentName}</span>
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400">{format(new Date(activity.date), 'd MMM à HH:mm', { locale: fr })}</span>
                                    <Link to={`/Game?id=${activity.id}`} className="text-xs text-[#6b5138] hover:underline">Voir la partie</Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}