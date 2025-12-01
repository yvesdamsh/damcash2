import React from 'react';
import { motion } from 'framer-motion';

export default function CheckerPiece({ type, isSelected, animateFrom, design = 'standard', onDragStart, canDrag, onPieceClick, ...props }) {
    if (type === 0) return null;

    const isWhite = type === 1 || type === 3;
    const isKing = type === 3 || type === 4;

    const baseColor = isWhite ? 'bg-[#f9f9f9]' : 'bg-[#2c2c2c]';
    const borderColor = isWhite ? 'border-black' : 'border-[#d4c5b0]'; 
    const innerRing = isWhite ? 'border-gray-400' : 'border-[#505050]';
    
    const isFlat = design === 'flat';

    // Style de l'ombre
    const shadowStyle = isFlat ? {} : {
        boxShadow: isSelected 
            ? '0 8px 16px rgba(0,0,0,0.4), 0 4px 4px rgba(0,0,0,0.3)' 
            : '0 3px 0 ' + (isWhite ? '#555' : '#111') + ', 0 4px 4px rgba(0,0,0,0.3)'
    };

    // Animation settings
    const initial = animateFrom ? { x: animateFrom.x, y: animateFrom.y, scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 };
    const animate = { x: 0, y: 0, scale: 1, opacity: 1 };

    return (
        <motion.div
            drag={canDrag}
            drag={canDrag}
            dragMomentum={false}
            dragElastic={0.1}
            onDragStart={onDragStart}
            onDragEnd={props.onDragEnd}
            onTap={onPieceClick}
            whileDrag={{ scale: 1.2, zIndex: 100, cursor: 'grabbing' }}
            dragSnapToOrigin
            initial={initial}
            animate={animate}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`checker-piece relative w-[85%] h-[85%] m-auto rounded-full z-10 ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ touchAction: 'none' }}
        >
            <div 
                className={`
                    w-full h-full rounded-full 
                    ${baseColor} 
                    border-2 md:border-4 ${borderColor}
                    flex items-center justify-center
                    transition-transform duration-200
                    ${isSelected && !isFlat ? '-translate-y-1' : ''}
                `}
                style={shadowStyle}
            >
                {!isFlat && (
                    <>
                        <div className={`w-[70%] h-[70%] rounded-full border md:border-4 ${innerRing} opacity-50`} />
                        <div className={`absolute w-[40%] h-[40%] rounded-full border md:border-2 ${innerRing} opacity-50`} />
                    </>
                )}
                
                {isKing && (
                    <div className="absolute text-lg md:text-2xl select-none drop-shadow-md">
                        👑
                    </div>
                )}
            </div>
        </motion.div>
    );
}