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
  ShoppingBag,
  History,
  LogIn,
  Settings
  } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import SettingsMenu from '@/components/SettingsMenu';
import FriendsManager from '@/components/FriendsManager';
import WalletBalance from '@/components/WalletBalance';
import { RealTimeProvider } from '@/components/RealTimeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import UsernameSetupDialog from '@/components/UsernameSetupDialog';
import { toast } from 'sonner';

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
    const [appTheme, setAppTheme] = React.useState(() => { try { return localStorage.getItem('appTheme') || 'light'; } catch (_) { return 'light'; } });
    const [gameMode, setGameMode] = React.useState(() => { try { return localStorage.getItem('gameMode') || 'checkers'; } catch (_) { return 'checkers'; } });
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [showIntro, setShowIntro] = React.useState(() => {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const safe = params.get('safe') === '1';
            const isAndroid = /android/i.test(navigator.userAgent || '');
            return !window.hasShownIntro && !safe && !isAndroid;
        } catch (_) {
            return !window.hasShownIntro;
        }
    });
    const [isFramed, setIsFramed] = React.useState(false);
    const [isAuthed, setIsAuthed] = React.useState(false);

    React.useEffect(() => {
        const hide = () => setShowIntro(false);
        window.addEventListener('intro:hide', hide);
        // Initial app load logic
        if (!window.hasShownIntro) {
            window.hasShownIntro = true;

            const path = location.pathname.toLowerCase();
            const search = location.search || '';
            // If landing on Profile initially, FORCE redirect to Home
            if (path.includes('profile')) {
                navigate('/Home', { replace: true });
            } else if (path.includes('game') && !search.includes('id=')) {
                navigate('/Home', { replace: true });
            } else if (path === '/' || path === '') {
                navigate('/Home', { replace: true });
            }

            const timeout = /android/i.test(navigator.userAgent || '') ? 1800 : 7000;
            const timer = setTimeout(() => setShowIntro(false), timeout);
            return () => { clearTimeout(timer); window.removeEventListener('intro:hide', hide); };
        } else {
             // Subsequent navigations
             const path = location.pathname.toLowerCase();
             return () => window.removeEventListener('intro:hide', hide);
        }
    }, []); // Run once on mount to handle initial load state correctly

    // Prevent login redirect loops: if from_url contains '/login', go Home
    React.useEffect(() => {
                  try {
                      const params = new URLSearchParams(location.search || '');
                      const from = (params.get('from_url') || params.get('from') || '').toLowerCase();
                      if (from.includes('/login')) {
                          navigate('/Home', { replace: true });
                          return;
                      }
                      const path = (location.pathname || '').toLowerCase();
                      if (path.includes('/login')) {
                          navigate('/Home', { replace: true });
                      }
                  } catch (_) {}
              }, [location.search, location.pathname]);

    // Sound is handled inside IntroAnimation with strict single-play guard
    React.useEffect(() => {}, [showIntro]);

    // Save last location for persistent navigation (excluding Profile)
    React.useEffect(() => {
        const path = location.pathname.toLowerCase();
        // If we are on Profile, DO NOT save it.
        // If we are on Home, Lobby, etc., save it.
        if (location.pathname !== '/' && !path.includes('login') && !path.includes('profile') && !path.includes('game')) {
             try { localStorage.setItem('damcash_last_path', location.pathname); } catch (_) {}
        } else if (path.includes('profile') || path.includes('game')) {
             // If user navigates to profile, do not update the last path (keep the previous one, e.g. Home)
             // Or forcingly set it to Home to be safe?
             // Let's leave it as is (keeping previous safe path), or if null, set Home.
             try {
                 if (!localStorage.getItem('damcash_last_path')) {
                     localStorage.setItem('damcash_last_path', '/Home');
                 }
             } catch (_) {}
        }
    }, [location]);

    // Sync Game Mode
    const toggleGameMode = () => {
        const newMode = gameMode === 'checkers' ? 'chess' : 'checkers';
        setGameMode(newMode);
        try { localStorage.setItem('gameMode', newMode); } catch (_) {}
        window.dispatchEvent(new Event('gameModeChanged'));
    };

    // Listen for external changes to game mode
    React.useEffect(() => {
        const handleStorageChange = () => {
            let mode = null; try { mode = localStorage.getItem('gameMode'); } catch (_) {}
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
            } catch (e) {
                console.error('Heartbeat update failed', e);
            }
        };

        heartbeat();
        const interval = setInterval(heartbeat, 60000); 
        return () => clearInterval(interval);
    }, [user]);

    // Sync with SoundManager on mount
    React.useEffect(() => {
        // Import dynamically or assume global if we could, but better to use the file logic
        // For now we just init state from localStorage logic which SoundManager uses
        let saved = null; try { saved = localStorage.getItem('soundEnabled'); } catch (_) {}
        setSoundEnabled(saved !== 'false');
    }, []);

    // Theme Management
    const handleThemeChange = (newTheme) => {
        setAppTheme(newTheme);
        try { localStorage.setItem('appTheme', newTheme); } catch (_) {}
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
                // Notify friends on first login in this session
                try {
                  if (currentUser && !sessionStorage.getItem('online_notified_v1')) {
                    await base44.functions.invoke('notifyFriendsOnline', {});
                    sessionStorage.setItem('online_notified_v1', '1');
                  }
                  // Welcome message (first-time) for authenticated users
                  if (currentUser && !currentUser.welcome_sent_at) {
                    const title = t('welcome.title') || 'Welcome to Damcash!';
                    const body = t('welcome.registered') || 'Welcome! You can now play, join leagues, chat and more.';
                    await base44.entities.Notification.create({
                      recipient_id: currentUser.id,
                      type: 'message',
                      title,
                      message: body,
                      link: '/Home'
                    });
                    await base44.auth.updateMe({ welcome_sent_at: new Date().toISOString() });
                  }
                  // Guest welcome (only once per browser)
                  if (!currentUser) {
                    const authed = await base44.auth.isAuthenticated().catch(() => false);
                    if (!authed) {
                      try {
                        if (!localStorage.getItem('welcome_shown_v1')) {
                          const title = t('welcome.title') || 'Welcome to Damcash!';
                          const body = t('welcome.guest') || 'Create a free account to play and chat.';
                          try { toast.info(`${title}\n${body}`); } catch (_) {}
                          localStorage.setItem('welcome_shown_v1', '1');
                        }
                      } catch (_) {}
                    }
                  }
                } catch (_) {}
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
        const canNavigateTop = (() => {
            try { return window.top && window.top.location && window.top.location.origin === window.location.origin; } catch (_) { return false; }
        })();
        if (isFramed && !isAuthed && canNavigateTop) {
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

    // Open chat listener: when a message notification is clicked, open Messages with the target user
    React.useEffect(() => {
        const handler = (e) => {
            try {
                const id = e?.detail?.senderId;
                if (id) {
                    navigate(`/Messages?userId=${encodeURIComponent(id)}`);
                } else {
                    navigate('/Messages');
                }
            } catch (_) {}
        };
        window.addEventListener('open-chat', handler);
        return () => window.removeEventListener('open-chat', handler);
    }, [navigate]);

    // Mobile Viewport Optimization
    React.useEffect(() => {
        try {
            let meta = document.querySelector('meta[name="viewport"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = "viewport";
                document.head.appendChild(meta);
            }
            // Avoid zoom-locks that crash some older Android WebViews
            meta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
        } catch (_) {}
    }, []);

    // Elegant dark mode palette
    const isDark = appTheme === 'dark' || (appTheme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Theme classes and dynamic colors based on game mode
    const themeClass = gameMode === 'chess' ? 'theme-chess' : 'theme-checkers';
    const appBgClass = gameMode === 'chess'
        ? (isDark ? 'bg-[#0b2e16] text-[#e8f5e9]' : 'bg-[#eaf5ea] text-[#0b2e16]')
        : (isDark ? 'bg-[#0f0a06] text-[#e8dcc5]' : 'bg-[#e8dcc5] text-slate-900');
    const bgFilter = gameMode === 'chess'
        ? (isDark ? 'hue-rotate(80deg) saturate(1.2) contrast(1.1)' : 'hue-rotate(80deg) saturate(1.4) sepia(0.1) contrast(1.1)')
        : (isDark ? 'grayscale(0.5) contrast(1.2)' : 'sepia(0.3) contrast(1.1)');

    const activeNavTheme = gameMode === 'chess'
        ? (isDark 
            ? "bg-[#0f3d1a] text-[#e8f5e9] border-[#166534]" 
            : "bg-[#1f4d2e] text-[#e8f5e9] border-[#14532d]")
        : (isDark 
            ? "bg-[#1a120b] text-[#e8dcc5] border-[#3d2b1f]" 
            : "bg-[#4a3728] text-[#e8dcc5] border-[#2c1e12]");

    return (
        <div className={`min-h-screen font-sans relative transition-colors duration-300 ${appBgClass} ${themeClass}`}>
            <style>{`
.theme-chess {
  /* Green-dominant palette for chess */
  --background: 140 40% 94%;
  --foreground: 140 20% 12%;
  --primary: 140 38% 40%;
  --primary-foreground: 0 0% 100%;
  --secondary: 140 30% 20%;
  --secondary-foreground: 140 35% 92%;
  --muted: 140 30% 90%;
  --muted-foreground: 140 18% 30%;
  --accent: 140 45% 45%;
  --border: 140 25% 28%;
  --input: 140 25% 28%;
  --ring: var(--primary);
}
`}</style>
            <style>{`
:root {
  /* Spacing (8px scale) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* Radius */
  --radius: 10px;

  /* Animation durations */
  --anim-fast: 150ms;
  --anim-normal: 200ms;
  --anim-slow: 250ms;

  /* Accessible palette (light) */
  --background: 39 43% 85%; /* #e8dcc5 */
  --foreground: 220 13% 15%; /* slate-900 */

  --primary: 93 29% 43%; /* #6B8E4E */
  --primary-foreground: 0 0% 100%;

  --secondary: 24 28% 23%; /* #4a3728 */
  --secondary-foreground: 39 43% 85%;

  --muted: 32 36% 85%;
  --muted-foreground: 24 15% 35%;

  --accent: 48 96% 53%; /* warm gold */
  --destructive: 0 72% 50%;

  --border: 24 28% 23%;
  --input: 24 28% 23%;
  --ring: var(--primary);

  /* Design tokens (light) */
  --nav-bg: #4a3728;
  --nav-fg: #e8dcc5;
  --nav-border: #2c1e12;
  --gold-accent: #b8860b;
}

.dark {
  /* Accessible palette (dark) */
  --background: 22 39% 5%; /* #0f0a06 */
  --foreground: 39 39% 90%; /* #e8dcc5 */

  --primary: 93 29% 43%;
  --primary-foreground: 0 0% 100%;

  --secondary: 24 28% 23%;
  --secondary-foreground: 39 39% 90%;

  --muted: 24 18% 20%;
  --muted-foreground: 39 30% 80%;

  --accent: 48 96% 53%;
  --destructive: 0 72% 50%;

  --border: 24 18% 20%;
  --input: 24 18% 20%;
  --ring: var(--primary);

  /* Design tokens (dark) */
  --nav-bg: #1a120b;
  --nav-fg: #e8dcc5;
  --nav-border: #3d2b1f;
  --gold-accent: #b8860b;
}

/* Typography scale */
:root h1 { font-size: clamp(28px, 4vw, 36px); line-height: 1.2; letter-spacing: -0.01em; }
:root h2 { font-size: clamp(22px, 3vw, 28px); line-height: 1.25; }
:root h3 { font-size: clamp(18px, 2.5vw, 22px); line-height: 1.3; }
:root p, :root li, :root label, :root input, :root button { line-height: 1.5; }

/* Micro-animations baseline */
:root button, :root a, :root .card, :root .badge, :root .chip {
  transition-duration: var(--anim-normal);
}
`}</style>
            <style>{`
/* Micro-interactions and accessibility */
@keyframes capture {
0% { transform: scale(1); opacity: 1; }
50% { transform: scale(1.3); opacity: 0.5; }
100% { transform: scale(0); opacity: 0; }
}
@keyframes victory {
0% { transform: scale(0); }
50% { transform: scale(1.1); }
100% { transform: scale(1); }
}
@keyframes slideIn {
from { transform: translateX(100%); opacity: 0; }
to { transform: translateX(0); opacity: 1; }
}

.animate-capture { animation: capture 250ms ease forwards; }
.animate-victory { animation: victory 400ms ease-out both; }
.animate-slide-in { animation: slideIn 300ms ease both; }

button, a, [role="button"] { min-height: 44px; min-width: 44px; }
*:focus-visible { outline: 3px solid #b8860b; outline-offset: 2px; }
.text-on-dark { color: #e8dcc5; }
.text-on-light { color: #4a3728; }
            `}</style>
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
                    filter: bgFilter
                }}
            />

            {/* Navbar */}
            <nav className={`relative z-[100] shadow-lg border-b-4 transition-colors duration-300 ${activeNavTheme}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/Home" className="flex-shrink-0 flex items-center gap-2 group">
                                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full shadow-lg border-2 border-[var(--nav-fg)] overflow-hidden transform group-hover:scale-110 transition-transform">
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
                                    className="p-2 rounded-full hover:bg-white/10 text-[var(--nav-fg)] transition-colors"
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
                                        className="flex items-center gap-2 px-4 py-2 ml-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 transition-colors text-sm font-bold shadow-md border border-[var(--border)]"
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
                            {user && <NotificationCenter />}
                            {user && <div className="hidden md:flex items-center text-sm font-bold text-[#4a3728] dark:text-[#e8dcc5] mr-2">
                                {user.username || `Joueur ${user.id.substring(0,4)}`}
                            </div>}
                            <SettingsMenu user={user} currentTheme={appTheme} onThemeChange={handleThemeChange} />
                            
                            <button
                                onClick={toggleMenu}
                                className="inline-flex items-center justify-center p-2 rounded-md text-[var(--nav-fg)] hover:bg-white/10 focus:outline-none ml-1"
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
                                            className="px-3 py-2 rounded-md text-sm font-medium text-[var(--nav-fg)] hover:bg-white/10 hover:text-white flex items-center gap-2 overflow-hidden"
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
                                onClick={() => {
                                    const href = typeof window !== 'undefined' ? window.location.href : '/Home';
                                    const isLogin = typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('login');
                                    const nextUrl = (isLogin || href.toLowerCase().includes('/login')) ? (window.location.origin + '/Home') : href;
                                    base44.auth.redirectToLogin(nextUrl);
                                  }}
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