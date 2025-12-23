import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { soundManager } from '@/components/SoundManager';

export default function IntroAnimation() {
    useEffect(() => {
        // Respect user preference and browser autoplay policies
        if (typeof window !== 'undefined') {
            const enabled = localStorage.getItem('soundEnabled') !== 'false';
            const hasUserGesture = sessionStorage.getItem('audio_unlocked') === 'true';
            if (enabled) {
                const tryPlay = () => {
                    try {
                        if (sessionStorage.getItem('start_sound_played') === 'true') return;
                        soundManager.play('start');
                        sessionStorage.setItem('start_sound_played', 'true');
                    } catch (_) {}
                };
                // Only attempt immediate play if we already have a gesture
                if (hasUserGesture) tryPlay();
                const unlock = () => {
                    sessionStorage.setItem('audio_unlocked', 'true');
                    tryPlay();
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('touchstart', unlock);
                    window.removeEventListener('click', unlock);
                };
                window.addEventListener('pointerdown', unlock, { once: true });
                window.addEventListener('keydown', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
                window.addEventListener('click', unlock, { once: true });
                return () => {
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('touchstart', unlock);
                    window.removeEventListener('click', unlock);
                };
            }
        }
    }, []);

    return (
        <div className="fixed inset-0 z-[200] bg-[#4a3728] flex flex-col items-center justify-center overflow-hidden">
            {/* Animated Background Texture */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                transition={{ duration: 1 }}
                className="absolute inset-0 z-0"
                style={{ 
                    backgroundImage: `url('https://www.transparenttextures.com/patterns/wood-pattern.png')`,
                    backgroundSize: 'auto'
                }} 
            />

            {/* Ambient Glow */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1] 
                }}
                transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    ease: "easeInOut" 
                }}
                className="absolute w-[500px] h-[500px] bg-yellow-600 rounded-full blur-[100px] opacity-20"
            />

            <div className="relative z-10 flex flex-col items-center">
                {/* Logo Animation */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="mb-8"
                >
                    <div className="relative w-56 h-56 md:w-64 md:h-64 rounded-2xl shadow-2xl overflow-hidden border-4 border-[#e8dcc5]" style={{ perspective: '1000px' }}>
                        <img
                          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/b31958665_Screenshot2025-12-21at121530AM.png"
                          alt="DamCash Logo"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Door halves opening */}
                        <motion.div
                          initial={{ rotateY: 0 }}
                          animate={{ rotateY: 90 }}
                          transition={{ delay: 0.6, duration: 1.8, ease: 'easeInOut' }}
                          style={{ transformOrigin: 'left center' }}
                          className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-br from-[#6b5138] to-[#b8860b]"
                        />
                        <motion.div
                          initial={{ rotateY: 0 }}
                          animate={{ rotateY: -90 }}
                          transition={{ delay: 0.6, duration: 1.8, ease: 'easeInOut' }}
                          style={{ transformOrigin: 'right center' }}
                          className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-tl from-[#6b5138] to-[#b8860b]"
                        />
                        {/* Glow after opening */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.25, 0.15] }}
                          transition={{ delay: 2.6, duration: 2.4, repeat: Infinity }}
                          className="absolute -inset-12 bg-[radial-gradient(circle_at_center,rgba(255,215,130,0.35),transparent_60%)] pointer-events-none"
                        />
                    </div>
                </motion.div>

                {/* Text Animation */}
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                    className="text-center"
                >
                    <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#e8dcc5] via-yellow-500 to-[#e8dcc5] drop-shadow-sm mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                        DAMCASH
                    </h1>
                    
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ delay: 1, duration: 0.8 }}
                        className="h-1 bg-gradient-to-r from-transparent via-yellow-600 to-transparent mx-auto mb-4"
                    />

                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5, duration: 0.8 }}
                        className="text-[#e8dcc5] text-lg md:text-xl font-medium tracking-[0.3em] uppercase"
                    >
                        Le Jeu des Rois & des Dames
                    </motion.p>
                </motion.div>
            </div>
        </div>
    );
}