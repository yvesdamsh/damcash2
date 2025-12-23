import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveGameEmbed({ game }) {
  const navigate = useNavigate();
  if (!game) return null;
  const src = `/Game?id=${game.id}&preview=1&mute=1`;
  return (
    <div className="relative aspect-square w-full">
      <iframe
        src={src}
        title={`Live game ${game.id}`}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; microphone; camera; fullscreen"
      />
      <button
        onClick={() => navigate(`/Game?id=${game.id}`)}
        className="absolute inset-0"
        aria-label="Open game"
      />
    </div>
  );
}