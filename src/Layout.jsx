import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { 
  Trophy, 
  User, 
  Gamepad2, 
  LogOut, 
  Menu, 
  X,
  Volume2,
  VolumeX,
  Home,
  Flag,
  Eye,
  Brain,
  Shield,
  Users
  } from 'lucide-react';
  import Notifications from '@/components/Notifications';
          import FriendsManager from '@/components/FriendsManager';
          import WalletBalance from '@/components/WalletBalance';

          export default function Layout({ children }) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [soundEnabled, setSoundEnabled] = React.useState(true);
    const [gameMode, setGameMode] = React.useState(localStorage.getItem('gameMode') || 'checkers');
    const location = useLocation();
    const [user, setUser] = React.useState(null);

    // Save last location for persistent navigation (excluding Profile)
    React.useEffect(() => {
        const path = location.pathname.toLowerCase();
        // If we are on Profile, DO NOT save it.
        // If we are on Home, Lobby, etc., save it.
        if (location.pathname !== '/' && !path.includes('login') && !path.includes('profile')) {
             localStorage.setItem('damcash_last_path', location.pathname);
        } else if (path.includes('profile')) {
             // If user navigates to profile, do not update the last path (keep the previous one, e.g. Home)
             // Or forcingly set it to Home to be safe?
             // Let's leave it as is (keeping previous safe path), or if null, set Home.
             if (!localStorage.getItem('damcash_last_path')) {
                 localStorage.setItem('damcash_last_path', '/Home');
             }
        }
    }, [location]);

    // Sync Game Mode
    const toggleGameMode = () => {
        const newMode = gameMode === 'checkers' ? 'chess' : 'checkers';
        setGameMode(newMode);
        localStorage.setItem('gameMode', newMode);
        window.dispatchEvent(new Event('gameModeChanged'));
    };

    // Listen for external changes to game mode
    React.useEffect(() => {
        const handleStorageChange = () => {
            const mode = localStorage.getItem('gameMode');
            if (mode && mode !== gameMode) setGameMode(mode);
        };
        window.addEventListener('gameModeChanged', handleStorageChange);
        return () => window.removeEventListener('gameModeChanged', handleStorageChange);
    }, [gameMode]);

    // Heartbeat for Online Status
    React.useEffect(() => {
        const heartbeat = async () => {
            try {
                const me = await base44.auth.me();
                if (me) {
                    await base44.auth.updateMe({ last_seen: new Date().toISOString() });
                }
            } catch(e) {}
        };

        heartbeat(); // Initial call
        const interval = setInterval(heartbeat, 60000); // Every minute
        return () => clearInterval(interval);
    }, []);

    // Sync with SoundManager on mount
    React.useEffect(() => {
        // Import dynamically or assume global if we could, but better to use the file logic
        // For now we just init state from localStorage logic which SoundManager uses
        const saved = localStorage.getItem('soundEnabled');
        setSoundEnabled(saved !== 'false');
    }, []);

    React.useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
            } catch (e) {
                // Not logged in
            }
        };
        checkUser();
    }, []);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    
    const toggleSound = () => {
        // We need to update the manager and state
        import('@/components/SoundManager').then(({ soundManager }) => {
            const newState = soundManager.toggle();
            setSoundEnabled(newState);
        });
    };

    // Filter items based on auth state to save space
    const navItems = [
        { label: 'Accueil', path: '/Home', icon: Home, public: true },
        { label: 'Salon', path: '/Lobby', icon: Users, public: true },
        { label: 'Ligues', path: '/Leagues', icon: Shield, public: true },
        { label: 'Tournois', path: '/Tournaments', icon: Flag, public: true },
        { label: 'Classement', path: '/Leaderboard', icon: Trophy, public: true },
        // Private items
        { label: 'Équipes', path: '/Teams', icon: Users, public: false },
        { label: 'Entraînement', path: '/Training', icon: Brain, public: false },
        { label: 'Profil', path: '/Profile', icon: User, public: false },
    ].filter(item => user || item.public);

    const handleLogout = (e) => {
        if (e) e.preventDefault();
        try {
            // Use SDK built-in redirect
            base44.auth.logout('/Home');
            // Safety fallback
            setTimeout(() => {
                window.location.href = '/Home';
            }, 500);
        } catch (err) {
            window.location.href = '/Home';
        }
    };

    // Mobile Viewport Optimization
    React.useEffect(() => {
        let meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = "viewport";
            document.head.appendChild(meta);
        }
        meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    }, []);

    return (
        <div className="min-h-screen font-sans text-slate-900 bg-[#e8dcc5] bg-opacity-80 relative">
            {/* Background Wood Texture */}
            <div 
                className="fixed inset-0 z-0 opacity-40 pointer-events-none"
                style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1575018288729-6e0993577181?q=80&w=2574&auto=format&fit=crop')`,
                    backgroundSize: 'cover',
                    filter: 'sepia(0.3) contrast(1.1)'
                }}
            />

            {/* Navbar */}
            <nav className="relative z-[100] bg-[#4a3728] text-[#e8dcc5] shadow-lg border-b-4 border-[#2c1e12]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/Home" className="flex-shrink-0 flex items-center gap-2 group">
                                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full shadow-lg border-2 border-[#e8dcc5] flex items-center justify-center transform group-hover:scale-110 transition-transform">
                                    <span className="text-[#2c1e12] font-black text-base lg:text-lg">D</span>
                                    <span className="text-[#e8dcc5] font-black text-base lg:text-lg -ml-1">$</span>
                                </div>
                                <span className="font-black text-xl lg:text-2xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#e8dcc5] to-yellow-500 drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                                    DAMCASH
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Actions (Nav items moved to hamburger) */}
                        <div className="hidden md:flex items-center space-x-1 lg:space-x-4">
                                {/* Game Mode Toggle */}
                                <button
                                    onClick={toggleGameMode}
                                    className={`px-3 py-2 rounded-md text-sm font-bold transition-all border flex items-center gap-2 shadow-sm
                                        ${gameMode === 'chess' 
                                            ? 'bg-[#6B8E4E] text-white border-[#3d2b1f] hover:bg-[#5a7a40]' 
                                            : 'bg-[#e8dcc5] text-[#4a3728] border-[#d4c5b0] hover:bg-[#d4c5b0]'
                                        }`}
                                >
                                    {gameMode === 'chess' ? '♟️ Échecs' : '⚪ Dames'}
                                </button>

                                {user && (
                                    <>
                                        <Notifications />
                                        <FriendsManager />
                                    </>
                                )}

                                <button 
                                    onClick={toggleSound}
                                    className="p-2 rounded-full hover:bg-[#5c4430] text-[#d4c5b0] transition-colors"
                                    title={soundEnabled ? "Couper le son" : "Activer le son"}
                                >
                                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                </button>
                                {user ? (
                                <div className="flex items-center gap-2">
                                    <span className="hidden xl:block text-xs text-[#d4c5b0] max-w-[100px] truncate">
                                        {user.full_name || user.email?.split('@')[0] || 'Invité'}
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        className="px-3 py-2 rounded-md text-sm font-medium text-red-300 hover:bg-[#5c4430] hover:text-red-200 flex items-center gap-2 transition-colors"
                                        title="Se déconnecter"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Déconnexion</span>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => base44.auth.redirectToLogin('/Home')}
                                    className="px-3 py-2 rounded-md text-sm font-bold bg-[#b8860b] text-white hover:bg-[#9a7009] flex items-center gap-2 transition-colors shadow-md"
                                >
                                    <User className="w-4 h-4" />
                                    Connexion
                                </button>
                            )}
                        </div>

                        {/* Menu button (Visible on all screens) */}
                        <div className="flex items-center pl-4">
                            <button
                                onClick={toggleMenu}
                                className="inline-flex items-center justify-center p-2 rounded-md text-[#d4c5b0] hover:bg-[#5c4430] focus:outline-none"
                            >
                                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu (Dropdown) */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-[#4a3728] border-t border-[#5c4430] overflow-hidden absolute w-full z-50 shadow-xl"
                        >
                            <div className="px-2 pt-2 pb-3 space-y-1">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setIsMenuOpen(false)}
                                            className="block px-3 py-2 rounded-md text-base font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2"
                                        >
                                            <Icon className="w-5 h-5" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                                <button
                                    onClick={() => {
                                        toggleGameMode();
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2"
                                >
                                    {gameMode === 'chess' ? '♟️' : '⚪'} Mode: {gameMode === 'chess' ? 'Échecs' : 'Dames'}
                                </button>
                                <button
                                    onClick={() => {
                                        toggleSound();
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2"
                                >
                                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                    Son: {soundEnabled ? 'Activé' : 'Désactivé'}
                                </button>
                                {user ? (
                                    <>
                                        <div className="px-3 py-2 text-sm text-[#d4c5b0] border-b border-[#5c4430]/50 mb-1">
                                            Connecté: <span className="font-bold text-white">{user.full_name || user.email || 'Invité'}</span>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:bg-[#5c4430] hover:text-red-200 flex items-center gap-2"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            Déconnexion
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => base44.auth.redirectToLogin('/Home')}
                                        className="w-full text-left px-3 py-2 rounded-md text-base font-bold text-[#b8860b] hover:bg-[#5c4430] hover:text-white flex items-center gap-2"
                                    >
                                        <User className="w-5 h-5" />
                                        Connexion / Inscription
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Main Content */}
            <main className={`relative z-10 max-w-7xl mx-auto sm:px-6 lg:px-8 py-8 pb-40 ${location.pathname.toLowerCase().startsWith('/game') ? 'px-0' : 'px-4'}`}>
                {children}
            </main>
        </div>
    );
}