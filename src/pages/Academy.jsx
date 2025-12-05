import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, ChevronRight, GraduationCap, Sword, LayoutGrid, Trophy, RotateCcw } from 'lucide-react';
import CheckerBoard from '@/components/CheckerBoard';
import { executeMove, getValidMoves } from '@/components/checkersLogic';

const createBoardFromSetup = (setup) => {
    const board = Array(10).fill(null).map(() => Array(10).fill(0));
    if (!setup) return board;

    Object.entries(setup).forEach(([square, type]) => {
        const n = parseInt(square);
        const row = Math.floor((n - 1) / 5);
        const colIndex = (n - 1) % 5;
        const col = row % 2 === 0 ? (colIndex * 2 + 1) : (colIndex * 2);
        if (row >= 0 && row < 10 && col >= 0 && col < 10) {
            board[row][col] = type;
        }
    });
    return board;
};

const AcademyDiagram = ({ setup, turn = 'white', caption }) => {
    const [board, setBoard] = useState(createBoardFromSetup(setup));
    const [currentTurn, setCurrentTurn] = useState(turn);

    useEffect(() => {
        setBoard(createBoardFromSetup(setup));
        setCurrentTurn(turn);
    }, [setup, turn]);

    const handlePieceDrop = (fromR, fromC, toR, toC) => {
        const validMoves = getValidMoves(board, currentTurn);
        const move = validMoves.find(m => 
            m.from.r === fromR && m.from.c === fromC && 
            m.to.r === toR && m.to.c === toC
        );

        if (move) {
            const { newBoard } = executeMove(board, [fromR, fromC], [toR, toC], move.captured);
            setBoard(newBoard);
            setCurrentTurn(currentTurn === 'white' ? 'black' : 'white');
        }
    };

    const reset = () => {
        setBoard(createBoardFromSetup(setup));
        setCurrentTurn(turn);
    };

    return (
        <div className="my-8 flex flex-col items-center bg-[#f8f5f0] p-4 rounded-xl border border-[#d4c5b0] shadow-sm">
            <div className="w-full max-w-[400px] flex justify-between items-center mb-3 px-1">
                <div className="flex items-center gap-2 text-sm font-bold text-[#4a3728]">
                    <div className={`w-4 h-4 rounded-full border shadow-sm ${currentTurn === 'white' ? 'bg-white border-gray-300' : 'bg-[#2c2c2c] border-black'}`} />
                    <span>Trait aux {currentTurn === 'white' ? 'Blancs' : 'Noirs'}</span>
                </div>
                <button
                    onClick={reset}
                    className="flex items-center gap-1.5 text-xs font-bold bg-white border border-[#d4c5b0] text-[#6b5138] px-3 py-1.5 rounded-full hover:bg-[#f5f0e6] transition-all shadow-sm"
                >
                    <RotateCcw className="w-3 h-3" /> Réinitialiser
                </button>
            </div>

            <div className="w-full max-w-[400px] aspect-square relative shadow-xl rounded-lg overflow-hidden border-4 border-[#4a3728]">
                <CheckerBoard 
                    board={board} 
                    currentTurn={currentTurn}
                    playerColor={currentTurn}
                    validMoves={getValidMoves(board, currentTurn)}
                    onSquareClick={() => {}} 
                    onPieceDrop={handlePieceDrop}
                    isSoloMode={true}
                />
            </div>
            
            {caption && (
                <div className="mt-4 w-full max-w-[400px] bg-yellow-50 border-l-4 border-yellow-500 p-3 text-sm text-[#4a3728] italic rounded-r">
                    {caption}
                </div>
            )}
        </div>
    );
};

