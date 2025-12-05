import React from 'react';
import { motion } from 'framer-motion';

export default function IntroAnimation() {
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
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ 
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        duration: 1.5 
                    }}
                    className="mb-8"
                >
                    <div className="w-32 h-32 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full shadow-2xl border-4 border-[#e8dcc5] flex items-center justify-center relative overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="absolute inset-0 bg-white/20"
                        />
                        <div className="flex items-center justify-center transform scale-125">
                            <span className="text-[#2c1e12] font-black text-6xl" style={{ fontFamily: 'Georgia, serif' }}>D</span>
                            <span className="text-[#e8dcc5] font-black text-6xl -ml-2" style={{ fontFamily: 'Georgia, serif' }}>$</span>
                        </div>
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