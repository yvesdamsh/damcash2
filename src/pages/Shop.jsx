import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShoppingBag, Lock, Check, Coins, Shield, Palette, User } from 'lucide-react';
import { toast } from 'sonner';
import WalletBalance from '@/components/WalletBalance';

export default function Shop() {
    const { t } = useLanguage();
    const [products, setProducts] = useState([]);
    const [ownedIds, setOwnedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [buying, setBuying] = useState(null);

    const fetchData = async () => {
        try {
            const u = await base44.auth.me();
            setUser(u);
            const res = await base44.functions.invoke('shopManager', { action: 'list_products' });
            setProducts(res.data.products || []);
            setOwnedIds(res.data.owned || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleBuy = async (product) => {
        if (!user) return;
        setBuying(product.id);
        try {
            const res = await base44.functions.invoke('shopManager', { 
                action: 'buy', 
                productId: product.id 
            });
            
            if (res.data.error) {
                toast.error(res.data.error);
            } else {
                toast.success(t('shop.buy_success'));
                setOwnedIds([...ownedIds, product.id]);
                // Trigger wallet refresh event if needed, or just rely on component polling
            }
        } catch (e) {
            toast.error(t('shop.buy_error'));
        } finally {
            setBuying(null);
        }
    };

    const ProductCard = ({ product }) => {
        const isOwned = ownedIds.includes(product.id);
        const isLocked = (user?.level || 1) < product.required_level;
        const canAfford = true; // Let backend handle, or check locally if balance available (need balance context)
        
        return (
            <Card className={`relative overflow-hidden border-[#d4c5b0] transition-all hover:shadow-lg ${isLocked ? 'opacity-70 bg-gray-50' : 'bg-white'}`}>
                {isOwned && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center shadow-sm z-10">
                        <Check className="w-3 h-3 mr-1" /> {t('shop.owned')}
                    </div>
                )}
                <div className="h-32 bg-[#f5f0e6] flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                    ) : (
                        <ShoppingBag className="w-12 h-12 text-[#d4c5b0]" />
                    )}
                    {isLocked && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="bg-black/80 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                                <Lock className="w-3 h-3 mr-1" /> {t('shop.locked_level', { level: product.required_level })}
                            </div>
                        </div>
                    )}
                </div>
                <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-[#4a3728] line-clamp-1">{t(product.name)}</h3>
                            <p className="text-xs text-gray-500">
                                {product.type === 'avatar' ? t('shop.type_avatar') : 
                                 product.type === 'avatar_frame' ? t('shop.type_avatar_frame') || 'Frame' :
                                 product.type === 'profile_theme' ? t('shop.type_profile_theme') || 'Profile Theme' :
                                 product.type === 'board_theme' || product.type === 'theme' ? t('shop.type_board_theme') || 'Board Theme' :
                                 t('shop.type_pieces')}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm text-[#6b5138] mb-4 line-clamp-2 h-10">{t(product.description)}</p>
                    
                    {isOwned ? (
                        <Button disabled className="w-full bg-gray-100 text-gray-400 border-0">
                            {t('shop.acquired')}
                        </Button>
                    ) : (
                        <Button 
                            onClick={() => handleBuy(product)} 
                            disabled={isLocked || buying === product.id}
                            className="w-full bg-[#4a3728] hover:bg-[#2c1e12] text-white font-bold"
                        >
                            {buying === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                <>
                                    <Coins className="w-4 h-4 mr-1 text-yellow-500" />
                                    {product.price}
                                </>
                            )}
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-[#4a3728]" /></div>;

    const avatars = products.filter(p => p.type === 'avatar');
    const frames = products.filter(p => p.type === 'avatar_frame');
    const profileThemes = products.filter(p => p.type === 'profile_theme');
    const boardThemes = products.filter(p => p.type === 'board_theme' || p.type === 'theme');
    const pieces = products.filter(p => p.type === 'piece_set');

    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#4a3728] flex items-center gap-3">
                        <ShoppingBag className="w-8 h-8" /> {t('shop.title')}
                    </h1>
                    <p className="text-[#6b5138]">{t('shop.subtitle')}</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-full shadow-sm border px-4">
                    <span className="text-sm font-bold text-gray-500 uppercase mr-2">{t('shop.balance')}</span>
                    <WalletBalance />
                </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="bg-[#e8dcc5] w-full justify-start overflow-x-auto">
                    <TabsTrigger value="all" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]">{t('shop.tab_all')}</TabsTrigger>
                    <TabsTrigger value="avatars" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]"><User className="w-4 h-4 mr-2"/> {t('shop.tab_avatars')}</TabsTrigger>
                    <TabsTrigger value="frames" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]"><User className="w-4 h-4 mr-2"/> {t('shop.tab_frames') || 'Frames'}</TabsTrigger>
                    <TabsTrigger value="profile" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]"><Palette className="w-4 h-4 mr-2"/> {t('shop.tab_profile') || 'Profile'}</TabsTrigger>
                    <TabsTrigger value="board" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]"><Palette className="w-4 h-4 mr-2"/> {t('shop.tab_board') || 'Board'}</TabsTrigger>
                    <TabsTrigger value="pieces" className="data-[state=active]:bg-[#4a3728] data-[state=active]:text-[#e8dcc5]"><Shield className="w-4 h-4 mr-2"/> {t('shop.tab_pieces')}</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="all" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {products.map(p => <ProductCard key={p.id} product={p} />)}
                    </TabsContent>
                    <TabsContent value="avatars" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {avatars.map(p => <ProductCard key={p.id} product={p} />)}
                    </TabsContent>
                    <TabsContent value="frames" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {frames.map(p => <ProductCard key={p.id} product={p} />)}
                    </TabsContent>
                    <TabsContent value="profile" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {profileThemes.map(p => <ProductCard key={p.id} product={p} />)}
                    </TabsContent>
                    <TabsContent value="board" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {boardThemes.map(p => <ProductCard key={p.id} product={p} />)}
                    </TabsContent>
                    <TabsContent value="pieces" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {pieces.map(p => <ProductCard key={p.id} product={p} />)}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}