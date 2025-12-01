import React from 'react';
import { motion } from 'framer-motion';

export default function CheckerPiece({ type, isSelected, animateFrom }) {
    // type: 1 = white man, 2 = black man, 3 = white king, 4 = black king
    
    if (type === 0) return null;

    const isWhite = type === 1 || type === 3;
    const isKing = type === 3 || type === 4;

    const baseColor = isWhite ? 'bg-[#ffffff]' : 'bg-[#2c2c2c]';
    const borderColor = isWhite ? 'border-[#e5e5e5]' : 'border-[#1a1a1a]';
    const innerRing = isWhite ? 'border-[#f5f5f5]' : 'border-[#404040]';
    
    // Realistic shadow for 3D effect
    const shadowStyle = {
        boxShadow: isSelected 
            ? '0 8px 16px rgba(0,0,0,0.4), 0 4px 4px rgba(0,0,0,0.3)' 
            : '0 3px 0 ' + (isWhite ? '#cccccc' : '#111') + ', 0 4px 4px rgba(0,0,0,0.3)'
    };

    // Animation logic
    const initial = animateFrom ? { x: animateFrom.x, y: animateFrom.y, scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 };
    const animate = { x: 0, y: 0, scale: 1, opacity: 1 };

    return (
        <motion.div
            initial={initial}
            animate={animate}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-[85%] h-[85%] m-auto rounded-full pointer-events-none z-10"
        >
            <div 
                className={`
                    w-full h-full rounded-full 
                    ${baseColor} 
                    border-2 md:border-4 ${borderColor}
                    flex items-center justify-center
                    transition-transform duration-200
                    ${isSelected ? '-translate-y-1' : ''}
                `}
                style={shadowStyle}
            >
                {/* Inner grooves for realism */}
                <div className={`w-[70%] h-[70%] rounded-full border md:border-4 ${innerRing} opacity-50`} />
                <div className={`absolute w-[40%] h-[40%] rounded-full border md:border-2 ${innerRing} opacity-50`} />
                
                {/* King Crown Icon */}
                {isKing && (
                    <div className="absolute text-lg md:text-2xl select-none drop-shadow-md">
                        👑
                    </div>
                )}
            </div>
        </motion.div>
    );
}