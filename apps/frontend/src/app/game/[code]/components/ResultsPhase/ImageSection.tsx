import React from 'react';
import type { LobbyPlayer } from '@promptmaster/shared';

interface ImageSectionProps {
  imageUrl: string;
  prompt: string;
  prompterId: string;
  players: LobbyPlayer[];
  roundNumber: number;
}

export const ImageSection: React.FC<ImageSectionProps> = ({
  imageUrl,
  prompt,
  prompterId,
  players,
  roundNumber
}) => {
  const prompter = players.find((p) => p.id === prompterId);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
      {/* Round Number */}
      <div className="text-center mb-4">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 font-medium text-sm">
          {roundNumber}
        </span>
      </div>

      {/* Image */}
      <div className="relative">
        <img
          src={imageUrl}
          alt="AI Generated"
          className="w-full aspect-[4/3] object-cover rounded-lg mb-4"
        />
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium text-slate-700 shadow-sm">
            by {prompter?.username || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Prompt */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-slate-800 mb-2">
          Original Prompt
        </h3>
        <p className="text-slate-600 italic">"{prompt}"</p>
      </div>
    </div>
  );
};
