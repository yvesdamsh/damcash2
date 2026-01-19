import { memo } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

const CheckerPiece = memo(({ type, isSelected, animateFrom, design = 'standard', onDragStart, canDrag, onPieceClick, onDragEnd }) => {
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

    // Animation settings - reduced spring effect to prevent yoyo bounce
    const initial = animateFrom ? { x: animateFrom.x, y: animateFrom.y, scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 };
    const animate = { x: 0, y: 0, scale: 1, opacity: 1 };

    return (
        <motion.div
            layout="position"
            drag={canDrag}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onTap={onPieceClick}
            whileDrag={{ scale: 1.15, zIndex: 100, cursor: 'grabbing' }}
            dragSnapToOrigin
            initial={initial}
            animate={animate}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
            transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
            className={`checker-piece relative w-[85%] h-[85%] m-auto rounded-full z-10 ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ 
                touchAction: 'none', 
                userSelect: 'none', 
                WebkitUserSelect: 'none', 
                WebkitTouchCallout: 'none' 
            }}
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
                    <div className="absolute flex items-center justify-center drop-shadow-md">
                        <Crown 
                            className={`w-3/5 h-3/5 ${isWhite ? 'text-yellow-600 stroke-black' : 'text-yellow-400 stroke-white'} stroke-2`} 
                            fill="currentColor"
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
});

export default CheckerPiece;