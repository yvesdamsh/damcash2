import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LogIn, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { soundManager } from '@/components/SoundManager';

export default function SplashScreen({ onPlayAsGuest }) {
    const [mobileSafe, setMobileSafe] = React.useState(false);
    React.useEffect(() => {
        try {
            const small = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
            const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            setMobileSafe(!!(small || reduced));
        } catch (_) {}
    }, []);
    const playOnce = () => {
        try {
            if (sessionStorage.getItem('splash_sound_played') === 'true') return;
            const unlocked = sessionStorage.getItem('audio_unlocked') === 'true';
            soundManager.play('splash');
            if (unlocked) sessionStorage.setItem('splash_sound_played', 'true');
        } catch (_) {}
    };
    const handleLogin = () => {
        playOnce();
        setTimeout(() => {
            base44.auth.redirectToLogin(window.location.origin + '/Home');
        }, 80);
    };

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const enabled = localStorage.getItem('soundEnabled') !== 'false';
        if (!enabled) return;

        let t1, t2;
        const play = () => { t1 = setTimeout(() => playOnce(), 200); };
        const cleanup = () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('click', unlock);
        };
        const unlock = () => {
            try { sessionStorage.setItem('audio_unlocked', 'true'); } catch(_) {}
            play();
            cleanup();
        };

        const hasGesture = sessionStorage.getItem('audio_unlocked') === 'true';
        if (hasGesture) play();

        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
        window.addEventListener('click', unlock, { once: true });
        // Try to play once immediately; if blocked, unlock will replay
        t2 = setTimeout(() => playOnce(), 250);
        return () => { cleanup(); if (t1) clearTimeout(t1); if (t2) clearTimeout(t2); };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-[#fdfbf7] flex flex-col items-center justify-center overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 z-0 opacity-10" 
                style={{ 
                    backgroundImage: `url('https://www.transparenttextures.com/patterns/wood-pattern.png')`,
                    backgroundSize: 'auto'
                }} 
            />
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                {mobileSafe ? (
                  <>
                    <div className="absolute -top-[30%] -left-[30%] w-[80%] h-[80%] bg-gradient-to-br from-[#4a3728]/60 to-transparent rounded-full blur-xl" />
                    <div className="absolute -bottom-[30%] -right-[30%] w-[80%] h-[80%] bg-gradient-to-tl from-[#b8860b]/50 to-transparent rounded-full blur-xl" />
                  </>
                ) : (
                  <>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 0.12, scale: 1.1 }}
                        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
                        className="absolute -top-[20%] -left-[20%] w-[70%] h-[70%] bg-gradient-to-br from-[#4a3728] to-transparent rounded-full blur-3xl"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 0.12, scale: 1.1 }}
                        transition={{ duration: 15, repeat: Infinity, repeatType: "reverse", delay: 2 }}
                        className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-tl from-[#b8860b] to-transparent rounded-full blur-3xl"
                    />
                  </>
                )}
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center px-4 w-full max-w-md text-center">
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="mb-8"
                >
                    <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4a3728] to-[#b8860b] drop-shadow-2xl" style={{ fontFamily: 'Georgia, serif' }}>
                        DAMCASH
                    </h1>
                    <p className="text-[#6b5138] text-xl mt-2 font-medium tracking-widest uppercase">Le Jeu des Rois & des Dames</p>
                </motion.div>

                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                    className="space-y-4 w-full"
                >
                    <div className="p-6 bg-white/80 md:backdrop-blur-md border border-[#d4c5b0] rounded-2xl shadow-xl space-y-4">
                        <Button 
                            onClick={handleLogin}
                            className="w-full h-14 text-lg font-bold bg-[#4a3728] hover:bg-[#2c1e12] text-[#e8dcc5] shadow-lg transition-all transform hover:scale-[1.02]"
                        >
                            <LogIn className="w-5 h-5 mr-2" /> Se Connecter / S'inscrire
                        </Button>
                        
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-[#d4c5b0]"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Ou</span>
                            <div className="flex-grow border-t border-[#d4c5b0]"></div>
                        </div>

                        <Button 
                            onClick={() => { playOnce(); onPlayAsGuest && onPlayAsGuest(); }}
                            variant="outline"
                            className="w-full h-12 border-2 border-[#d4c5b0] text-[#6b5138] hover:bg-[#f5f0e6] hover:text-[#4a3728] font-bold"
                        >
                            <User className="w-5 h-5 mr-2" /> Jouer en tant qu'invité
                        </Button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-6 max-w-xs mx-auto">
                        En jouant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}