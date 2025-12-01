import React from 'react';
import { motion } from 'framer-motion';

export default function CheckerPiece({ type, isSelected }) {
    // type: 1 = white man, 2 = black man, 3 = white king, 4 = black king
    
    if (type === 0) return null;

    const isWhite = type === 1 || type === 3;
    const isKing = type === 3 || type === 4;

    const baseColor = isWhite ? 'bg-[#f0e6d2]' : 'bg-[#2c2c2c]';
    const borderColor = isWhite ? 'border-[#d4c5b0]' : 'border-[#1a1a1a]';
    const innerRing = isWhite ? 'border-[#e8dcc5]' : 'border-[#404040]';
    
    // Realistic shadow for 3D effect
    const shadowStyle = {
        boxShadow: isSelected 
            ? '0 10px 20px rgba(0,0,0,0.4), 0 6px 6px rgba(0,0,0,0.3)' 
            : '0 4px 0 ' + (isWhite ? '#cbbba4' : '#111') + ', 0 5px 5px rgba(0,0,0,0.3)'
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-[80%] h-[80%] m-auto rounded-full"
        >
            <div 
                className={`
                    w-full h-full rounded-full 
                    ${baseColor} 
                    border-2 ${borderColor}
                    flex items-center justify-center
                    transition-transform duration-200
                    ${isSelected ? '-translate-y-1' : ''}
                `}
                style={shadowStyle}
            >
                {/* Inner grooves for realism */}
                <div className={`w-[70%] h-[70%] rounded-full border-4 ${innerRing} opacity-50`} />
                <div className={`absolute w-[40%] h-[40%] rounded-full border-2 ${innerRing} opacity-50`} />
                
                {/* King Crown Icon */}
                {isKing && (
                    <div className="absolute text-2xl select-none">
                        👑
                    </div>
                )}
            </div>
        </motion.div>
    );
}