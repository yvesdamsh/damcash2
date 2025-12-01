import React from 'react';
import { motion } from 'framer-motion';

export default function CheckerPiece({ type, isSelected, animateFrom, design = 'standard', onDragStart, canDrag }) {
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

    const handleDragStart = (e) => {
        if (!canDrag) {
            e.preventDefault();
            return;
        }
        
        // IMPORTANT : On définit le mode de transfert
        e.dataTransfer.effectAllowed = 'move';
        
        // On s'assure que l'image fantôme est bien capturée AVANT de changer l'opacité
        // setTimeout déplace l'action à la fin de la stack d'exécution
        setTimeout(() => {
            if(e.target) e.target.style.opacity = '0.4'; 
        }, 0);

        if (onDragStart) onDragStart(e);
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
    };

    return (
        /* CORRECTION : On utilise une div standard pour le Drag.
           On retire 'motion' du wrapper draggable pour éviter les conflits d'événements.
        */
        <div
            draggable={canDrag}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`
                relative w-[85%] h-[85%] m-auto rounded-full z-10 
                ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
            `}
            // On s'assure que le drag n'interfère pas avec le layout flex parent
            style={{ touchAction: 'none' }} 
        >
            {/* L'animation est gérée ici, à l'intérieur, purement visuelle */}
            <motion.div 
                initial={initial}
                animate={animate}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
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
            </motion.div>
        </div>
    );
}