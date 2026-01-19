import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Wallet, Plus, Minus, ArrowUpRight, ArrowDownLeft, History, Coins, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export default function WalletPage() {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDeposit, setShowDeposit] = useState(false);
    const [stripeProducts, setStripeProducts] = useState([]);
    const [selectedPrice, setSelectedPrice] = useState(null);
    const [loadingDeposit, setLoadingDeposit] = useState(false);
    const [productsLoading, setProductsLoading] = useState(false);

    const { t } = useLanguage();

    const fetchWallet = async () => {
        try {
            const user = await base44.auth.me();
            if (!user) return;

            // Get Balance
            const res = await base44.functions.invoke('walletManager', { action: 'get_balance', userId: user.id });
            setBalance(res.data.balance);

            // Get History
            const txs = await base44.entities.Transaction.filter({ user_id: user.id }, { created_date: -1 }, 20);
            setTransactions(txs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWallet();
    }, []);

    const handleDeposit = async () => {
        setShowDeposit(true);
        setProductsLoading(true);
        try {
            const res = await base44.functions.invoke('quoteCoinPackages', {});
            const list = res.data?.packages || [];
            setStripeProducts(list);
            setSelectedPrice(list[0] || null);
        } catch (e) {
            console.error(e);
            toast.error("Erreur de chargement des packs. Utilisation d'un tarif par défaut.");
            // Fallback local (XOF) pour garantir l'affichage
            const fb = [500,2000,3500,5000,10000].map(cfa => ({ cfa, coins: cfa, currency: 'XOF', amount: cfa }));
            setStripeProducts(fb);
            setSelectedPrice(fb[0]);
        } finally {
            setProductsLoading(false);
        }
    };

    const startCheckout = async () => {
        if (!selectedPrice?.id) return;
        setLoadingDeposit(true);
        try {
            const { data } = await base44.functions.invoke('coinCheckout', {
                packageCfa: selectedPrice.cfa
            });
            if (data?.url) {
                window.location.href = data.url;
            } else if (data?.sessionId) {
                window.location.href = `https://checkout.stripe.com/pay/${data.sessionId}`;
            } else {
                toast.error("Impossible d’ouvrir le paiement.");
            }
        } catch (e) {
            toast.error("Erreur de démarrage du paiement.");
        } finally {
            setLoadingDeposit(false);
        }
    };

    if (loading) return <div className="p-8 text-center">{t('wallet.loading') || "Chargement..."}</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            {/* Deposit Modal */}
            <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('wallet.buy_coins') || 'Acheter des Coins'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {productsLoading ? (
                            <div className="py-8 text-center text-sm text-gray-500">Chargement des options…</div>
                        ) : stripeProducts.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-500">
                                Aucune option Stripe trouvée. Ajoutez un Price dans Stripe.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {stripeProducts.map((p) => (
                                    <button
                                        key={p.cfa}
                                        onClick={() => setSelectedPrice(p)}
                                        className={`w-full border rounded-lg p-3 text-left ${selectedPrice?.cfa === p.cfa ? 'border-[#4a3728] bg-[#e8dcc5]' : 'border-gray-200 bg-white'}`}
                                    >
                                        <div className="font-medium text-[#4a3728]">{p.coins} D$</div>
                                        <div className="text-sm text-gray-600">
                                            {p.amount.toLocaleString(undefined,{style:'currency',currency:(p.currency||'USD').toUpperCase()})}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeposit(false)}>Annuler</Button>
                        <Button disabled={!selectedPrice || loadingDeposit || productsLoading} onClick={startCheckout} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                            {loadingDeposit ? 'Redirection…' : 'Payer avec Stripe'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="flex flex-col md:flex-row gap-6">
                {/* Balance Card */}
                <Card className="flex-1 bg-gradient-to-br from-[#4a3728] to-[#2c1e12] text-[#e8dcc5] border-none shadow-xl">
                    <CardContent className="p-8 flex flex-col justify-between h-full">
                        <div>
                            <h2 className="text-lg opacity-80 mb-1 flex items-center gap-2">
                                <Wallet className="w-5 h-5" /> {t('wallet.balance_available') || "Solde Disponible"}
                            </h2>
                            <div className="text-5xl font-black tracking-tight flex items-baseline gap-2">
                                {balance} <span className="text-xl opacity-60">D$</span>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <Button 
                                onClick={handleDeposit}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white border-none"
                            >
                                <Plus className="w-4 h-4 mr-2" /> {t('wallet.buy_coins') || "Acheter des Coins"}
                            </Button>
                            <Button 
                                onClick={async () => {
                                    const amount = prompt(t('wallet.withdraw_amount') || "Montant à retirer :");
                                    if (amount && !isNaN(amount) && amount > 0) {
                                        try {
                                            const res = await base44.functions.invoke('walletManager', { action: 'withdraw', amount: parseFloat(amount) });
                                            if (res.data.error) {
                                                toast.error(res.data.error);
                                            } else {
                                                toast.success(t('wallet.withdraw_success') || "Retrait demandé !");
                                                fetchWallet();
                                            }
                                        } catch(e) { toast.error(t('wallet.withdraw_error') || "Erreur retrait"); }
                                    }
                                }}
                                variant="outline"
                                className="flex-1 border-[#e8dcc5] text-[#e8dcc5] hover:bg-[#e8dcc5] hover:text-[#4a3728]"
                            >
                                <Minus className="w-4 h-4 mr-2" /> {t('wallet.withdraw') || "Retirer (Cash)"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats / Info */}
                <div className="flex-1 grid grid-cols-1 gap-4">
                    <Card className="bg-white border-[#d4c5b0]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-500">{t('wallet.total_earnings') || "Gains Totaux"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                                <ArrowUpRight className="w-5 h-5" />
                                {transactions.filter(t => t.amount > 0 && t.type === 'prize').reduce((acc, t) => acc + t.amount, 0)} D$
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border-[#d4c5b0]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-gray-500">{t('wallet.total_wagers') || "Mises Jouées"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-500 flex items-center gap-2">
                                <ArrowDownLeft className="w-5 h-5" />
                                {Math.abs(transactions.filter(t => t.amount < 0 && t.type === 'entry_fee').reduce((acc, t) => acc + t.amount, 0))} D$
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#4a3728] flex items-center gap-2">
                    <History className="w-5 h-5" /> {t('wallet.history') || "Historique des transactions"}
                </h3>
                <div className="bg-white rounded-xl border border-[#d4c5b0] overflow-hidden">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">{t('wallet.no_transactions') || "Aucune transaction récente."}</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {transactions.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {tx.type === 'deposit' ? <Plus className="w-5 h-5" /> : 
                                             tx.type === 'prize' ? <Trophy className="w-5 h-5" /> :
                                             <Coins className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-[#4a3728]">{tx.description || tx.type}</div>
                                            <div className="text-xs text-gray-500">
                                                {tx.created_date ? format(new Date(tx.created_date), 'Pp', { locale: fr }) : 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount} D$
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}