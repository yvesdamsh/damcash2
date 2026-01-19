import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function LegendsCarousel({ gameType }) {
  const { t } = useLanguage();
  const [currentLegendIndex, setCurrentLegendIndex] = React.useState(0);

  const checkersLegends = React.useMemo(() => ([
    {
      id: 'babasy',
      name: t('legend.babasy.name') || 'Baba Sy',
      subtitle: t('legend.babasy.subtitle') || 'Le génie africain',
      image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/8055076a4_1764571213479.jpg',
      description: t('legend.babasy.desc') || "Grand Maître sénégalais, considéré comme l'un des plus grands joueurs de dames de tous les temps.",
      link: 'https://fr.wikipedia.org/wiki/Baba_Sy',
      badge: t('legend.babasy.badge') || 'Légende',
      position: 'object-top'
    },
    {
      id: 'sijbrands',
      name: t('legend.sijbrands.name') || 'Ton Sijbrands',
      subtitle: t('legend.sijbrands.subtitle') || 'Le virtuose hollandais',
      image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/62119ad07_1764873196043.jpg',
      description: t('legend.sijbrands.desc') || 'Champion du monde à plusieurs reprises, connu pour ses parties à l\'aveugle.',
      link: 'https://fr.wikipedia.org/wiki/Ton_Sijbrands',
      badge: t('legend.sijbrands.badge') || 'Champion',
      position: 'object-[center_30%]'
    },
    {
      id: 'boomstra',
      name: t('legend.boomstra.name') || 'Roel Boomstra',
      subtitle: t('legend.boomstra.subtitle') || 'Le prodige moderne',
      image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/38a69b1a1_Screenshot_20251206_032614_SamsungInternet.jpg',
      description: t('legend.boomstra.desc') || 'Champion du monde en titre, alliant technique et créativité.',
      link: 'https://fr.wikipedia.org/wiki/Roel_Boomstra',
      badge: t('legend.boomstra.badge') || 'Maitre',
      position: 'object-top'
    }
  ]), [t]);

  const chessLegends = React.useMemo(() => ([
    {
      id: 'kasparov',
      name: 'Garry Kasparov',
      subtitle: 'The Beast of Baku',
      image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/29a50e470_images.jpeg',
      description: 'World Chess Champion (1985–2000). Widely considered the greatest chess player of all time due to his dominance and longevity at the top.',
      link: 'https://en.wikipedia.org/wiki/Garry_Kasparov',
      badge: 'G.O.A.T.',
      position: 'object-top'
    },
    {
      id: 'magnus',
      name: 'Magnus Carlsen',
      subtitle: 'The Mozart of Chess',
      image: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/692cf465001e7ca7b491343d/1abb4a478_Screenshot_20251211_072546_Facebook.jpg',
      description: 'World Chess Champion (2013–2023). Highest rated player in history. Known for his intuitive style and endgame prowess.',
      link: 'https://en.wikipedia.org/wiki/Magnus_Carlsen',
      badge: 'Champion',
      position: 'object-top'
    }
  ]), []);

  const legends = gameType === 'chess' ? chessLegends : checkersLegends;
  const currentLegend = legends[currentLegendIndex] || null;

  React.useEffect(() => { setCurrentLegendIndex(0); }, [gameType]);
  React.useEffect(() => {
    if (!Array.isArray(legends) || legends.length === 0) return;
    if (currentLegendIndex >= legends.length) setCurrentLegendIndex(0);
  }, [legends.length]);

  const nextLegend = () => setCurrentLegendIndex((i) => (i + 1) % legends.length);
  const prevLegend = () => setCurrentLegendIndex((i) => (i - 1 + legends.length) % legends.length);

  return (
    <div className="relative mb-8 group">
      <div className="absolute top-1/2 -left-4 z-20 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="outline" className="rounded-full bg:white/80 backdrop-blur shadow-lg border:#d4c5b0 hover:bg:#4a3728 hover:text:white" onClick={prevLegend}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>
      <div className="absolute top-1/2 -right-4 z-20 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="outline" className="rounded-full bg:white/80 backdrop-blur shadow-lg border:#d4c5b0 hover:bg:#4a3728 hover:text:white" onClick={nextLegend}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <Card className="overflow-hidden bg:#fdfbf7 dark:bg:#1e1814 border:#d4c5b0 dark:border:#3d2b1f shadow-xl h-[450px] md:h-[380px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentLegend?.id || currentLegendIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col md:flex-row"
          >
            <div className="w-full h-60 md:h-full md:w-2/5 relative shrink-0 overflow-hidden">
              <img
                src={currentLegend?.image}
                alt={currentLegend?.name || 'Legend'}
                className={`w-full h-full object-cover ${currentLegend?.position || 'object-top'}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from:#4a3728 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to:#fdfbf7 dark:md:to:#1e1814" />
              <div className="absolute bottom-0 left-0 p-4 text:#e8dcc5 md:hidden">
                <h3 className="text-xl font-bold">{currentLegend?.name}</h3>
                <p className="text-xs opacity-90">{currentLegend?.badge}</p>
              </div>
            </div>
            <div className="p-6 md:w-3/5 flex flex-col justify-center h-full">
              <div className="hidden md:block mb-3">
                <Badge variant="secondary" className="bg:#e8dcc5 text:#4a3728 hover:bg:#d4c5b0 dark:bg:#3d2b1f dark:text:#e8dcc5 mb-2">
                  {currentLegend?.badge}
                </Badge>
                <h3 className="text-3xl font-black text:#4a3728 dark:text:#e8dcc5 mb-1">{currentLegend?.name}</h3>
                <p className="text-sm text:#8c6b4a dark:text:#a8907a font-serif italic">{currentLegend?.subtitle}</p>
              </div>
              <p className="text:#6b5138 dark:text:#b09a85 mb-6 text-sm leading-relaxed md:text-base line-clamp-5 md:line-clamp-none">
                {currentLegend?.description}
              </p>
              <div className="flex gap-3 mt-auto md:mt-0">
                <Button
                  variant="outline"
                  disabled={!currentLegend?.link}
                  className="border:#4a3728 text:#4a3728 hover:bg:#4a3728 hover:text:#e8dcc5 dark:border:#e8dcc5 dark:text:#e8dcc5 dark:hover:bg:#e8dcc5 dark:hover:text:#1e1814"
                  onClick={() => currentLegend?.link && window.open(currentLegend.link, '_blank')}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {t('common.read_bio')}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-4 right-4 flex gap-2 md:bottom-6 md:right-8 z-10">
          {legends.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentLegendIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${idx === currentLegendIndex ? 'bg:#4a3728 w-6 dark:bg:#b8860b' : 'bg:#d4c5b0 hover:bg:#8c6b4a dark:bg:#3d2b1f'}`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}