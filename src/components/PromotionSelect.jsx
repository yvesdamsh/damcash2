import React from 'react';
import { motion } from 'framer-motion';
import ChessPiece from './ChessPiece';

export default function PromotionSelect({ color, onSelect, theme }) {
    const pieces = ['q', 'r', 'n', 'b'];
    const isWhite = color === 'white';

    // Using the existing ChessPiece component for visual consistency
    // We map the lowercase type to the correct case for the Piece component
    
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-4 rounded-xl shadow-2xl border-4 border-[#4a3728] flex gap-4"
            >
                {pieces.map(p => (
                    <div 
                        key={p}
                        onClick={() => onSelect(p)}
                        className="w-16 h-16 rounded-lg hover:bg-gray-100 cursor-pointer border-2 border-transparent hover:border-[#4a3728] transition-all flex items-center justify-center"
                    >
                        <ChessPiece type={isWhite ? p.toUpperCase() : p} set={theme} />
                    </div>
                ))}
            </motion.div>
        </div>
    );
}