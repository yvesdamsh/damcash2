import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import CheckerBoard from '@/components/CheckerBoard';
import ChessBoard from '@/components/ChessBoard';

export default function Lesson() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [lesson, setLesson] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [boardState, setBoardState] = useState(null);

    useEffect(() => {
        if (!id) return;
        base44.entities.Lesson.get(id).then(l => {
            setLesson(l);
            // Parse steps if string
            if (typeof l.steps === 'string') {
                try { l.steps = JSON.parse(l.steps); } catch(e) {}
            }
            if (l.steps && l.steps.length > 0) {
                setBoardState(l.steps[0].fen);
            }
        });
    }, [id]);

    const handleStepChange = (delta) => {
        const newStep = currentStep + delta;
        if (newStep >= 0 && newStep < (lesson?.steps?.length || 0)) {
            setCurrentStep(newStep);
            setBoardState(lesson.steps[newStep].fen);
        }
    };

    if (!lesson) return <div className="p-10 text-center">{t('common.loading')}</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 h-[calc(100vh-100px)] flex flex-col">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" onClick={() => navigate('/Academy')}>
                    <ArrowLeft className="w-5 h-5 mr-2" /> {t('common.back')}
                </Button>
                <h1 className="text-2xl font-bold text-[#4a3728]">{lesson.title}</h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
                {/* Board Area */}
                <div className="flex-1 flex items-center justify-center bg-[#f0e6d2] rounded-xl p-4 shadow-inner">
                    <div className="w-full max-w-[500px] aspect-square">
                        {lesson.game_type === 'chess' ? (
                            <ChessBoard 
                                fen={boardState} 
                                interactable={false} 
                                orientation="white" 
                            />
                        ) : (
                            <CheckerBoard 
                                boardState={boardState} // Assuming CheckerBoard takes FEN/JSON string or object
                                interactable={false}
                            />
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="w-full md:w-1/3 flex flex-col gap-4 bg-white rounded-xl p-6 shadow-lg border border-[#d4c5b0] overflow-y-auto">
                    <div className="prose prose-amber prose-sm max-w-none flex-1">
                        <ReactMarkdown>{lesson.content_markdown}</ReactMarkdown>
                    </div>

                    {lesson.steps && lesson.steps.length > 0 && (
                        <div className="mt-4 p-4 bg-[#fdfbf7] rounded-lg border border-[#e8dcc5]">
                            <h3 className="font-bold text-[#4a3728] mb-2">Étape {currentStep + 1} / {lesson.steps.length}</h3>
                            <p className="text-sm text-[#6b5138] mb-4">{lesson.steps[currentStep].instruction}</p>
                            <div className="flex justify-between">
                                <Button 
                                    variant="outline" 
                                    onClick={() => handleStepChange(-1)} 
                                    disabled={currentStep === 0}
                                >
                                    <ChevronLeft className="w-4 h-4" /> Précédent
                                </Button>
                                <Button 
                                    className="bg-[#4a3728]"
                                    onClick={() => handleStepChange(1)}
                                    disabled={currentStep === lesson.steps.length - 1}
                                >
                                    Suivant <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}