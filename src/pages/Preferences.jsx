import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Volume2, Bell, Palette, Layout, Loader2 } from 'lucide-react';
import { soundManager } from '@/components/SoundManager';

export default function Preferences() {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferences, setPreferences] = useState({
        checkers_theme: 'classic',
        chess_theme: 'classic',
        checkers_pieces: 'standard',
        chess_pieces: 'standard',
        sound_move: true,
        sound_capture: true,
        sound_notify: true,
        notifications_browser: true,
        notify_tournament: true,
        notify_match: true,
        notify_invite: true,
        notify_game_started: true,
        notify_your_turn: true,
        notify_friend_request: true,
        notify_friend_online: true,
        notifications_email: false
    });

    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                const user = await base44.auth.me();
                if (user && user.preferences) {
                    setPreferences(prev => ({ ...prev, ...user.preferences }));
                } else {
                    // Load defaults or from localStorage if user has no prefs saved yet
                    const localSound = localStorage.getItem('soundEnabled') !== 'false';
                    setPreferences(prev => ({ ...prev, sound_move: localSound, sound_capture: localSound, sound_notify: localSound }));
                }
            } catch (error) {
                console.error("Failed to load preferences", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPreferences();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await base44.auth.updateMe({ preferences });
            
            // Sync with SoundManager/LocalStorage
            localStorage.setItem('damcash_sound_move', preferences.sound_move);
            localStorage.setItem('damcash_sound_capture', preferences.sound_capture);
            localStorage.setItem('damcash_sound_notify', preferences.sound_notify);

            // Global toggle if all are off
            if (preferences.sound_move || preferences.sound_capture || preferences.sound_notify) {
                localStorage.setItem('soundEnabled', 'true');
                if (!soundManager.isEnabled()) soundManager.toggle();
            } else {
                localStorage.setItem('soundEnabled', 'false');
                if (soundManager.isEnabled()) soundManager.toggle();
            }

            toast.success(t('common.saved') || "Préférences enregistrées");
        } catch (error) {
            console.error("Failed to save preferences", error);
            toast.error(t('common.error') || "Erreur lors de l'enregistrement");
        } finally {
            setSaving(false);
        }
    };

    const updatePref = (key, value) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-[#4a3728] dark:text-[#e8dcc5]">
                        {t('nav.preferences') || "Préférences"}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('preferences.subtitle') || "Personnalisez votre expérience de jeu"}
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {t('common.save') || "Enregistrer"}
                </Button>
            </div>

            <Tabs defaultValue="visual" className="w-full">
                <TabsList className="bg-[#f5f0e6] dark:bg-[#2c1e12] p-1">
                    <TabsTrigger value="visual" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Palette className="w-4 h-4 mr-2" /> {t('preferences.visual') || "Visuel"}
                    </TabsTrigger>
                    <TabsTrigger value="sound" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Volume2 className="w-4 h-4 mr-2" /> {t('preferences.sound') || "Son"}
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">
                        <Bell className="w-4 h-4 mr-2" /> {t('preferences.notifications') || "Notifications"}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="visual" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layout className="w-5 h-5" /> {t('game.checkers') || "Dames"}
                            </CardTitle>
                            <CardDescription>Personnalisez l'apparence du jeu de dames</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Thème du plateau</Label>
                                    <Select value={preferences.checkers_theme} onValueChange={(v) => updatePref('checkers_theme', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir un thème" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="classic">Classique (Bois)</SelectItem>
                                            <SelectItem value="dark">Sombre</SelectItem>
                                            <SelectItem value="blue">Bleu</SelectItem>
                                            <SelectItem value="green">Vert</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Style des pièces</Label>
                                    <Select value={preferences.checkers_pieces} onValueChange={(v) => updatePref('checkers_pieces', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir un style" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">Standard</SelectItem>
                                            <SelectItem value="minimal">Minimaliste</SelectItem>
                                            <SelectItem value="modern">Moderne 3D</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layout className="w-5 h-5" /> {t('game.chess') || "Échecs"}
                            </CardTitle>
                            <CardDescription>Personnalisez l'apparence du jeu d'échecs</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Thème du plateau</Label>
                                    <Select value={preferences.chess_theme} onValueChange={(v) => updatePref('chess_theme', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir un thème" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="classic">Classique (Bois)</SelectItem>
                                            <SelectItem value="green">Vert Tournoi</SelectItem>
                                            <SelectItem value="blue">Bleu Glacé</SelectItem>
                                            <SelectItem value="gray">Gris Moderne</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Jeu de pièces</Label>
                                    <Select value={preferences.chess_pieces} onValueChange={(v) => updatePref('chess_pieces', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir un style" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">Staunton</SelectItem>
                                            <SelectItem value="alpha">Alpha</SelectItem>
                                            <SelectItem value="pixel">Pixel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sound" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paramètres Audio</CardTitle>
                            <CardDescription>Gérez les effets sonores du jeu</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Sons de déplacement</Label>
                                    <div className="text-sm text-gray-500">Jouer un son à chaque mouvement</div>
                                </div>
                                <Switch 
                                    checked={preferences.sound_move} 
                                    onCheckedChange={(c) => updatePref('sound_move', c)} 
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Sons de capture</Label>
                                    <div className="text-sm text-gray-500">Jouer un son distinct lors d'une capture</div>
                                </div>
                                <Switch 
                                    checked={preferences.sound_capture} 
                                    onCheckedChange={(c) => updatePref('sound_capture', c)} 
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Sons de notification</Label>
                                    <div className="text-sm text-gray-500">Alertes (tour de jeu, invitation, chat)</div>
                                </div>
                                <Switch 
                                    checked={preferences.sound_notify} 
                                    onCheckedChange={(c) => updatePref('sound_notify', c)} 
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notifications</CardTitle>
                            <CardDescription>Gérez comment vous souhaitez être alerté</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Notifications Navigateur</Label>
                                    <div className="text-sm text-gray-500">Recevoir des notifications push lorsque ce n'est pas à vous de jouer</div>
                                </div>
                                <Switch 
                                    checked={preferences.notifications_browser} 
                                    onCheckedChange={(c) => {
                                        updatePref('notifications_browser', c);
                                        if (c && 'Notification' in window && Notification.permission !== 'granted') {
                                            Notification.requestPermission();
                                        }
                                    }} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Tournois</Label>
                                    <div className="text-sm text-gray-500">Alertes de début/fin de tournoi et inscriptions</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_tournament !== false} 
                                    onCheckedChange={(c) => updatePref('notify_tournament', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Matchs & Appariements</Label>
                                    <div className="text-sm text-gray-500">Alertes quand un match commence ou qu'un appariement est prêt</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_match !== false} 
                                    onCheckedChange={(c) => updatePref('notify_match', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Invitations</Label>
                                    <div className="text-sm text-gray-500">Invitations directes d'autres joueurs</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_invite !== false} 
                                    onCheckedChange={(c) => updatePref('notify_invite', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Début de partie</Label>
                                    <div className="text-sm text-gray-500">Alerte quand une partie commence</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_game_started !== false} 
                                    onCheckedChange={(c) => updatePref('notify_game_started', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>À votre tour</Label>
                                    <div className="text-sm text-gray-500">Notification quand c'est votre tour</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_your_turn !== false} 
                                    onCheckedChange={(c) => updatePref('notify_your_turn', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Demandes d'amis</Label>
                                    <div className="text-sm text-gray-500">Alerte quand quelqu'un vous ajoute</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_friend_request !== false} 
                                    onCheckedChange={(c) => updatePref('notify_friend_request', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Amis en ligne</Label>
                                    <div className="text-sm text-gray-500">Alerte quand un ami se connecte</div>
                                </div>
                                <Switch 
                                    checked={preferences.notify_friend_online !== false} 
                                    onCheckedChange={(c) => updatePref('notify_friend_online', c)} 
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Email</Label>
                                    <div className="text-sm text-gray-500">Recevoir aussi par email</div>
                                </div>
                                <Switch 
                                    checked={preferences.notifications_email === true} 
                                    onCheckedChange={(c) => updatePref('notifications_email', c)} 
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}