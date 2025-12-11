import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Coins, TrendingUp, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function BettingPanel({ game, currentUser }) {
    const [amount, setAmount] = useState(10);
    const [pick, setPick] = useState(null);
    const [loading, setLoading] = useState(false);
    const [odds, setOdds] = useState({ white: 2.0, black: 2.0, draw: 3.0 });
    const [myBets, setMyBets] = useState([]);

    // Calculate Odds roughly
    useEffect(() => {
        if (!game) return;
        const eloA = game.white_player_elo || 1200;
        const eloB = game.black_player_elo || 1200;
        const probA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
        
        const oddsA = Math.max(1.1, Math.min((1 / probA) * 0.9, 10));
        const oddsB = Math.max(1.1, Math.min((1 / (1 - probA)) * 0.9, 10));
        
        setOdds({
            white: parseFloat(oddsA.toFixed(2)),
            black: parseFloat(oddsB.toFixed(2)),
            draw: 3.00
        });

        // Load existing bets
        if (currentUser) {
            base44.entities.Bet.filter({ game_id: game.id, user_id: currentUser.id }).then(setMyBets);
        }
    }, [game, currentUser]);

    const handlePlaceBet = async () => {
        if (!pick || amount <= 0) return;
        if (!currentUser) return toast.error("Connectez-vous pour parier");
        
        setLoading(true);
        try {
            const res = await base44.functions.invoke('walletManager', {
                action: 'place_bet',
                gameId: game.id,
                amount: parseFloat(amount),
                pick
            });

            if (res.data.error) {
                toast.error(res.data.error);
            } else {
                toast.success("Pari placé ! Bonne chance !");
                setMyBets([...myBets, res.data.bet]);
            }
        } catch (e) {
            toast.error("Erreur technique");
        } finally {
            setLoading(false);
        }
    };

    if (!game || game.status !== 'playing') {
        if (myBets.length > 0) {
            return (
                <div className="bg-white/90 p-4 rounded-lg border border-[#d4c5b0]">
                    <h3 className="font-bold text-[#4a3728] mb-2 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-600" /> Vos Paris
                    </h3>
                    <div className="space-y-2">
                        {myBets.map(bet => (
                            <div key={bet.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                                <span>{bet.pick === 'white' ? 'Blancs' : bet.pick === 'black' ? 'Noirs' : 'Nulle'}</span>
                                <span className={bet.status === 'won' ? 'text-green-600 font-bold' : bet.status === 'lost' ? 'text-red-500' : 'text-gray-500'}>
                                    {bet.status === 'won' ? `+${bet.potential_payout} D$` : bet.status === 'lost' ? `-${bet.amount} D$` : 'En attente'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
        <Card className="bg-[#fdfbf7] border-[#d4c5b0] shadow-sm">
            <CardHeader className="py-3 bg-[#f5f0e6] border-b border-[#e8dcc5]">
                <CardTitle className="text-sm font-bold text-[#4a3728] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" /> Paris en Direct
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    <Button 
                        variant={pick === 'white' ? 'default' : 'outline'}
                        onClick={() => setPick('white')}
                        className={`h-auto py-2 flex flex-col ${pick === 'white' ? 'bg-[#4a3728] text-white' : 'bg-white border-[#d4c5b0] text-[#6b5138]'}`}
                    >
                        <span className="text-xs font-bold">Blancs</span>
                        <span className="text-[10px]">x{odds.white}</span>
                    </Button>
                    <Button 
                        variant={pick === 'draw' ? 'default' : 'outline'}
                        onClick={() => setPick('draw')}
                        className={`h-auto py-2 flex flex-col ${pick === 'draw' ? 'bg-[#4a3728] text-white' : 'bg-white border-[#d4c5b0] text-[#6b5138]'}`}
                    >
                        <span className="text-xs font-bold">Nulle</span>
                        <span className="text-[10px]">x{odds.draw}</span>
                    </Button>
                    <Button 
                        variant={pick === 'black' ? 'default' : 'outline'}
                        onClick={() => setPick('black')}
                        className={`h-auto py-2 flex flex-col ${pick === 'black' ? 'bg-[#4a3728] text-white' : 'bg-white border-[#d4c5b0] text-[#6b5138]'}`}
                    >
                        <span className="text-xs font-bold">Noirs</span>
                        <span className="text-[10px]">x{odds.black}</span>
                    </Button>
                </div>

                {pick && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <Coins className="w-4 h-4 absolute left-2 top-2.5 text-yellow-600" />
                                <Input 
                                    type="number" 
                                    min="10" 
                                    value={amount} 
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pl-8 h-9 border-[#d4c5b0] bg-white text-sm"
                                />
                            </div>
                            <Button onClick={handlePlaceBet} disabled={loading} className="bg-green-600 hover:bg-green-700 h-9 text-xs">
                                {loading ? '...' : 'Parier'}
                            </Button>
                        </div>
                        <div className="text-xs text-center text-gray-500">
                            Gain potentiel: <span className="font-bold text-green-600">{Math.floor(amount * odds[pick])} D$</span>
                        </div>
                    </div>
                )}

                {myBets.length > 0 && (
                    <div className="border-t border-[#e8dcc5] pt-2 mt-2">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Vos Paris</p>
                        <div className="space-y-1">
                            {myBets.map(bet => (
                                <div key={bet.id} className="flex justify-between text-xs text-[#6b5138]">
                                    <span>{bet.pick} ({bet.amount} D$)</span>
                                    <span className={bet.status === 'pending' ? 'text-blue-500' : 'text-gray-500'}>{bet.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}