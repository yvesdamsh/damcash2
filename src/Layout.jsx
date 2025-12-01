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
  Brain
  } from 'lucide-react';
  import Notifications from '@/components/Notifications';
  import FriendsManager from '@/components/FriendsManager';

  export default function Layout({ children }) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [soundEnabled, setSoundEnabled] = React.useState(true);
    const location = useLocation();
    const [user, setUser] = React.useState(null);

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

    const navItems = [
        { label: 'Accueil', path: '/Home', icon: Home },
        { label: 'Tournois', path: '/Tournaments', icon: Flag },
        { label: 'Entraînement', path: '/Training', icon: Brain },
        { label: 'Damcash TV', path: '/Spectate', icon: Eye },
        { label: 'Classement', path: '/Leaderboard', icon: Trophy },
        { label: 'Profil', path: '/Profile', icon: User },
    ];

    const handleLogout = async () => {
        await base44.auth.logout();
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
                                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full shadow-lg border-2 border-[#e8dcc5] flex items-center justify-center transform group-hover:scale-110 transition-transform">
                                    <span className="text-[#2c1e12] font-black text-lg">D</span>
                                    <span className="text-[#e8dcc5] font-black text-lg -ml-1">$</span>
                                </div>
                                <span className="font-black text-2xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#e8dcc5] to-yellow-500 drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                                    DAMCASH
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center space-x-4">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                // Case insensitive check for active route
                                const isActive = location.pathname.toLowerCase() === item.path.toLowerCase();
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                                            ${isActive 
                                                ? 'bg-[#6b5138] text-white shadow-inner' 
                                                : 'hover:bg-[#5c4430] text-[#d4c5b0]'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                                })}

                                {user && <Notifications />}
                                {user && <FriendsManager />}

                                <button 
                                    onClick={toggleSound}
                                className="p-2 rounded-full hover:bg-[#5c4430] text-[#d4c5b0] transition-colors"
                                >
                                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                </button>
                                {user && (
                                <button
                                    onClick={handleLogout}
                                    className="px-3 py-2 rounded-md text-sm font-medium text-red-300 hover:bg-[#5c4430] hover:text-red-200 flex items-center gap-2 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Déconnexion
                                </button>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <div className="flex items-center md:hidden">
                            <button
                                onClick={toggleMenu}
                                className="inline-flex items-center justify-center p-2 rounded-md text-[#d4c5b0] hover:bg-[#5c4430] focus:outline-none"
                            >
                                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="md:hidden bg-[#4a3728] border-t border-[#5c4430] overflow-hidden"
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
                                        toggleSound();
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2"
                                >
                                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                    Son: {soundEnabled ? 'Activé' : 'Désactivé'}
                                </button>
                                {user && (
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:bg-[#5c4430] hover:text-red-200 flex items-center gap-2"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        Déconnexion
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40">
                {children}
            </main>
        </div>
    );
}