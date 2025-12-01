import React from 'react';
import { motion } from 'framer-motion';

const PIECE_IMAGES = {
    'P': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    'R': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'N': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'B': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'Q': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'K': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    'p': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'r': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'k': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
};

export default function ChessPiece({ type, isSelected, animateFrom, set = 'standard' }) {
    if (!type) return null;

    // Map for unicode pieces
    const UNICODE_PIECES = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    const initial = animateFrom ? { x: animateFrom.x, y: animateFrom.y, scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 };
    const animate = { x: 0, y: 0, scale: 1, opacity: 1 };

    if (set === 'unicode') {
        const isWhite = type === type.toUpperCase();
        return (
            <motion.div
                initial={initial}
                animate={animate}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`w-full h-full flex items-center justify-center ${isSelected ? 'drop-shadow-xl scale-110' : ''}`}
            >
                <span className={`text-4xl md:text-6xl select-none ${isWhite ? 'text-white drop-shadow-md stroke-black' : 'text-black drop-shadow-md'}`} style={{ textShadow: isWhite ? '0 0 2px black' : '0 0 1px white' }}>
                    {UNICODE_PIECES[type]}
                </span>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={initial}
            animate={animate}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`w-full h-full flex items-center justify-center ${isSelected ? 'drop-shadow-xl' : ''}`}
        >
            <img 
                src={PIECE_IMAGES[type]} 
                alt={type} 
                className={`w-[90%] h-[90%] select-none transition-transform duration-200 ${isSelected ? '-translate-y-2 scale-110' : ''}`}
                draggable={false}
            />
        </motion.div>
    );
}