const fiches = [
    {
        id: 1,
        title: "Le Damier",
        icon: LayoutGrid,
        content: [
            { subtitle: "Structure", text: "Damier de 100 cases (10 × 10). Cases sombres numérotées de 1 à 50. On joue uniquement sur les cases foncées." },
            { subtitle: "Orientation", text: "Les blancs commencent. Les numéros croissent de gauche à droite et du haut vers le bas." },
            { subtitle: "Cases spéciales", text: "Ligne des dames : Cases 1 à 5 pour les blancs (promotion). Cases 46 à 50 pour les noirs." },
            { subtitle: "Groupes", text: "4 groupes de 13 cases chacun. Les cases d'un même groupe sont atteignables par prise." }
        ]
    },
    {
        id: 2,
        title: "Position Initiale",
        icon: LayoutGrid,
        content: [
            { subtitle: "Départ normal", text: "Blancs : cases 31 à 50. Noirs : cases 1 à 30." },
            { subtitle: "Entraînement (10 pions)", text: "Noirs : 1 à 5. Blancs : 46 à 50. Permet des parties rapides pour apprendre les finales." },
            { subtitle: "Handicap", text: "On peut retirer 1 ou 2 pions pour équilibrer les niveaux." }
        ]
    },
    {
        id: 3,
        title: "La Marche",
        icon: ChevronRight,
        content: [
            { subtitle: "Déplacement", text: "Un pion avance en diagonale d'une seule case. Il ne recule pas (sauf prise)." },
            { subtitle: "Notation", text: "31-26. Les Blancs commencent toujours." },
            { subtitle: "Terminologie", text: "'Coup' peut désigner un mouvement simple, une combinaison ou un tour complet (blanc + noir)." }
        ]
    },
    {
        id: 4,
        title: "La Prise",
        icon: Sword,
        content: [
            { subtitle: "Obligation", text: "La prise est obligatoire." },
            { subtitle: "Mécanique", text: "Pion → Pion ennemi → Case vide." },
            { subtitle: "Direction (Frison)", text: "Diagonale, Verticale et Horizontale." },
            { subtitle: "Notation", text: "31x33." }
        ]
    },
    {
        id: 5,
        title: "Prise Multiple & Majoritaire",
        icon: Sword,
        content: [
            { subtitle: "Rafle", text: "Un pion continue à prendre tant qu'il peut. La rafle est obligatoire." },
            { subtitle: "Règle Majoritaire", text: "Le joueur DOIT prendre dans la variante où il capture le PLUS de pièces." },
            { subtitle: "Détail", text: "On ne retire les pions qu'à la fin. On peut repasser sur une case vide mais pas sur une pièce déjà prise." }
        ]
    },
    {
        id: 6,
        title: "La Dame",
        icon: GraduationCap,
        content: [
            { subtitle: "Promotion", text: "Ligne 1-5 (Blancs) ou 46-50 (Noirs)." },
            { subtitle: "Déplacement", text: "Diagonale, avant & arrière, toute distance." },
            { subtitle: "Prise", text: "Survole les cases libres. Priorité si égalité de nombre : La Dame DOIT prendre." },
            { subtitle: "Valeur", text: "3 Dames = 5,5 Pions (pour calcul majoritaire)." }
        ]
    },
    {
        id: 7,
        title: "Règle des 3 coups",
        icon: BookOpen,
        content: [
            { subtitle: "Dame Bloquée", text: "Max 3 coups sans prise d'affilée. Au 4ème, elle doit prendre ou un pion doit bouger." },
            { subtitle: "Libération", text: "Si elle capture, le compteur est remis à zéro." },
            { subtitle: "Exception", text: "Ne s'applique pas si le joueur a plusieurs dames et plus de pions." }
        ]
    },
    {
        id: 8,
        title: "Finale 2 Dames vs 1",
        icon: Sword,
        content: [
            { subtitle: "Règle des 7 coups", text: "Le joueur avec 2 dames a 7 coups pour gagner contre 1 dame seule. Sinon, c'est remise." }
        ]
    },
    {
        id: 9,
        title: "Les Remises",
        icon: LayoutGrid,
        content: [
            { subtitle: "Dame contre Dame", text: "Remise si aucune capture possible (sauf exceptions 5 vs 46)." },
            { subtitle: "Diagonale 46-5", text: "Si contrôlée par l'adversaire empêchant le passage : remise." },
            { subtitle: "Blocage Lignes", text: "Lignes 47-15 ou 4-36 bloquées : remise." }
        ]
    },
    {
        id: 10,
        title: "Gagner ou Perdre",
        icon: Trophy,
        content: [
            { subtitle: "Défaite", text: "Plus de pions OU plus de coups légaux (blocage)." },
            { subtitle: "Tactiques", text: "Enfermement, Opposition, Encerclement." }
        ]
    },
    {
        id: 11,
        title: "Notation",
        icon: BookOpen,
        content: [
            { subtitle: "Complète", text: "31-26 (Marche), 31x33 (Prise)." },
            { subtitle: "Position", text: "Pions : N°, Dames : 'D' + N°." },
            { subtitle: "Courte", text: "Arrivée seulement. Ex: '27 2' pour une séquence." }
        ]
    },
    {
        id: 12,
        title: "Stratégie",
        icon: GraduationCap,
        content: [
            { subtitle: "Attaques", text: "Depuis cases liées (45,46...), sacrifice de dame, rafles." },
            { subtitle: "Ouvertures", text: "32-27 (60%), 31-26 (35%)." },
            { subtitle: "Milieu de jeu", text: "Construire les ailes, contrôler le centre (27, 32), éviter les trous." }
        ]
    },
    {
        id: 13,
        title: "Règle : Prise Majoritaire",
        icon: Sword,
        content: [
            { subtitle: "Principe", text: "On doit OBLIGATOIREMENT prendre du côté du plus grand nombre de pièces." },
            { subtitle: "Valeur", text: "Une Dame compte pour 1 pièce, comme un pion. La qualité des pièces ne compte pas, seule la quantité importe." },
            { subtitle: "Exemple", text: "Dans la position ci-dessous, les Blancs (qui jouent) peuvent prendre 1 pion (vers la gauche) ou 2 pions (vers la droite). Ils DOIVENT prendre les 2 pions.", diagram: { 38: 1, 33: 2, 32: 2, 23: 2, 28: 2, 42: 2 }, turn: 'white', caption: "Les Blancs en 38 doivent prendre 2 pions (33 et 23) et non 1 seul (32)." },
            { subtitle: "Égalité", text: "Si le nombre de pièces à prendre est identique sur plusieurs chemins, le joueur a le libre choix." }
        ]
    },
    {
        id: 14,
        title: "Tactique : Le Coup Turc",
        icon: BookOpen,
        content: [
            { subtitle: "Définition", text: "Une manœuvre tactique basée sur la règle de la prise différée." },
            { subtitle: "Règle Clé", text: "Les pièces prises ne sont retirées du damier qu'à la FIN de la rafle. Une pièce prise reste donc sur le damier pendant la rafle et fait obstacle (butoir)." },
            { subtitle: "Démonstration", text: "Ci-dessous, une illustration classique. Si les Blancs jouent, ils peuvent forcer un gain grâce à cette règle.", diagram: { 48: 1, 49: 1, 18: 4, 29: 1, 32: 1, 38: 1, 42: 1, 47: 1, 15: 2 }, turn: 'white', caption: "Coup Turc : La Dame Noire prendra plusieurs pions mais sera bloquée par une pièce qu'elle vient de capturer." }
        ]
    },
    {
        id: 15,
        title: "Tactique : Coup du Pivot (Barrage)",
        icon: LayoutGrid,
        content: [
            { subtitle: "Concept", text: "Thème de fin de partie où une Dame utilise un de ses propres pions pour bloquer l'adversaire." },
            { subtitle: "Mécanisme", text: "La Dame se place sur la case juste devant son pion de bande (ex: case 31 devant 36, ou 4 devant 9). L'adversaire est alors paralysé." },
            { subtitle: "Exemple", text: "Les Blancs gagnent en enfermant la Dame Noire.", diagram: { 36: 1, 31: 3, 45: 4 }, turn: 'white', caption: "Barrage : La Dame Blanche 31 bloque la Dame Noire 45 grâce au pion 36." }
        ]
    },
    {
        id: 16,
        title: "Répertoire Tactique FFJD",
        icon: Trophy,
        content: [
            { subtitle: "Coups Classiques", text: "Coup de la Bombe, Coup de l'Africain, Coup du Marquis, Coup de la Souricière." },
            { subtitle: "Coups Techniques", text: "Coup du Chapelet, Coup de l'Éponge, Coup du Tiroir, Coup de l'Express." },
            { subtitle: "Fins de Partie", text: "Coup de l'Enfermé, Coup du Tric-Trac, Coup du Butoir." },
            { subtitle: "Source", text: "Ces thèmes sont étudiés dans les écoles de la Fédération Française de Jeu de Dames (FFJD) et la Ligue Rhône-Alpes." }
        ]
    }
];

