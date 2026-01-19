import { motion } from 'framer-motion';

export default function PromotionDialog({ turn, onSelect }) {
    const pieces = ['q', 'r', 'b', 'n'];
    
    return (
        <motion.div 
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
           className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
            <motion.div 
               initial={{ scale: 0.8, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="bg-white/95 p-6 rounded-2xl shadow-2xl border-2 border-[#4a3728] flex flex-col items-center"
            >
                <h3 className="text-xl font-bold text-[#4a3728] mb-4 uppercase tracking-widest">Promotion</h3>
                <div className="flex gap-4">
                    {pieces.map(p => (
                        <div 
                            key={p} 
                            onClick={() => onSelect(p)}
                            className="w-20 h-20 p-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-yellow-100 hover:to-yellow-200 cursor-pointer border-2 border-transparent hover:border-yellow-400 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-full h-full transform group-hover:scale-110 transition-transform">
                               <img 
                                   src={`https://upload.wikimedia.org/wikipedia/commons/${
                                       turn === 'white' 
                                       ? (p==='q'?'1/15/Chess_qlt45.svg':p==='r'?'7/72/Chess_rlt45.svg':p==='b'?'b/b1/Chess_blt45.svg':'7/70/Chess_nlt45.svg')
                                       : (p==='q'?'4/47/Chess_qdt45.svg':p==='r'?'f/ff/Chess_rdt45.svg':p==='b'?'9/98/Chess_bdt45.svg':'e/ef/Chess_ndt45.svg')
                                   }`}
                                   alt={p}
                                   className="w-full h-full"
                               />
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}