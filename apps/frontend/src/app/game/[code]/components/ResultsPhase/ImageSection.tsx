import React from 'react';
import type { LobbyPlayer } from '@promptmaster/shared';

interface ImageSectionProps {
  imageUrl: string;
  prompt: string;
  prompterId: string;
  players: LobbyPlayer[];
}

export const ImageSection: React.FC<ImageSectionProps> = ({
  imageUrl,
  prompt,
  prompterId,
  players
}) => {
  const prompter = players.find((p) => p.id === prompterId);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
      {/* Image */}
      <div className="max-w-xl mx-auto">
        {' '}
        {/* Added max width container */}
        <img
          src={imageUrl}
          alt="AI Generated"
          className="w-full aspect-[4/3] object-cover rounded-lg mb-4"
        />
      </div>

      {/* Prompt */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-slate-800 mb-2">
          {prompter?.username}'s prompt
        </h3>
        <p className="text-slate-600 italic text-lg">"{prompt}"</p>
      </div>
    </div>
  );
};
