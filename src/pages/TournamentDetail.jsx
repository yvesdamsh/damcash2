import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Calendar, Users, Play, Trophy, Share2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import TournamentBracket from '@/components/TournamentBracket';
import TournamentChat from '@/components/TournamentChat';

export default function TournamentDetail() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    
    const [tournament, setTournament] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [matches, setMatches] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState("");
    const [pairingInterval, setPairingInterval] = useState(null);
    
    // Team Mode State
    const [myLedTeams, setMyLedTeams] = useState([]);
    const [isTeamJoinOpen, setIsTeamJoinOpen] = useState(false);

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

                if (tData.length) {
                    const t = tData[0];
                    setTournament(t);
                    
                    // If Team Mode, fetch led teams
                    if (t.team_mode && u) {
                        const memberships = await base44.entities.TeamMember.filter({ user_id: u.id, role: 'leader', status: 'active' });
                        if (memberships.length > 0) {
                            const teamDetails = await Promise.all(memberships.map(m => base44.entities.Team.get(m.team_id)));
                            setMyLedTeams(teamDetails);
                        }
                    }
                }
                setParticipants(pData.sort((a, b) => (b.score || 0) - (a.score || 0))); 
                setMatches(mData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        init();
        
        // Polling for updates
        const interval = setInterval(init, 5000);
        return () => clearInterval(interval);
    }, [id]);

    const isParticipant = participants.some(p => 
        p.user_id === user?.id || (tournament?.team_mode && p.team_id && myLedTeams.some(t => t.id === p.team_id))
    );
    const canJoin = tournament && tournament.status === 'open' && participants.length < tournament.max_players;

    // Arena Pairing Logic Trigger
    useEffect(() => {
        if (tournament && tournament.format === 'arena' && tournament.status === 'ongoing' && isParticipant) {
             const myParticipant = participants.find(p => p.user_id === user.id);
             // If I am active and not playing, trigger pairing attempt
             if (myParticipant && !myParticipant.current_game_id) {
                 const pair = async () => {
                     await base44.functions.invoke('arenaPairing', { tournamentId: tournament.id });
                 };
                 // Try to pair every 10 seconds if waiting
                 const pid = setInterval(pair, 10000);
                 setPairingInterval(pid);
                 return () => clearInterval(pid);
             }
        }
    }, [tournament, participants, isParticipant]);

    // Countdown Timer
    useEffect(() => {
        if (!tournament) return;
        const timer = setInterval(() => {
            const now = new Date();
            const start = new Date(tournament.start_date);
            const end = new Date(tournament.end_date || start.getTime() + 57*60000);

            if (now < start) {
                const diff = start - now;
                setCountdown(`Démarre dans ${Math.floor(diff/60000)}m ${Math.floor((diff%60000)/1000)}s`);
            } else if (now < end) {
                const diff = end - now;
                setCountdown(`Fin dans ${Math.floor(diff/60000)}m ${Math.floor((diff%60000)/1000)}s`);
            } else {
                setCountdown("Terminé");
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [tournament]);

    const handleJoin = async () => {
        if (!user || !tournament) return;

        // Team Mode Check
        if (tournament.team_mode) {
            if (myLedTeams.length === 0) {
                toast.error("Vous devez être chef d'une équipe pour l'inscrire !");
                return;
            }
            setIsTeamJoinOpen(true);
            return;
        }
        
        if (participants.some(p => p.user_id === user.id)) return;

        // For Arena, unlimited players
        if (tournament.format !== 'arena' && participants.length >= tournament.max_players) {
            toast.error("Le tournoi est complet !");
            return;
        }

        try {
            if (tournament.entry_fee > 0) {
                const toastId = toast.loading("Paiement des frais d'inscription...");
                const res = await base44.functions.invoke('walletManager', {
                    action: 'pay_entry_fee',
                    userId: user.id,
                    amount: tournament.entry_fee,
                    gameId: tournament.id 
                });
                
                if (res.data.error) {
                    toast.dismiss(toastId);
                    toast.error(`Erreur: ${res.data.error === 'Insufficient funds' ? 'Fonds insuffisants' : res.data.error}`);
                    return;
                }
                toast.dismiss(toastId);
                toast.success("Paiement accepté !");
            }

            await base44.entities.TournamentParticipant.create({
                tournament_id: tournament.id,
                user_id: user.id,
                user_name: user.full_name || user.username || 'Joueur',
                avatar_url: user.avatar_url,
                status: 'active',
                score: 0,
                games_played: 0
            });
            toast.success("Inscription confirmée !");
            // Force refresh
            base44.functions.invoke('tournamentManager', {}); 
        } catch (e) {
            console.error(e);
            toast.error("Erreur inscription");
        }
    };

    const handleJoinAsTeam = async (team) => {
        if (participants.some(p => p.team_id === team.id)) {
            toast.error("Cette équipe est déjà inscrite !");
            return;
        }

        try {
             await base44.entities.TournamentParticipant.create({
                tournament_id: tournament.id,
                user_id: user.id, // Leader ID acts as user_id for permission checks
                team_id: team.id,
                user_name: team.name, // Display Team Name
                avatar_url: team.avatar_url,
                status: 'active',
                score: 0,
                games_played: 0
            });
            toast.success(`Équipe ${team.name} inscrite !`);
            setIsTeamJoinOpen(false);
            // Force refresh
            base44.functions.invoke('tournamentManager', {}); 
        } catch (e) {
            console.error(e);
            toast.error("Erreur inscription équipe");
        }
    };

    const handleEnterGame = () => {
        const myParticipant = participants.find(p => p.user_id === user?.id);
        if (myParticipant && myParticipant.current_game_id) {
            window.location.href = `/Game?id=${myParticipant.current_game_id}`;
        }
    };

    const handleStartTournament = async () => {
        if (tournament.created_by_user_id && tournament.created_by_user_id !== user.id) {
            toast.error("Seul l'organisateur peut démarrer le tournoi");
            return;
        }

        if (participants.length < 2) {
            toast.error("Il faut au moins 2 joueurs pour commencer");
            return;
        }

        try {
            const res = await base44.functions.invoke('startTournament', { tournamentId: tournament.id });
            if (res.data.error) {
                toast.error(`Erreur: ${res.data.error}`);
            } else {
                toast.success("Le tournoi commence !");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur au démarrage");
        }
    };

    const advanceGroupsToBracket = async () => {
        // Calculate standings and generate bracket
        try {
            // 1. Update standings based on matches (processGameResult does it but let's be safe)
            // We assume TournamentParticipant.score or group_points is updated.
            // For groups, we need to make sure we used group_points. 
            // Note: processGameResult might need update to handle group_points or we map score to it.
            // Let's assume processGameResult updates 'score' for tournament participants regardless of stage.
            // For 'hybrid', 'score' = group points.
            
            const groups = {};
            participants.forEach(p => {
                if (!groups[p.group_id]) groups[p.group_id] = [];
                groups[p.group_id].push(p);
            });

            const qualifiers = [];
            
            // Top 2 from each group
            Object.values(groups).forEach(groupParticipants => {
                const sorted = groupParticipants.sort((a, b) => (b.score || 0) - (a.score || 0));
                if(sorted[0]) qualifiers.push(sorted[0]);
                if(sorted[1]) qualifiers.push(sorted[1]);
            });

            // Generate Bracket from qualifiers
            const shuffled = qualifiers.sort(() => 0.5 - Math.random());
            for (let i = 0; i < shuffled.length; i += 2) {
                if (i + 1 < shuffled.length) {
                    const p1 = shuffled[i];
                    const p2 = shuffled[i+1];
                    await base44.entities.Game.create({
                        status: 'waiting',
                        game_type: tournament.game_type,
                        white_player_id: p1.user_id,
                        white_player_name: p1.user_name,
                        black_player_id: p2.user_id,
                        black_player_name: p2.user_name,
                        current_turn: 'white',
                        board_state: '[]',
                        tournament_id: tournament.id,
                        tournament_round: 1,
                        is_private: true
                    });
                }
            }

            // Update others to eliminated?
            // Not strictly needed for display but good for data purity
            
            await base44.entities.Tournament.update(tournament.id, { 
                stage: 'knockout',
                current_round: 1
            });
            toast.success("Phase finale générée !");
        } catch (e) {
            console.error(e);
            toast.error("Erreur génération phase finale");
        }
    };

    if (loading) return <div className="flex justify-center h-screen items-center"><Loader2 className="w-10 h-10 animate-spin text-[#4a3728]" /></div>;
    if (!tournament) return <div className="text-center p-10">Tournoi introuvable</div>;

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
                    
                    <Dialog open={isTeamJoinOpen} onOpenChange={setIsTeamJoinOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Sélectionner une équipe</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2">
                                {myLedTeams.map(t => (
                                    <Button key={t.id} onClick={() => handleJoinAsTeam(t)} className="w-full justify-start" variant="outline">
                                        {t.name}
                                    </Button>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Card className="border-t-4 border-t-[#4a3728] shadow-lg bg-white/90">
                        <CardHeader>
                            <div className="uppercase tracking-wider text-xs font-bold text-gray-500 mb-2 flex items-center gap-2">
                                {tournament.game_type === 'checkers' ? 'Dames' : 'Échecs'}
                                {tournament.team_mode && <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px]">PAR ÉQUIPE</span>}
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
                            
                            <div className="flex items-center gap-3 text-gray-700">
                                <div className="w-8 h-8 rounded-full bg-[#f0e6d2] flex items-center justify-center">
                                    <Trophy className="w-4 h-4 text-[#6b5138]" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Frais / Cagnotte</p>
                                    <p className="font-medium">
                                        {tournament.entry_fee > 0 ? `$${tournament.entry_fee}` : 'Gratuit'} / 
                                        <span className="text-green-600 font-bold ml-1">${tournament.prize_pool || 0}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <div className="text-center font-mono font-bold text-xl text-[#d45c30]">
                                    {countdown}
                                </div>

                                {tournament.format === 'arena' && isParticipant && (
                                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                                        {participants.find(p => p.user_id === user?.id)?.current_game_id ? (
                                            <Button onClick={handleEnterGame} className="w-full bg-green-600 hover:bg-green-700 animate-pulse">
                                                PARTIE EN COURS ! REJOINDRE
                                            </Button>
                                        ) : (
                                            <div className="text-sm text-blue-800 font-bold flex items-center justify-center gap-2">
                                                <Loader2 className="animate-spin w-4 h-4" /> Recherche d'adversaire...
                                            </div>
                                        )}
                                    </div>
                                )}

                                {tournament.status === 'open' || (tournament.status === 'ongoing' && tournament.format === 'arena') ? (
                                    !isParticipant ? (
                                        <Button onClick={handleJoin} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-white shadow-md text-lg font-bold">
                                            {tournament.format === 'arena' ? 'Rejoindre l\'Arène' : 'S\'inscrire'}
                                        </Button>
                                    ) : (
                                        tournament.format !== 'arena' && <Button disabled className="w-full opacity-80">Inscrit</Button>
                                    )
                                ) : (
                                    <div className="text-center font-bold text-gray-500">Tournoi terminé</div>
                                )}

                                {/* Admin Start Button */}
                                {tournament.status === 'open' && participants.length >= 2 && user && tournament.created_by_user_id === user.id && (
                                    <Button onClick={handleStartTournament} variant="outline" className="w-full mt-2 border-[#4a3728] text-[#4a3728] hover:bg-[#f5f0e6]">
                                        <Play className="w-4 h-4 mr-2" /> Démarrer le Tournoi (Admin)
                                    </Button>
                                )}

                                {/* Next Round Swiss */}
                                {tournament.status === 'ongoing' && tournament.format === 'swiss' && (
                                    <Button onClick={async () => {
                                        await base44.functions.invoke('swissPairing', { tournamentId: tournament.id });
                                        toast.success("Nouveau round généré !");
                                        // Reload data
                                    }} variant="outline" className="w-full mt-2 border-[#4a3728] text-[#4a3728] hover:bg-[#f5f0e6]">
                                        <Play className="w-4 h-4 mr-2" /> Round Suivant (Admin)
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-[#4a3728] to-[#2c1e12] text-[#e8dcc5]">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <Trophy className="w-12 h-12 text-yellow-500" />
                                <div>
                                    <h3 className="font-bold text-lg">Récompenses</h3>
                                    <p className="text-sm opacity-80">{tournament.prizes || "La gloire éternelle !"}</p>
                                </div>
                            </div>
                            {tournament.rewards && (
                                <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4 border-t border-white/10 pt-4">
                                    <div className="bg-white/10 p-2 rounded">
                                        <div className="font-bold text-yellow-400">1er</div>
                                        <div>{tournament.rewards.first || 'Or'}</div>
                                    </div>
                                    <div className="bg-white/10 p-2 rounded">
                                        <div className="font-bold text-gray-300">2ème</div>
                                        <div>{tournament.rewards.second || 'Argent'}</div>
                                    </div>
                                    <div className="bg-white/10 p-2 rounded">
                                        <div className="font-bold text-orange-400">3ème</div>
                                        <div>{tournament.rewards.third || 'Bronze'}</div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {tournament.winner_id && (
                        <Card className="mt-6 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-xl animate-in fade-in zoom-in duration-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Crown className="w-6 h-6" /> Vainqueur
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl font-black">
                                        {participants.find(p => p.user_id === tournament.winner_id)?.user_name || 'Champion'}
                                    </div>
                                    <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">
                                        🏆 Champion
                                    </div>
                                </div>
                                <p className="mt-2 text-white/80 text-sm">
                                    A remporté le badge "Vainqueur {tournament.name}"
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Content Area */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="bracket" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-[#e8dcc5]">
                            <TabsTrigger value="bracket" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Tableau</TabsTrigger>
                            <TabsTrigger value="participants" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">Joueurs</TabsTrigger>
                            <TabsTrigger value="chat" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                                <MessageSquare className="w-4 h-4 mr-2" /> Chat
                            </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="bracket" className="mt-6">
                            <div className="flex justify-end mb-4">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                        // Logic to show Replay Center - maybe navigate to a special filtered view or modal
                                        // For simplicity, just filter matches list below to show completed with "Watch" button
                                        document.getElementById('matches-list')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="gap-2"
                                >
                                    <Play className="w-4 h-4" /> Revoir les parties
                                </Button>
                            </div>

                            {tournament.format === 'hybrid' && tournament.stage === 'groups' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-[#4a3728]">Phase de Poules</h3>
                                        {user && tournament.created_by_user_id === user.id && (
                                            <Button onClick={advanceGroupsToBracket} className="bg-green-600 hover:bg-green-700">
                                                <Trophy className="w-4 h-4 mr-2" /> Passer aux Phases Finales
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(gName => {
                                            const groupPlayers = participants.filter(p => p.group_id === gName);
                                            if (groupPlayers.length === 0) return null;
                                            
                                            // Sort
                                            const sorted = groupPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));

                                            return (
                                                <Card key={gName} className="bg-white/80">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-lg">Groupe {gName}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-2">
                                                            {sorted.map((p, idx) => (
                                                                <div key={p.id} className={`flex justify-between p-2 rounded ${idx < 2 ? 'bg-green-100' : 'bg-gray-50'}`}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-xs w-4">{idx+1}</span>
                                                                        <span className="text-sm font-medium truncate max-w-[120px]">{p.user_name}</span>
                                                                    </div>
                                                                    <span className="font-bold text-[#d45c30]">{p.score || 0} pts</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {(tournament.stage === 'knockout' || tournament.format === 'bracket') && (
                                <Card className="min-h-[400px] bg-white/80 backdrop-blur mt-6">
                                    <CardHeader>
                                        <CardTitle>Arbre Final</CardTitle>
                                    </CardHeader>
                                    <CardContent className="overflow-auto">
                                        {matches.filter(m => m.tournament_round > 0).length > 0 ? (
                                            <TournamentBracket matches={matches} players={participants} currentRound={tournament.current_round} />
                                        ) : (
                                            <div className="text-center py-20 text-gray-500">
                                                En attente de la génération de l'arbre...
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                        
                        <TabsContent value="participants" className="mt-6">
                             <Card>
                                <CardHeader>
                                    <CardTitle>{tournament.format === 'arena' ? 'Classement' : 'Participants'}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-12 gap-2 p-2 bg-gray-100 font-bold text-xs text-gray-500 uppercase">
                                        <div className="col-span-1">#</div>
                                        <div className="col-span-5">Joueur</div>
                                        <div className="col-span-2 text-center">Pts</div>
                                        <div className="col-span-2 text-center">Jouées</div>
                                        <div className="col-span-2 text-center">État</div>
                                    </div>
                                    {participants.map((p, i) => (
                                        <div key={p.id} className={`grid grid-cols-12 gap-2 items-center p-3 border-b last:border-0 hover:bg-gray-50 ${p.user_id === user?.id ? 'bg-yellow-50' : ''}`}>
                                            <div className="col-span-1 font-mono font-bold text-[#4a3728]">{i + 1}</div>
                                            <div className="col-span-5 flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                                    {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover"/> : <Users className="w-full h-full p-2 text-gray-500"/>}
                                                </div>
                                                <span className="truncate font-medium">{p.user_name}</span>
                                            </div>
                                            <div className="col-span-2 text-center font-bold text-lg text-[#d45c30]">{p.score || 0}</div>
                                            <div className="col-span-2 text-center text-gray-600">{p.games_played || 0}</div>
                                            <div className="col-span-2 flex justify-center">
                                                 {p.current_game_id ? (
                                                     <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" title="En jeu"></span>
                                                 ) : (
                                                     <span className="w-3 h-3 rounded-full bg-gray-300" title="En attente"></span>
                                                 )}
                                            </div>
                                        </div>
                                    ))}
                                    {participants.length === 0 && <div className="p-8 text-center text-gray-500">L'arène est vide...</div>}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="chat" className="mt-6">
                            <TournamentChat tournamentId={tournament.id} currentUser={user} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}