export default function Academy() {
    const [activeFiche, setActiveFiche] = useState(fiches[0]);

    return (
        <div className="max-w-6xl mx-auto p-6 pb-20">
            <div className="text-center mb-10 space-y-4">
                <h1 className="text-4xl font-black text-[#4a3728] flex items-center justify-center gap-3" style={{ fontFamily: 'Georgia, serif' }}>
                    <GraduationCap className="w-10 h-10 text-yellow-600" />
                    Académie Damcash
                </h1>
                <p className="text-[#6b5138] text-lg font-medium max-w-2xl mx-auto">
                    Maîtrisez les subtilités du jeu de dames, des règles fondamentales aux stratégies avancées. 
                    Inclus des cours officiels de la Fédération Française de Jeu de Dames (FFJD).
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[600px] h-auto">
                {/* Sidebar List */}
                <div className="lg:col-span-4 bg-white/80 backdrop-blur border border-[#d4c5b0] rounded-xl overflow-hidden shadow-lg flex flex-col h-80 lg:h-auto">
                    <div className="p-4 bg-[#4a3728] text-[#e8dcc5] font-bold text-lg flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Sommaire
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {fiches.map((fiche) => (
                                <button
                                    key={fiche.id}
                                    onClick={() => setActiveFiche(fiche)}
                                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
                                        activeFiche.id === fiche.id 
                                            ? 'bg-[#e8dcc5] text-[#4a3728] font-bold shadow-sm' 
                                            : 'hover:bg-[#f5f0e6] text-gray-600'
                                    }`}
                                >
                                    <span className="bg-white/50 w-6 h-6 rounded-full flex items-center justify-center text-xs border border-[#d4c5b0]">
                                        {fiche.id}
                                    </span>
                                    <span className="truncate">{fiche.title}</span>
                                    {fiche.id >= 13 && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                                            NOUVEAU
                                        </span>
                                    )}
                                    {activeFiche.id === fiche.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Content Card */}
                <div className="lg:col-span-8">
                    <Card className="h-full bg-[#fdfbf7] border-[#d4c5b0] shadow-xl flex flex-col overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-[#4a3728] to-[#6b5138] text-[#e8dcc5] py-6">
                            <CardTitle className="text-3xl flex items-center gap-3">
                                {React.createElement(activeFiche.icon, { className: "w-8 h-8 opacity-80" })}
                                Fiche {activeFiche.id} : {activeFiche.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 flex-1 overflow-y-auto">
                            <div className="space-y-6">
                                {activeFiche.content.map((section, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-xl border border-[#e8dcc5] shadow-sm">
                                        <h3 className="text-[#b8860b] font-bold text-lg mb-2 uppercase tracking-wide flex items-center gap-2">
                                            <span className="w-2 h-2 bg-[#b8860b] rounded-full"></span>
                                            {section.subtitle}
                                        </h3>
                                        <p className="text-[#4a3728] leading-relaxed text-lg pl-4 border-l-2 border-[#e8dcc5]">
                                            {section.text}
                                        </p>
                                        {section.diagram && (
                                            <AcademyDiagram 
                                                setup={section.diagram} 
                                                turn={section.turn} 
                                                caption={section.caption}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}