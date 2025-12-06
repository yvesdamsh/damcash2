import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameReactions({ reactions }) {
    return (
        <div className="fixed inset-0 pointer-events-none z-[130] overflow-hidden">
            <AnimatePresence>
                {reactions.map(r => (
                    <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 100, scale: 0.5 }}
                        animate={{ opacity: 1, y: -200, scale: 1.5 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="absolute left-1/2 bottom-1/4 flex flex-col items-center"
                        style={{ marginLeft: (Math.random() * 200 - 100) + 'px' }} // Random horizontal drift
                    >
                        <span className="text-6xl drop-shadow-lg">{r.emoji}</span>
                        <span className="text-sm font-bold text-white bg-black/50 px-2 rounded-full mt-1 whitespace-nowrap">{r.sender_name}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}