import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Calendar, Users, Play, Trophy, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import TournamentBracket from '@/components/TournamentBracket';

export default function TournamentDetail() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [matches, setMatches] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                
                // Fetch Data in parallel
                const [tData, pData, mData] = await Promise.all([
                    base44.entities.Tournament.filter({ id }),
                    base44.entities.TournamentParticipant.filter({ tournament_id: id }),
                    base44.entities.Game.filter({ tournament_id: id })
                ]);

                if (tData.length) setTournament(tData[0]);
                setParticipants(pData);
                setMatches(mData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [id]);

    const handleJoin = async () => {
        if (!user || !tournament) return;
        
        // Check if already joined
        if (participants.some(p => p.user_id === user.id)) {
            toast.warning("Vous êtes déjà inscrit !");
            return;
        }

        if (participants.length >= tournament.max_players) {
            toast.error("Le tournoi est complet !");
            return;
        }

        try {
            await base44.entities.TournamentParticipant.create({
                tournament_id: tournament.id,
                user_id: user.id,
                user_name: user.full_name || user.username || 'Joueur',
                avatar_url: user.avatar_url,
                status: 'active'
            });
            
            // Refresh
            const pData = await base44.entities.TournamentParticipant.filter({ tournament_id: id });
            setParticipants(pData);
            toast.success("Inscription validée !");
        } catch (e) {
            toast.error("Erreur lors de l'inscription");
        }
    };

    const handleStartTournament = async () => {
        // Only if enough players (for now, simple check)
        if (participants.length < 2) {
            toast.error("Il faut au moins 2 joueurs pour commencer");
            return;
        }

        try {
            // Update status
            await base44.entities.Tournament.update(tournament.id, { status: 'ongoing', current_round: 1 });
            
            // Generate Round 1 Pairings
            // Shuffle participants
            const shuffled = [...participants].sort(() => 0.5 - Math.random());
            const newMatches = [];

            for (let i = 0; i < shuffled.length; i += 2) {
                if (i + 1 < shuffled.length) {
                    const p1 = shuffled[i];
                    const p2 = shuffled[i+1];
                    
                    // Create Game
                    const game = await base44.entities.Game.create({
                        status: 'waiting',
                        game_type: tournament.game_type,
                        white_player_id: p1.user_id,
                        white_player_name: p1.user_name,
                        black_player_id: p2.user_id,
                        black_player_name: p2.user_name,
                        current_turn: 'white',
                        board_state: '[]', // Will be init by logic
                        tournament_id: tournament.id,
                        tournament_round: 1,
                        is_private: true
                    });
                    newMatches.push(game);
                }
            }

            setMatches(newMatches);
            setTournament(prev => ({ ...prev, status: 'ongoing' }));
            toast.success("Le tournoi commence !");
        } catch (e) {
            console.error(e);
            toast.error("Erreur au démarrage");
        }
    };

    if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;
    if (!tournament) return <div className="text-center p-10">Tournoi introuvable</div>;

    const isParticipant = participants.some(p => p.user_id === user?.id);
    const canJoin = tournament.status === 'open' && participants.length < tournament.max_players;
    
    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="mb-6">
                <Link to="/Tournaments">
                    <Button variant="ghost" className="hover:bg-[#d4c5b0] text-[#4a3728]">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux tournois
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Info Column */}
                <div className="space-y-6">
                    <Card className="border-t-4 border-t-[#4a3728] shadow-lg bg-white/90">
                        <CardHeader>
                            <div className="uppercase tracking-wider text-xs font-bold text-gray-500 mb-2">
                                {tournament.game_type === 'checkers' ? 'Dames' : 'Échecs'}
                            </div>
                            <CardTitle className="text-3xl font-bold text-[#4a3728] font-serif">
                                {tournament.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 text-gray-700">
                                <div className="w-8 h-8 rounded-full bg-[#f0e6d2] flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-[#6b5138]" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Début</p>
                                    <p className="font-medium">{format(new Date(tournament.start_date), 'dd MMMM yyyy HH:mm', { locale: fr })}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 text-gray-700">
                                <div className="w-8 h-8 rounded-full bg-[#f0e6d2] flex items-center justify-center">
                                    <Users className="w-4 h-4 text-[#6b5138]" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Participants</p>
                                    <p className="font-medium">{participants.length} / {tournament.max_players}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                {tournament.status === 'open' ? (
                                    canJoin ? (
                                        <Button onClick={handleJoin} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-white shadow-md">
                                            Rejoindre le tournoi
                                        </Button>
                                    ) : (
                                        <Button disabled className="w-full opacity-80">
                                            {isParticipant ? "Inscrit" : "Complet"}
                                        </Button>
                                    )
                                ) : (
                                    <div className="text-center font-bold text-[#6b5138] py-2 bg-[#f5f0e6] rounded-lg">
                                        Tournoi en cours
                                    </div>
                                )}
                                
                                {/* Admin Start Button (Simplified: anyone can start for now if creating matches logic allows) */}
                                {tournament.status === 'open' && participants.length >= 2 && (
                                    <Button onClick={handleStartTournament} variant="outline" className="w-full mt-2 border-[#4a3728] text-[#4a3728] hover:bg-[#f5f0e6]">
                                        <Play className="w-4 h-4 mr-2" /> Démarrer (Admin)
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-[#4a3728] to-[#2c1e12] text-[#e8dcc5]">
                        <CardContent className="p-6 flex items-center gap-4">
                            <Trophy className="w-12 h-12 text-yellow-500" />
                            <div>
                                <h3 className="font-bold text-lg">Récompense</h3>
                                <p className="text-sm opacity-80">La gloire éternelle et le titre de maître !</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Content Area */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="bracket" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-[#e8dcc5]">
                            <TabsTrigger value="bracket" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Tableau</TabsTrigger>
                            <TabsTrigger value="participants" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Joueurs</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="bracket" className="mt-6">
                            <Card className="min-h-[400px] bg-white/80 backdrop-blur">
                                <CardHeader>
                                    <CardTitle>Arbre du tournoi</CardTitle>
                                </CardHeader>
                                <CardContent className="overflow-auto">
                                    {matches.length > 0 ? (
                                        <TournamentBracket matches={matches} players={participants} currentRound={tournament.current_round} />
                                    ) : (
                                        <div className="text-center py-20 text-gray-500">
                                            Le tableau sera généré au début du tournoi.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="participants" className="mt-6">
                             <Card>
                                <CardContent className="p-0">
                                    {participants.map((p, i) => (
                                        <div key={p.id} className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-gray-50">
                                            <span className="text-gray-400 font-mono w-6">{i + 1}</span>
                                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                                {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover"/> : <Users className="w-full h-full p-2 text-gray-500"/>}
                                            </div>
                                            <div className="font-medium text-[#4a3728]">{p.user_name}</div>
                                            <div className={`ml-auto text-xs px-2 py-1 rounded ${p.status === 'eliminated' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {p.status === 'eliminated' ? 'Éliminé' : 'Actif'}
                                            </div>
                                        </div>
                                    ))}
                                    {participants.length === 0 && <div className="p-8 text-center text-gray-500">Aucun inscrit</div>}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}