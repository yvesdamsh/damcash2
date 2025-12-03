import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';

export default function GameSettings({ user, onUpdate }) {
    const [prefs, setPrefs] = useState({
        chess_theme: 'standard',
        chess_pieces: 'standard',
        checkers_theme: 'standard',
        checkers_pieces: 'standard'
    });

    const [ownedThemes, setOwnedThemes] = useState([]);
    const [ownedPieces, setOwnedPieces] = useState([]);

    useEffect(() => {
        const init = async () => {
            if (user?.preferences) {
                setPrefs({
                    chess_theme: user.preferences.chess_theme || 'standard',
                    chess_pieces: user.preferences.chess_pieces || 'standard',
                    checkers_theme: user.preferences.checkers_theme || 'standard',
                    checkers_pieces: user.preferences.checkers_pieces || 'standard'
                });
            }
            // Fetch owned items
            try {
                const res = await base44.functions.invoke('shopManager', { action: 'list_products' });
                if (res.data.owned) {
                    // Filter local constant lists or rely on backend?
                    // For simplicity, let's just assume standard ones are always available + owned ones
                    // But I need to know WHICH select item corresponds to WHICH product ID.
                    // The Shop uses Product IDs. The settings use strings like 'wood', 'blue'.
                    // I should map them or update Product creation to match these values.
                    // My product creation used 'dark_wood' for value.
                    // I'll add logic to merge standard options with owned options.
                    const products = res.data.products || [];
                    const ownedIds = res.data.owned || [];
                    
                    const myProducts = products.filter(p => ownedIds.includes(p.id));
                    
                    const themes = myProducts.filter(p => p.type === 'theme').map(p => ({ value: p.value, label: p.name }));
                    const pieces = myProducts.filter(p => p.type === 'piece_set').map(p => ({ value: p.value, label: p.name }));
                    
                    setOwnedThemes(themes);
                    setOwnedPieces(pieces);
                }
            } catch (e) {}
        };
        init();
    }, [user]);

    const handleSave = async () => {
        try {
            await base44.auth.updateMe({ preferences: prefs });
            toast.success("Préférences sauvegardées !");
            if (onUpdate) onUpdate();
        } catch (e) {
            toast.error("Erreur lors de la sauvegarde");
        }
    };

    // Wager logic (passed from parent usually, but here we are in settings - assume this component is ALSO used for Create Game?)
    // If this component is strictly "Preferences", I should create a "CreateGameModal" or modify where game creation happens.
    // The user asked to modify "Home" or "GameSettings". Let's assume Game Creation is not in "GameSettings" (which looks like user prefs).
    // I will look at Home.js to see how games are created.
    // But wait, I'm in tool call. I will finish editing Layout/etc and then check Home.js.

    return (
        <div className="space-y-6 py-4">
            <Tabs defaultValue="chess" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chess">Échecs</TabsTrigger>
                    <TabsTrigger value="checkers">Dames</TabsTrigger>
                </TabsList>

                <TabsContent value="chess" className="space-y-4 mt-4">
                    <div className="grid gap-2">
                        <Label>Thème du plateau</Label>
                        <Select value={prefs.chess_theme} onValueChange={(v) => setPrefs({...prefs, chess_theme: v})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un thème" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Vert (Standard)</SelectItem>
                                <SelectItem value="wood">Bois (Classique)</SelectItem>
                                <SelectItem value="blue">Bleu (Moderne)</SelectItem>
                                {ownedThemes.map(t => <SelectItem key={t.value} value={t.value}>{t.label} (Débloqué)</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Style des pièces</Label>
                        <Select value={prefs.chess_pieces} onValueChange={(v) => setPrefs({...prefs, chess_pieces: v})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un style" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Standard (Images)</SelectItem>
                                <SelectItem value="unicode">Minimaliste (Symboles)</SelectItem>
                                {ownedPieces.map(p => <SelectItem key={p.value} value={p.value}>{p.label} (Débloqué)</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </TabsContent>

                <TabsContent value="checkers" className="space-y-4 mt-4">
                    <div className="grid gap-2">
                        <Label>Thème du plateau</Label>
                        <Select value={prefs.checkers_theme} onValueChange={(v) => setPrefs({...prefs, checkers_theme: v})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un thème" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Bois (Standard)</SelectItem>
                                <SelectItem value="classic">Rouge & Noir (Classique)</SelectItem>
                                <SelectItem value="modern">Bleu & Blanc (Moderne)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Design des pions</Label>
                        <Select value={prefs.checkers_pieces} onValueChange={(v) => setPrefs({...prefs, checkers_pieces: v})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un design" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">3D Réaliste</SelectItem>
                                <SelectItem value="flat">Plat (Flat Design)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </TabsContent>
            </Tabs>

            <Button onClick={handleSave} className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5]">
                Enregistrer les préférences
            </Button>
        </div>
    );
}