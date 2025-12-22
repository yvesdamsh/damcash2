import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import IntroAnimation from '@/components/IntroAnimation';
import { LanguageProvider, useLanguage } from '@/components/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
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
  Eye as EyeIcon,
  Brain,
  Shield,
  Users,
  PlayCircle,
  ShoppingBag,
  History,
  LogIn,
  Settings
  } from 'lucide-react';
import Notifications from '@/components/Notifications';
import SettingsMenu from '@/components/SettingsMenu';
import FriendsManager from '@/components/FriendsManager';
import WalletBalance from '@/components/WalletBalance';
import { RealTimeProvider } from '@/components/RealTimeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import UsernameSetupDialog from '@/components/UsernameSetupDialog';

export default function Layout({ children }) {
    return (
      <ErrorBoundary>
        <LanguageProvider>
          <RealTimeProvider>
            <LayoutContent>{children}</LayoutContent>
          </RealTimeProvider>
        </LanguageProvider>
      </ErrorBoundary>
    );
}

function LayoutContent({ children }) {
    const { t, language } = useLanguage();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [soundEnabled, setSoundEnabled] = React.useState(true);
    const [appTheme, setAppTheme] = React.useState(localStorage.getItem('appTheme') || 'light');
    const [gameMode, setGameMode] = React.useState(localStorage.getItem('gameMode') || 'checkers');
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [showIntro, setShowIntro] = React.useState(!window.hasShownIntro);
    const [isFramed, setIsFramed] = React.useState(false);
    const [isAuthed, setIsAuthed] = React.useState(false);

    React.useEffect(() => {
        // Initial app load logic
        if (!window.hasShownIntro) {
            window.hasShownIntro = true;
            
            const path = location.pathname.toLowerCase();
            // If landing on Profile or Login initially, FORCE redirect to Home
            if (path.includes('profile') || path.includes('login')) {
                // Use window.location for hard redirect if needed, but navigate should work
                navigate('/Home', { replace: true });
                // We keep showIntro true so it shows on Home
            }

            const timer = setTimeout(() => setShowIntro(false), 7000);
            return () => clearTimeout(timer);
        } else {
             // Subsequent navigations
             const path = location.pathname.toLowerCase();
             if (path.includes('login')) {
                 navigate('/Home', { replace: true });
             }
        }
    }, []); // Run once on mount to handle initial load state correctly

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
        if (!user) return; // Only run heartbeat if we have a user in state

        const heartbeat = async () => {
            try {
                // Double check with API to be safe
                const me = await base44.auth.me();
                if (me) {
                    await base44.auth.updateMe({ last_seen: new Date().toISOString() });
                }
            } catch(e) {}
        };

        heartbeat();
        const interval = setInterval(heartbeat, 60000); 
        return () => clearInterval(interval);
    }, [user]);

    // Sync with SoundManager on mount
    React.useEffect(() => {
        // Import dynamically or assume global if we could, but better to use the file logic
        // For now we just init state from localStorage logic which SoundManager uses
        const saved = localStorage.getItem('soundEnabled');
        setSoundEnabled(saved !== 'false');
    }, []);

    // Theme Management
    const handleThemeChange = (newTheme) => {
        setAppTheme(newTheme);
        localStorage.setItem('appTheme', newTheme);
    };

    // Apply global theme class
    React.useEffect(() => {
        const isDark = appTheme === 'dark' || (appTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [appTheme]);

    React.useEffect(() => {
        setIsFramed(() => {
            try { return window.self !== window.top; } catch (_) { return true; }
        });
        const checkUser = async () => {
            try {
                const currentUser = await base44.auth.me().catch(() => null);
                setUser(currentUser);
            } catch (e) {
                console.error("Auth check failed", e);
            } finally {
                const authed = await base44.auth.isAuthenticated().catch(() => false);
                setIsAuthed(authed);
            }
        };
        checkUser();
    }, []);

    // If the app is embedded (iframe) and user isn't authenticated, force open in top window
    React.useEffect(() => {
        if (isFramed && !isAuthed) {
            const t = setTimeout(() => {
                try { window.top.location.href = window.location.href; } catch (_) {}
            }, 800);
            return () => clearTimeout(t);
        }
    }, [isFramed, isAuthed]);

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
        { label: t('nav.home'), path: '/Home', icon: Home, public: true },
        
        { label: t('nav.lobby'), path: '/Lobby', icon: Users, public: true },
        { label: t('nav.leagues'), path: '/Leagues', icon: Shield, public: true },
        { label: t('nav.tournaments'), path: '/Tournaments', icon: Flag, public: true },
        { label: t('nav.leaderboard'), path: '/Leaderboard', icon: Trophy, public: true },
        { label: t('nav.shop'), path: '/Shop', icon: ShoppingBag, public: true },
        { label: t('nav.academy'), path: '/Academy', icon: Brain, public: true },
        // Private items
        { label: t('nav.history'), path: '/GameHistory', icon: History, public: false },
        { label: t('nav.replays'), path: '/ReplayCenter', icon: PlayCircle, public: false },
        { label: t('nav.teams'), path: '/Teams', icon: Users, public: false },
        { label: t('nav.training'), path: '/Training', icon: Brain, public: false },
        { label: t('nav.profile'), path: '/Profile', icon: User, public: false },
        { label: t('nav.preferences'), path: '/Preferences', icon: Settings, public: false },
        ...(user?.role === 'admin' ? [{ label: t('nav.admin'), path: '/AdminDashboard', icon: Shield, public: false }] : []),
        ].filter(item => user || item.public);

    const handleLogout = async () => {
        try {
            // Use absolute URL to ensure correct redirection
            await base44.auth.logout(window.location.origin);
        } catch (e) {
            console.error("Logout error", e);
            window.location.href = '/';
        }
    };

    const handleLogin = () => {
        // Redirect to platform login
        base44.auth.redirectToLogin(window.location.origin + '/Home');
    };

    // handleLogout removed

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

    // Elegant dark mode palette
    const isDark = appTheme === 'dark' || (appTheme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const activeNavTheme = isDark 
        ? "bg-[#1a120b] text-[#e8dcc5] border-[#3d2b1f]" 
        : "bg-[#4a3728] text-[#e8dcc5] border-[#2c1e12]";

    return (
        <div className={`min-h-screen font-sans relative transition-colors duration-300 ${isDark ? 'bg-[#0f0a06] text-[#e8dcc5]' : 'bg-[#e8dcc5] text-slate-900'}`}>
            <AnimatePresence>
                {showIntro && (
                    <motion.div 
                        className="fixed inset-0 z-[200]"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                    >
                        <IntroAnimation />
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Background Wood Texture */}
            <div 
                className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-500 ${isDark ? 'opacity-10 mix-blend-overlay' : 'opacity-40'}`}
                style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1575018288729-6e0993577181?q=80&w=2574&auto=format&fit=crop')`,
                    backgroundSize: 'cover',
                    filter: isDark ? 'grayscale(0.5) contrast(1.2)' : 'sepia(0.3) contrast(1.1)'
                }}
            />

            {/* Navbar */}
            <nav className={`relative z-[100] shadow-lg border-b-4 transition-colors duration-300 ${activeNavTheme}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/Home" className="flex-shrink-0 flex items-center gap-2 group">
                                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full shadow-lg border-2 border-[#e8dcc5] overflow-hidden transform group-hover:scale-110 transition-transform">
                                    <img
                                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/b31958665_Screenshot2025-12-21at121530AM.png"
                                      alt="DamCash Logo"
                                      className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="font-black text-xl lg:text-2xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#e8dcc5] to-yellow-500 drop-shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
                                    DAMCASH
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Actions (Nav items moved to hamburger) */}
                        <div className="hidden md:flex items-center space-x-1 lg:space-x-4">
                              <LanguageSwitcher />
                              {/* Game Mode Toggle */}
                                <button
                                    onClick={toggleGameMode}
                                    className={`px-3 py-2 rounded-md text-sm font-bold transition-all border flex items-center gap-2 shadow-sm
                                        ${gameMode === 'chess' 
                                            ? 'bg-[#6B8E4E] text-white border-[#3d2b1f] hover:bg-[#5a7a40]' 
                                            : 'bg-[#e8dcc5] text-[#4a3728] border-[#d4c5b0] hover:bg-[#d4c5b0]'
                                        }`}
                                >
                                    {gameMode === 'chess' ? `♟️ ${t('game.chess')}` : `⚪ ${t('game.checkers')}`}
                                </button>

                                {user && (
                                  <>
                                      <div className="flex items-center mr-2 hidden lg:flex gap-2">
                                          <WalletBalance />
                                          <div className="text-xs font-bold text-[#d4c5b0] bg-[#2c1e12]/50 px-2 py-1 rounded-full border border-yellow-500/30">
                                              Lvl {user.level || 1}
                                          </div>
                                      </div>
                                      {/* Moved Notifications to mobile-friendly area */}
                                      <div className="hidden md:block">
                                          <FriendsManager />
                                      </div>
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
                                    <button 
                                        onClick={handleLogout}
                                        className="p-2 rounded-full hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors ml-2"
                                        title="Déconnexion"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleLogin}
                                        className="flex items-center gap-2 px-4 py-2 ml-2 rounded-full bg-[#6B8E4E] hover:bg-[#5a7a40] text-white transition-colors text-sm font-bold shadow-md border border-[#3d2b1f]"
                                        title="Connexion"
                                    >
                                        <LogIn className="w-4 h-4" />
                                        <span className="hidden lg:inline">{t('nav.login') || 'Connexion'}</span>
                                    </button>
                                )}
                                </div>

                        {/* Mobile/Global Actions (Notifications, Settings, Menu) */}
                        <div className="flex items-center gap-1 pl-2">
                            <UsernameSetupDialog user={user} onUpdate={() => window.location.reload()} />
                            {user && <Notifications />}
                            {user && <div className="hidden md:flex items-center text-sm font-bold text-[#4a3728] dark:text-[#e8dcc5] mr-2">
                                {user.username || `Joueur ${user.id.substring(0,4)}`}
                            </div>}
                            <SettingsMenu user={user} currentTheme={appTheme} onThemeChange={handleThemeChange} />
                            
                            <button
                                onClick={toggleMenu}
                                className="inline-flex items-center justify-center p-2 rounded-md text-[#d4c5b0] hover:bg-white/10 focus:outline-none ml-1"
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
                            <div className="grid grid-cols-2 gap-2 p-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => setIsMenuOpen(false)}
                                            className="px-3 py-2 rounded-md text-sm font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2 overflow-hidden"
                                        >
                                            <Icon className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    );
                                })}
                                <button
                                    onClick={() => {
                                        toggleGameMode();
                                        setIsMenuOpen(false);
                                    }}
                                    className="text-left px-3 py-2 rounded-md text-sm font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2 overflow-hidden"
                                >
                                    <span className="flex-shrink-0">{gameMode === 'chess' ? '♟️' : '⚪'}</span>
                                    <span className="truncate">{gameMode === 'chess' ? t('nav.mode.chess') : t('nav.mode.checkers')}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        toggleSound();
                                        setIsMenuOpen(false);
                                    }}
                                    className="text-left px-3 py-2 rounded-md text-sm font-medium text-[#d4c5b0] hover:bg-[#5c4430] hover:text-white flex items-center gap-2 overflow-hidden"
                                >
                                    {soundEnabled ? <Volume2 className="w-4 h-4 flex-shrink-0" /> : <VolumeX className="w-4 h-4 flex-shrink-0" />}
                                    <span className="truncate">{soundEnabled ? t('nav.sound.on') : t('nav.sound.off')}</span>
                                </button>
                                <div className="px-3 py-2 col-span-2 flex justify-center bg-[#5c4430]/30 rounded-md">
                                    <LanguageSwitcher variant="minimal" />
                                </div>

                                {user ? (
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setIsMenuOpen(false);
                                        }}
                                        className="text-left px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-[#5c4430] hover:text-red-300 flex items-center gap-2 overflow-hidden col-span-2"
                                    >
                                        <LogOut className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">{t('nav.logout')}</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            handleLogin();
                                            setIsMenuOpen(false);
                                        }}
                                        className="text-left px-3 py-2 rounded-md text-sm font-medium text-[#6B8E4E] hover:bg-[#5c4430] hover:text-green-400 flex items-center gap-2 overflow-hidden col-span-2"
                                    >
                                        <LogIn className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">{t('nav.login') || 'Connexion'}</span>
                                    </button>
                                )}
                                </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {isFramed && !isAuthed && (
                <div className="relative z-[90] bg-yellow-50 border-b border-yellow-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col md:flex-row items-center justify-between gap-2 text-[#6b5138]">
                        <div className="text-sm font-medium">
                            Vous êtes dans une fenêtre intégrée. Pour vous connecter et rejoindre la partie, ouvrez l’app en plein écran.
                        </div>
                        <div className="flex gap-2">
                            <a
                                href={typeof window !== 'undefined' ? window.location.href : '/Home'}
                                target="_top"
                                className="px-3 py-1.5 rounded-md bg-[#6B8E4E] text-white text-sm font-bold border border-[#3d2b1f] hover:bg-[#5a7a40]"
                            >
                                Ouvrir en plein écran
                            </a>
                            <button
                                onClick={() => base44.auth.redirectToLogin(typeof window !== 'undefined' ? window.location.href : '/Home')}
                                className="px-3 py-1.5 rounded-md border text-sm font-bold bg-white hover:bg-[#f5f0e6]"
                            >
                                Se connecter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className={`relative z-10 max-w-7xl mx-auto sm:px-6 lg:px-8 py-8 pb-40 ${location.pathname.toLowerCase().startsWith('/game') ? 'px-0' : 'px-4'}`}>
                {children}
            </main>
        </div>
    );
}