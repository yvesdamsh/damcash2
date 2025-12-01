import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X, CheckCircle } from 'lucide-react';

const tutorialSteps = [
    {
        title: "Bienvenue sur Dames Master !",
        content: "Ce tutoriel rapide vous guidera à travers les règles du jeu de dames international (sur plateau 10x10) et l'interface.",
        position: "center"
    },
    {
        title: "Les Pions",
        content: "Les pions se déplacent d'une case en diagonale vers l'avant. Ils peuvent capturer les pièces adverses en sautant par-dessus, vers l'avant OU vers l'arrière.",
        position: "bottom"
    },
    {
        title: "Les Dames (Rois)",
        content: "Lorsqu'un pion atteint l'autre bout du plateau, il devient une Dame (couronnée). Les Dames sont 'volantes' : elles peuvent se déplacer et capturer à n'importe quelle distance en diagonale !",
        position: "center"
    },
    {
        title: "La Prise est Obligatoire",
        content: "Si vous pouvez capturer une pièce adverse, vous devez le faire ! Si plusieurs prises sont possibles, vous devez choisir l'une d'elles (de préférence celle qui capture le plus de pièces, mais ce n'est pas bloquant ici).",
        position: "bottom"
    },
    {
        title: "Prises Multiples",
        content: "Si après une prise, votre pièce peut en faire une autre, vous devez continuer à sauter (rafle). Le tour ne passe pas tant que la rafle n'est pas finie.",
        position: "center"
    },
    {
        title: "C'est parti !",
        content: "Vous êtes prêt à jouer. Bonne chance !",
        position: "center"
    }
];

export default function TutorialOverlay({ isOpen, onClose }) {
    const [currentStep, setCurrentStep] = useState(0);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const step = tutorialSteps[currentStep];

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
                <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-[#fff8f0] max-w-md w-full rounded-2xl shadow-2xl border-4 border-[#4a3728] overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-[#4a3728] p-4 flex justify-between items-center text-[#e8dcc5]">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <span className="bg-[#e8dcc5] text-[#4a3728] w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                                {currentStep + 1}
                            </span>
                            Tutoriel
                        </h3>
                        <button onClick={onClose} className="hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 min-h-[200px] flex flex-col justify-center">
                        <h2 className="text-2xl font-bold text-[#6b5138] mb-4 text-center">{step.title}</h2>
                        <p className="text-[#4a3728] text-center text-lg leading-relaxed">{step.content}</p>
                    </div>

                    {/* Footer / Navigation */}
                    <div className="p-4 bg-[#f0e6d2] border-t border-[#d4c5b0] flex justify-between items-center">
                        <Button 
                            variant="ghost" 
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className="text-[#6b5138]"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
                        </Button>

                        <div className="flex gap-1">
                            {tutorialSteps.map((_, i) => (
                                <div 
                                    key={i}
                                    className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-[#6b5138]' : 'bg-[#d4c5b0]'}`}
                                />
                            ))}
                        </div>

                        <Button 
                            onClick={handleNext}
                            className="bg-[#6b5138] hover:bg-[#5c4430] text-white"
                        >
                            {currentStep === tutorialSteps.length - 1 ? (
                                <span className="flex items-center">JOUER <CheckCircle className="w-4 h-4 ml-2" /></span>
                            ) : (
                                <span className="flex items-center">Suivant <ChevronRight className="w-4 h-4 ml-1" /></span>
                            )}
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}