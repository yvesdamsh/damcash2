import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveGameEmbed({ game }) {
  const navigate = useNavigate();
  if (!game) return null;
  const src = `/Game?id=${game.id}&preview=1&mute=1`;
  return (
    <div className="rounded-lg overflow-hidden border border-[#e8dcc5] dark:border-[#3d2b1f] bg-white dark:bg-[#2a201a]">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] uppercase tracking-wide bg-[#fdfbf7] dark:bg-[#1a120b] text-[#6b5138] dark:text-[#b09a85]">
        <div className="flex items-center gap-2">
          <span className="font-bold">Live Preview</span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2c241b]">
            <VolumeX className="w-3 h-3" /> Muted
          </span>
        </div>
        <div className="truncate max-w-[50%] font-semibold">
          {game.white_player_name} vs {game.black_player_name}
        </div>
      </div>
      <div className="relative aspect-video bg-black">
        <iframe
          src={src}
          title={`Live game ${game.id}`}
          className="w-full h-full"
          allow="autoplay; microphone; camera; fullscreen"
        />
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <Button
            size="sm"
            onClick={() => navigate(`/Game?id=${game.id}`)}
            className="bg-[#4a3728] hover:bg-[#2c1e12] text-white shadow-md"
          >
            <Eye className="w-4 h-4 mr-2" /> Watch & Spectate
          </Button>
        </div>
      </div>
    </div>
  );
}