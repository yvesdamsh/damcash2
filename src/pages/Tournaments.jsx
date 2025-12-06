import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Trophy, Calendar, Users, Plus, ArrowRight, Crown, Gamepad2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/components/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Filter, LayoutGrid, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { useRobustWebSocket } from '@/components/hooks/useRobustWebSocket';

export default function Tournaments() {
    const { t, formatDate } = useLanguage();
    const [tournaments, setTournaments] = useState([]);
    const [user, setUser] = useState(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [gameMode, setGameMode] = useState(localStorage.getItem('gameMode') || 'checkers');
    const [newTournament, setNewTournament] = useState({
        name: '',
        game_type: 'checkers', // Will sync with gameMode in useEffect
        format: 'bracket',
        max_players: '8',
        start_date: '',
        is_private: false,
        access_code: '',
        entry_fee: 0,
        prize_pool: 0,
        rounds: 3,
        time_control: '5+0',
        team_mode: false,
        custom_rules: '',
        recurrence: 'none',
        elo_min: 0,
        elo_max: 3000
    });
    const [accessCodeInput, setAccessCodeInput] = useState('');
    
    // Filters & Search State
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterGameType, setFilterGameType] = useState(localStorage.getItem('gameMode') || 'checkers');
    const [myTournamentIds, setMyTournamentIds] = useState(new Set());
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(() => {
            // Re-run fetch when search changes (if we implement backend search)
            // For now, we filter client-side for search to stay snappy on small result sets (50),
            // but we trigger fetch if we want to support backend search later.
            // fetchTournaments(); 
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const init = async () => {
            try {
                const u = await base44.auth.me();
                setUser(u);
                // Ensure tournaments exist
                await base44.functions.invoke('tournamentManager', {});
                // Initial fetch is now handled by the filter useEffect
                
                // Fetch my participations
                if (u) {
                    const parts = await base44.entities.TournamentParticipant.filter({ user_id: u.id });
                    setMyTournamentIds(new Set(parts.map(p => p.tournament_id)));
                }
            } catch (e) {
                console.error(e);
            }
        };
        init();

        // Game Mode Listener
        const handleModeChange = () => {
            const mode = localStorage.getItem('gameMode') || 'checkers';
            setGameMode(mode);
            setNewTournament(prev => ({ ...prev, game_type: mode }));
            setFilterGameType(mode);
        };
        window.addEventListener('gameModeChanged', handleModeChange);
        handleModeChange(); // Init
        return () => window.removeEventListener('gameModeChanged', handleModeChange);
    }, []);

    // Real-time updates
    const { sendMessage } = useRobustWebSocket('/functions/realtimeSocket?channelId=tournaments', {
        onMessage: (event, data) => {
            if (data && (data.type === 'tournament_created' || data.type === 'tournament_updated')) {
                if (data.tournament) {
                    setTournaments(prev => [data.tournament, ...prev.filter(t => t.id !== data.tournament.id)]);
                } else {
                    fetchTournaments();
                }
            }
        }
    });

    const fetchTournaments = async () => {
        try {
            // Build Query
            const query = {};
            
            // 1. Status Filter
            if (activeTab === 'history') {
                query.status = 'finished';
            } else if (filterStatus !== 'all') {
                query.status = filterStatus;
            } else {
                // Default view (not history) usually hides finished or shows relevant
                if (activeTab !== 'my') {
                    // If we are in "All", maybe show everything? Or exclude finished?
                    // Let's keep it simple: fetch all if no specific status filter, 
                    // but usually we sort by date so finished ones drop off naturally or we can exclude them.
                    // For now, let's NOT exclude finished by default to keep consistent with previous behavior if user scrolls,
                    // but filtering on backend is better.
                }
            }

            // 2. Game Type
            if (filterGameType !== 'all') {
                query.game_type = filterGameType;
            }

            // 3. Private/Public (Backend security usually handles data access, but we can filter public)
            // If we want to filter private games that aren't ours, it's complex.
            // Let's fetch mainly public + our own if possible, or just fetch list and let backend security limits apply?
            // Assuming standard fetch returns what we can see.
            
            // Search optimization (if supported by backend)
            // if (searchQuery) query.name = { $regex: searchQuery, $options: 'i' };

            const list = await base44.entities.Tournament.filter(query, '-start_date', 50);
            setTournaments(list);
        } catch (e) {
            console.error("Fetch tournaments error", e);
        }
    };

    // Refetch when filters change
    useEffect(() => {
        fetchTournaments();
    }, [filterStatus, filterGameType, activeTab, user]);

    const handleCreate = async () => {
        if (!newTournament.name || !newTournament.start_date) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }
        try {
            await base44.entities.Tournament.create({
                ...newTournament,
                max_players: parseInt(newTournament.max_players),
                entry_fee: parseFloat(newTournament.entry_fee),
                prize_pool: parseFloat(newTournament.prize_pool),
                rounds: parseInt(newTournament.rounds),
                status: 'open',
                stage: newTournament.format === 'hybrid' ? 'groups' : 'knockout',
                created_by_user_id: user.id,
                elo_min: parseInt(newTournament.elo_min) || 0,
                elo_max: parseInt(newTournament.elo_max) || 3000
            });
            
            // Broadcast new tournament
            // We need to fetch the created one to send it or just trigger refresh.
            // create returns the object? Yes usually.
            // Let's assume we fetch or just trigger refresh.
            sendMessage({ type: 'tournament_created' }); // Trigger refresh for others

            toast.success("Tournoi créé !");
            setIsCreateOpen(false);
            fetchTournaments();
        } catch (e) {
            toast.error("Erreur lors de la création");
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-[#4a3728] flex items-center gap-3" style={{ fontFamily: 'Georgia, serif' }}>
                        <Trophy className="w-10 h-10 text-yellow-600" /> {t('tournaments.title')}
                    </h1>
                    <p className="text-[#6b5138] mt-2">{t('tournaments.subtitle')}</p>
                </div>

                <div className="flex bg-[#e8dcc5] p-1 rounded-lg border border-[#d4c5b0]">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={`${viewMode === 'list' ? 'bg-white shadow text-[#4a3728]' : 'text-[#8c7b6a] hover:text-[#4a3728]'}`}
                    >
                        <LayoutGrid className="w-4 h-4 mr-2" /> {t('tournaments.view_list')}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setViewMode('calendar')}
                        className={`${viewMode === 'calendar' ? 'bg-white shadow text-[#4a3728]' : 'text-[#8c7b6a] hover:text-[#4a3728]'}`}
                    >
                        <CalendarIcon className="w-4 h-4 mr-2" /> {t('tournaments.view_calendar')}
                    </Button>
                </div>
                
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] gap-2 shadow-lg">
                            <Plus className="w-5 h-5" /> {t('tournaments.create_btn')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#fdfbf7] border-[#d4c5b0]">
                        <DialogHeader>
                            <DialogTitle className="text-[#4a3728]">{t('tournaments.create_title')}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>{t('tournaments.form_name')}</Label>
                                <Input 
                                    value={newTournament.name} 
                                    onChange={e => setNewTournament({...newTournament, name: e.target.value})}
                                    placeholder="Ex: Coupe du Printemps"
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                <Label>{t('tournaments.form_game')}</Label>
                                <Input value={newTournament.game_type === 'chess' ? t('game.chess') : t('game.checkers')} disabled className="bg-gray-100 border-[#d4c5b0]" />
                                </div>
                                <div className="grid gap-2">
                                <Label>{t('tournaments.form_format')}</Label>
                                <Select 
                                    value={newTournament.format || 'bracket'} 
                                    onValueChange={v => setNewTournament({...newTournament, format: v})}
                                >
                                    <SelectTrigger className="border-[#d4c5b0]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bracket">{t('tournaments.format_bracket')}</SelectItem>
                                        <SelectItem value="hybrid">{t('tournaments.format_hybrid')}</SelectItem>
                                        <SelectItem value="swiss">{t('tournaments.format_swiss')}</SelectItem>
                                        <SelectItem value="arena">{t('tournaments.format_arena')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t('tournaments.form_max_players')}</Label>
                                    <Select 
                                        value={newTournament.max_players} 
                                        onValueChange={v => setNewTournament({...newTournament, max_players: v})}
                                    >
                                        <SelectTrigger className="border-[#d4c5b0]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="4">4</SelectItem>
                                            <SelectItem value="8">8</SelectItem>
                                            <SelectItem value="16">16</SelectItem>
                                            <SelectItem value="32">32</SelectItem>
                                            <SelectItem value="100">100 (Arena)</SelectItem>
                                            </SelectContent>
                                            </Select>
                                            </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                            <Label>{t('tournaments.form_entry_fee')}</Label>
                                            <Input 
                                                type="number"
                                                min="0"
                                                value={newTournament.entry_fee} 
                                                onChange={e => setNewTournament({...newTournament, entry_fee: e.target.value})}
                                                className="border-[#d4c5b0]"
                                            />
                                            </div>
                                            <div className="grid gap-2">
                                            <Label>{t('tournaments.form_prize_pool')}</Label>
                                            <Input 
                                                type="number"
                                                min="0"
                                                value={newTournament.prize_pool} 
                                                onChange={e => setNewTournament({...newTournament, prize_pool: e.target.value})}
                                                className="border-[#d4c5b0]"
                                            />
                                            </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                            <Label>{t('tournaments.form_rounds')}</Label>
                                            <Input 
                                                type="number"
                                                min="1"
                                                value={newTournament.rounds} 
                                                onChange={e => setNewTournament({...newTournament, rounds: e.target.value})}
                                                className="border-[#d4c5b0]"
                                            />
                                            </div>
                                            <div className="grid gap-2">
                                            <Label>{t('tournaments.form_time_control')}</Label>
                                            <Select 
                                                value={newTournament.time_control} 
                                                onValueChange={v => setNewTournament({...newTournament, time_control: v})}
                                            >
                                                <SelectTrigger className="border-[#d4c5b0]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1+0">1+0 (Bullet)</SelectItem>
                                                    <SelectItem value="3+0">3+0 (Blitz)</SelectItem>
                                                    <SelectItem value="3+2">3+2 (Blitz)</SelectItem>
                                                    <SelectItem value="5+0">5+0 (Blitz)</SelectItem>
                                                    <SelectItem value="10+0">10+0 (Rapid)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            </div>
                                            </div>

                                            <div className="grid gap-2">
                                            <Label>{t('tournaments.form_prizes')}</Label>
                                <Input 
                                    value={newTournament.prizes || ''} 
                                    onChange={e => setNewTournament({...newTournament, prizes: e.target.value})}
                                    placeholder="Ex: Badge Or + 500 points"
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>{t('tournaments.form_start_date')}</Label>
                                <Input 
                                    type="datetime-local"
                                    value={newTournament.start_date} 
                                    onChange={e => setNewTournament({...newTournament, start_date: e.target.value})}
                                    className="border-[#d4c5b0]"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 border-t pt-4 mt-2">
                                <input 
                                    type="checkbox" 
                                    id="is_private" 
                                    checked={newTournament.is_private}
                                    onChange={e => setNewTournament({...newTournament, is_private: e.target.checked})}
                                    className="w-4 h-4 rounded border-gray-300 text-[#4a3728] focus:ring-[#4a3728]"
                                />
                                <Label htmlFor="is_private" className="font-bold text-[#4a3728]">{t('tournaments.form_private')}</Label>
                            </div>
                            
                            {newTournament.is_private && (
                                <div className="grid gap-2 pl-6">
                                    <Label>{t('tournaments.form_access_code')}</Label>
                                    <Input 
                                        value={newTournament.access_code || ''} 
                                        onChange={e => setNewTournament({...newTournament, access_code: e.target.value.toUpperCase()})}
                                        placeholder="Ex: SECRET123"
                                        className="border-[#d4c5b0] uppercase"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="team_mode" 
                                        checked={newTournament.team_mode}
                                        onChange={e => setNewTournament({...newTournament, team_mode: e.target.checked})}
                                        className="w-4 h-4 rounded border-gray-300 text-[#4a3728] focus:ring-[#4a3728]"
                                    />
                                    <Label htmlFor="team_mode" className="font-bold text-[#4a3728]">{t('tournaments.form_team_mode')}</Label>
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t('tournaments.form_recurrence')}</Label>
                                    <Select 
                                        value={newTournament.recurrence} 
                                        onValueChange={v => setNewTournament({...newTournament, recurrence: v})}
                                    >
                                        <SelectTrigger className="border-[#d4c5b0]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">{t('tournaments.recurrence_none')}</SelectItem>
                                            <SelectItem value="daily">{t('tournaments.recurrence_daily')}</SelectItem>
                                            <SelectItem value="weekly">{t('tournaments.recurrence_weekly')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="grid gap-2">
                                    <Label>{t('tournaments.form_elo_min')}</Label>
                                    <Input 
                                        type="number"
                                        min="0"
                                        value={newTournament.elo_min} 
                                        onChange={e => setNewTournament({...newTournament, elo_min: e.target.value})}
                                        className="border-[#d4c5b0]"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t('tournaments.form_elo_max')}</Label>
                                    <Input 
                                        type="number"
                                        min="0"
                                        value={newTournament.elo_max} 
                                        onChange={e => setNewTournament({...newTournament, elo_max: e.target.value})}
                                        className="border-[#d4c5b0]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="grid gap-2">
                                    <Label>{t('tournaments.form_tie_breaker')}</Label>
                                    <Select 
                                        value={newTournament.tie_breaker || 'buchholz'} 
                                        onValueChange={v => setNewTournament({...newTournament, tie_breaker: v})}
                                    >
                                        <SelectTrigger className="border-[#d4c5b0]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="buchholz">{t('tournaments.tie_buchholz')}</SelectItem>
                                            <SelectItem value="sonneborn_berger">Sonneborn-Berger</SelectItem>
                                            <SelectItem value="head_to_head">{t('tournaments.tie_head_to_head')}</SelectItem>
                                            <SelectItem value="wins">{t('tournaments.tie_wins')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="grid gap-2">
                                    <Label>Badge Vainqueur (Nom)</Label>
                                    <Input 
                                        value={newTournament.badge_name || ''} 
                                        onChange={e => setNewTournament({...newTournament, badge_name: e.target.value})}
                                        placeholder="Ex: Champion d'Hiver"
                                        className="border-[#d4c5b0]"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Icône Badge</Label>
                                    <Select 
                                        value={newTournament.badge_icon || 'Trophy'} 
                                        onValueChange={v => setNewTournament({...newTournament, badge_icon: v})}
                                    >
                                        <SelectTrigger className="border-[#d4c5b0]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Trophy">Trophée 🏆</SelectItem>
                                            <SelectItem value="Crown">Couronne 👑</SelectItem>
                                            <SelectItem value="Star">Étoile ⭐</SelectItem>
                                            <SelectItem value="Medal">Médaille 🥇</SelectItem>
                                            <SelectItem value="Zap">Éclair ⚡</SelectItem>
                                            <SelectItem value="Shield">Bouclier 🛡️</SelectItem>
                                            <SelectItem value="Flame">Flamme 🔥</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2 mt-2">
                                <Label>{t('tournaments.form_custom_rules')}</Label>
                                <textarea 
                                    value={newTournament.custom_rules} 
                                    onChange={e => setNewTournament({...newTournament, custom_rules: e.target.value})}
                                    placeholder="..."
                                    className="flex w-full rounded-md border border-[#d4c5b0] bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} className="bg-[#4a3728] hover:bg-[#2c1e12]">{t('tournaments.create_submit')}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Official Tournaments Banner */}
            <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                    <Crown className="w-6 h-6 text-yellow-600" />
                    <h2 className="text-2xl font-bold text-[#4a3728]">{t('tournaments.official_title')}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {tournaments
                        .filter(t => t.created_by_user_id === 'system' && (t.status === 'open' || t.status === 'ongoing') && t.game_type === gameMode)
                        .slice(0, 4)
                        .map(tournament => (
                            <Card key={tournament.id} className="bg-gradient-to-br from-[#4a3728] to-[#2c1e12] text-[#e8dcc5] border-none shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Trophy className="w-24 h-24" />
                                </div>
                                <CardContent className="p-4 relative z-10">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="bg-yellow-500 text-[#2c1e12] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                            {tournament.recurrence === 'daily' ? t('tournaments.recurrence_daily') : tournament.recurrence === 'weekly' ? t('tournaments.weekly_badge') : t('tournaments.official_badge')}
                                        </div>
                                        {tournament.game_type === 'chess' ? <Crown className="w-4 h-4" /> : <Gamepad2 className="w-4 h-4" />}
                                    </div>
                                    <h3 className="font-bold text-lg leading-tight mb-1 truncate">{tournament.name}</h3>
                                    <div className="flex items-center gap-2 text-xs opacity-80 mb-3">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(new Date(tournament.start_date), 'HH:mm')}
                                        <span>•</span>
                                        <span>{tournament.time_control}</span>
                                    </div>
                                    <Link to={`/TournamentDetail?id=${tournament.id}`}>
                                        <Button size="sm" className="w-full bg-[#e8dcc5] text-[#4a3728] hover:bg-white font-bold text-xs h-8">
                                            {t('tournaments.join_btn')}
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    {tournaments.filter(t => t.created_by_user_id === 'system' && (t.status === 'open' || t.status === 'ongoing')).length === 0 && (
                         <div className="col-span-full bg-white/50 p-4 rounded-lg text-center text-gray-500 border border-dashed border-gray-300">
                             {t('tournaments.no_official')}
                         </div>
                    )}
                </div>
            </div>

            {/* Filters & Controls */}
            {viewMode === 'list' && (
                <div className="mb-8 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    {/* Search & Filters */}
                    <div className="flex flex-col md:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <Input 
                                placeholder={t('tournaments.search_placeholder')} 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-8 bg-white border-[#d4c5b0]"
                            />
                        </div>
                        
                        <Select value={filterGameType} onValueChange={setFilterGameType}>
                            <SelectTrigger className="w-[180px] bg-white border-[#d4c5b0]">
                                <SelectValue placeholder={t('tournaments.filter_game')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('tournaments.filter_all_games')}</SelectItem>
                                <SelectItem value="checkers">{t('game.checkers')}</SelectItem>
                                <SelectItem value="chess">{t('game.chess')}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[180px] bg-white border-[#d4c5b0]">
                                <SelectValue placeholder={t('tournaments.filter_status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('tournaments.filter_all_status')}</SelectItem>
                                <SelectItem value="open">{t('tournaments.status_open')}</SelectItem>
                                <SelectItem value="ongoing">{t('tournaments.status_ongoing')}</SelectItem>
                                <SelectItem value="finished">{t('tournaments.status_finished')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Join Private Code */}
                    <div className="flex gap-2">
                        <Input 
                            placeholder={t('tournaments.code_placeholder')} 
                            value={accessCodeInput}
                            onChange={e => setAccessCodeInput(e.target.value.toUpperCase())}
                            className="bg-white border-[#d4c5b0] w-40"
                        />
                        <Button 
                            onClick={async () => {
                                if (!accessCodeInput) return;
                                const res = await base44.entities.Tournament.list(); 
                                const target = res.find(t => t.access_code === accessCodeInput && t.status !== 'finished');
                                if (target) {
                                    window.location.href = `/TournamentDetail?id=${target.id}`;
                                } else {
                                    toast.error(t('tournaments.error_code'));
                                }
                            }}
                            className="bg-[#6b5138] hover:bg-[#5c4430]"
                        >
                            {t('tournaments.join_btn')}
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-[#e8dcc5]">
                        <TabsTrigger value="all" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('tournaments.tab_all')}</TabsTrigger>
                        <TabsTrigger value="my" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('tournaments.tab_my')}</TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('tournaments.tab_history')}</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            )}

            {viewMode === 'list' ? (
            <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournaments
                    .filter(t => {
                        // 1. Search
                        if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                        
                        // 2. Tab (All vs My vs History)
                        if (activeTab === 'history') {
                             if (t.status !== 'finished') return false;
                        } else if (activeTab === 'my') {
                            const isCreator = user && t.created_by_user_id === user.id;
                            const isParticipant = myTournamentIds.has(t.id);
                            if (!isCreator && !isParticipant) return false;
                        } else {
                            // 'all' tab usually hides finished tournaments to keep view clean, unless user filters for them
                            // But let's keep 'all' showing everything unless filtered, OR hide finished by default in 'all' if 'history' exists?
                            // Standard UX: 'All' shows Open/Ongoing. History shows Finished.
                            if (t.status === 'finished' && filterStatus === 'all') return false;
                        }

                        // 3. Status Filter
                        if (filterStatus !== 'all' && t.status !== filterStatus) return false;

                        // 4. Game Type Filter (Override default behavior or combine?)
                        // Previous behavior was strict lock on gameMode. Now we have a filter.
                        // If filter is 'all', show all types? Or default to gameMode if not specified?
                        // Let's trust the filter control.
                        if (filterGameType !== 'all' && t.game_type !== filterGameType) return false;
                        // Fallback to gameMode if filter is 'all' to keep initial view consistent? 
                        // No, 'all' should mean all. But let's default the filter state to 'all'.
                        
                        // 5. Private Visibility
                        if (t.is_private && (!user || t.created_by_user_id !== user.id) && !myTournamentIds.has(t.id)) return false;

                        // 6. Hide Official from main list (optional, or keep them mixed? User asked for a system. 
                        // Usually better to duplicate or keep mixed. Let's keep mixed but sort officials top or visually distinct.
                        // Actually, let's HIDE them from the "General List" if they are already shown in the top banner to avoid duplication?
                        // No, the top banner is a "Highlight" (limit 4). The list is "All".
                        // Let's keep them in the list too for completeness.
                        
                        return true;
                    })
                    .map(tournament => (
                    <Card key={tournament.id} className="bg-white/90 border-[#d4c5b0] shadow-md hover:shadow-xl transition-all group relative">
                         {tournament.is_private && <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-1 rounded-full font-bold border border-yellow-200 z-10">PRIVÉ</div>}
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide mb-2 inline-block ${
                                    tournament.status === 'open' ? 'bg-green-100 text-green-800' : 
                                    tournament.status === 'ongoing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {tournament.status === 'open' ? t('tournaments.status_open') : 
                                     tournament.status === 'ongoing' ? t('tournaments.status_ongoing') : t('tournaments.status_finished')}
                                </div>
                                <div className="text-[#8c7b6a] flex gap-2">
                                    {tournament.team_mode && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-bold">{t('tournaments.form_team_mode')}</span>}
                                    {tournament.entry_fee > 0 && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">${tournament.entry_fee}</span>}
                                    {tournament.game_type === 'chess' ? <Crown className="w-5 h-5" /> : <Gamepad2 className="w-5 h-5" />}
                                </div>
                            </div>
                            <CardTitle className="text-xl text-[#4a3728] group-hover:text-[#6b5138] transition-colors">
                                {tournament.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {formatDate(new Date(tournament.start_date), 'dd MMM yyyy à HH:mm')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between text-sm text-gray-600 bg-[#f5f0e6] p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>{t('tournaments.participants')}</span>
                                </div>
                                <span className="font-bold">{tournament.current_round || 0} / {tournament.max_players}</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Link to={`/TournamentDetail?id=${tournament.id}`} className="w-full">
                                <Button className="w-full bg-[#e8dcc5] hover:bg-[#d4c5b0] text-[#4a3728] border border-[#d4c5b0] group-hover:bg-[#4a3728] group-hover:text-[#e8dcc5] transition-all">
                                    {t('tournaments.view_btn')} <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {tournaments.length === 0 && (
                <div className="text-center py-20 bg-white/50 rounded-xl border-2 border-dashed border-[#d4c5b0]">
                    <Trophy className="w-16 h-16 mx-auto text-[#d4c5b0] mb-4" />
                    <h3 className="text-xl font-bold text-[#6b5138]">{t('tournaments.no_tournaments')}</h3>
                    <p className="text-gray-500">{t('tournaments.be_first')}</p>
                </div>
            )}
            </div>
            ) : (
                // CALENDAR VIEW
                <div className="bg-white rounded-xl border border-[#d4c5b0] shadow-lg overflow-hidden">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between p-4 bg-[#f5f0e6] border-b border-[#d4c5b0]">
                        <h2 className="text-xl font-bold text-[#4a3728] capitalize">
                            {formatDate(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date())}>
                                {t('tournaments.calendar_today')}
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 border-b border-[#d4c5b0] bg-[#e8dcc5]">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                            <div key={day} className="p-2 text-center text-xs font-bold text-[#4a3728] uppercase">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-[minmax(100px,auto)] bg-[#fdfbf7]">
                        {(() => {
                            const monthStart = startOfMonth(currentMonth);
                            const monthEnd = endOfMonth(monthStart);
                            const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
                            const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
                            const days = eachDayOfInterval({ start: startDate, end: endDate });

                            return days.map((day, idx) => {
                                const dayTournaments = tournaments.filter(t => isSameDay(new Date(t.start_date), day));
                                const isCurrentMonth = isSameMonth(day, monthStart);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div 
                                        key={day.toString()} 
                                        className={`min-h-[100px] p-2 border-b border-r border-[#f0e6d2] relative ${
                                            !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'text-[#4a3728]'
                                        } ${isToday ? 'bg-yellow-50' : ''}`}
                                    >
                                        <div className={`text-right text-xs font-bold mb-1 ${isToday ? 'text-yellow-600' : ''}`}>
                                            {format(day, 'd')}
                                        </div>
                                        <div className="space-y-1">
                                            {dayTournaments.map(t => (
                                                <Link to={`/TournamentDetail?id=${t.id}`} key={t.id}>
                                                    <div className={`text-[10px] p-1 rounded truncate cursor-pointer hover:opacity-80 flex items-center gap-1 ${
                                                        t.game_type === 'chess' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                        {t.game_type === 'chess' ? <Crown className="w-3 h-3 flex-shrink-0" /> : <Gamepad2 className="w-3 h-3 flex-shrink-0" />}
                                                        <span className="truncate">{t.name}</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}