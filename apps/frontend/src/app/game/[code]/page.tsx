'use client';

import React, { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket2 } from '@/hooks/useSocket2';
import type { Lobby2, GameState2, Player } from '@promptmaster/shared';
import { PromptingPhase } from './components/PromptingPhase/PromptingPhase';
import { type PromptInputHandle } from './components/PromptingPhase/PromptInput';
import { GeneratingPhase } from './components/PromptingPhase/GeneratingPhase';
import { GuessingPhase } from './components/GuessingPhase/GuessingPhase';
import { type GuessInputHandle } from './components/GuessingPhase/GuessInput';
import { ScoringPhase } from './components/GuessingPhase/ScoringPhase';
import { ResultsPhase } from './components/ResultsPhase/ResultsPhase';

interface GamePageProps {
  params: Promise<{
    code: string;
  }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { code } = use(params);
  const router = useRouter();
  const { socket, connect, disconnect, error, validateLobby, emit, on, off } = useSocket2();

  const [isLoading, setIsLoading] = useState(true);
  const [lobby, setLobby] = useState<Lobby2 | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');

  const promptInputRef = useRef<PromptInputHandle>(null);
  const guessInputRef = useRef<GuessInputHandle>(null);

  useEffect(() => {
    console.log('Setting up socket listeners, socket id:', socket?.id);

    let mounted = true;

    const initializeGame = async () => {
      try {
        const sessionData = localStorage.getItem(`lobby:${code}`);
        if (!sessionData) {
          throw new Error('No session data found');
        }

        const session = JSON.parse(sessionData);

        // Store username from session data
        setCurrentUsername(session.username);

        // Connect to socket server
        await connect();

        // Validate lobby with server
        const lobbyData = await validateLobby(code, session.username);

        // Set lobby state
        if (mounted) {
          setLobby(lobbyData);
        }

        // Listen for lobby validation events
        on('lobby:validated', (updatedLobby) => {
          if (mounted) setLobby(updatedLobby);
        });

        // Listen for lobby updates (player changes, etc)
        on('lobby:updated', (updatedLobby) => {
          console.log('Received lobby update:', updatedLobby);
          if (mounted) setLobby(updatedLobby);
        });

        // Listen for game phase changes
        on('game:phase_changed', (updatedLobby) => {
          console.log('Received game phase change:', updatedLobby);
          if (mounted) setLobby(updatedLobby);
        });

        // Handle prompt draft requests
        on('game:request_prompt_draft', () => {
          console.log('Received prompt draft request');
          if (promptInputRef.current) {
            const draft = promptInputRef.current.getDraft();
            if (draft) {
              emit('game:submit_prompt', draft);
            }
          }
        });

        // STUB: Listen for guess submissions
        on('game:guess_submitted', (updatedLobby) => {
          console.log('Received guess submission:', updatedLobby);
          if (mounted) setLobby(updatedLobby);
        });

        // STUB: Handle guess draft requests
        on('game:request_guess_draft', () => {
          console.log('Received guess draft request');
          // Will implement later
        });

        // STUB: Listen for ready state updates
        on('game:ready_state_update', (updatedLobby) => {
          console.log('Received ready state update:', updatedLobby);
          if (mounted) setLobby(updatedLobby);
        });

        // STUB: Listen for game ended event
        on('game:ended', (updatedLobby) => {
          console.log('Game ended:', updatedLobby);
          if (mounted) setLobby(updatedLobby);
        });

        setIsLoading(false);
        setConnectionError(null);
      } catch (err) {
        if (!mounted) return;
        console.error('Game initialization error:', err);
        if (err instanceof Error) {
          setConnectionError(err.message);
        } else {
          setConnectionError('Failed to join game');
        }
        setIsLoading(false);
        if (err instanceof Error && err.message === 'No session data found') {
          router.replace('/');
        }
      }
    };

    initializeGame();

    return () => {
      mounted = false;
      // Clean up event listeners
      off('lobby:validated');
      off('lobby:updated');
      off('game:phase_changed');
      off('game:request_prompt_draft');
      off('game:guess_submitted');
      off('game:request_guess_draft');
      off('game:ready_state_update');
      off('game:ended');
      disconnect();
    };
  }, [code, connect, disconnect, validateLobby, router, socket, emit, on, off]);

  const handlePromptSubmit = (prompt: string) => {
    emit('game:submit_prompt', prompt);
  };

  const handleGuessSubmit = (guess: string) => {
    emit('game:submit_guess', guess);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full mb-4" />
          <p className="text-slate-600">Joining game...</p>
        </div>
      </div>
    );
  }

  if (connectionError || error) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 mb-4">⚠️</div>
          <p className="text-slate-600 mb-4">{connectionError || error?.message}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4F46E5]/90 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!lobby || !lobby.gameState) {
    console.log('No lobby or game state available');
    return null;
  }

  const currentRound = lobby.gameState.rounds[lobby.gameState.rounds.length - 1];

  if (!currentRound) {
    console.log('No current round');
    return null;
  }

  // Ensure phaseEndTime exists before rendering PromptingPhase
  if (currentRound.phase === 'prompting' && !currentRound.phaseEndTime) {
    console.log('Waiting for round phaseEndTime...');
    return null;
  }

  console.log('[RENDER] Current game state:', {
    hasLobby: !!lobby,
    hasGameState: !!lobby?.gameState,
    roundsCount: lobby?.gameState?.rounds.length || 0,
    currentRoundPhase: currentRound?.phase || 'none'
  });

  return (
    <main className="min-h-screen bg-[#FAFBFF] relative overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Round {lobby.gameState.rounds.length}</h1>
          <p className="text-slate-600">
            {currentRound.phase === 'prompting' && 'Waiting for prompt...'}
            {currentRound.phase === 'generating' && 'Generating image...'}
            {currentRound.phase === 'guessing' && 'Time to guess!'}
            {currentRound.phase === 'scoring' && 'Scoring guesses...'}
            {currentRound.phase === 'results' && 'Round Results'}
          </p>
        </div>

        {currentRound.phase === 'prompting' && (
          <PromptingPhase
            lobby={lobby}
            currentUsername={currentUsername}
            onPromptSubmit={handlePromptSubmit}
            ref={promptInputRef}
          />
        )}

        {currentRound.phase === 'generating' && <GeneratingPhase />}

        {currentRound.phase === 'guessing' && (
          <GuessingPhase
            lobby={lobby}
            currentUsername={currentUsername}
            onGuessSubmit={handleGuessSubmit}
            ref={guessInputRef}
          />
        )}

        {currentRound.phase === 'scoring' && <ScoringPhase />}

        {currentRound.phase === 'results' && lobby.gameState.scores && (
          <ResultsPhase
            results={{
              roundNumber: lobby.gameState.rounds.length,
              imageUrl: currentRound.imageUrl!,
              prompterId: currentRound.prompterUsername, // Updated to username
              originalPrompt: currentRound.prompt || '',
              guesses: currentRound.guesses.map((guess) => ({
                playerId: guess.username, // Updated to username
                guess: guess.guess,
                submittedAt: guess.submittedAt,
                score: guess.score ?? 0
              })),
              roundScores: lobby.gameState.scores.map((score) => ({
                playerId: score.playerId,
                score: currentRound.guesses.find((g) => g.username === score.playerId)?.score ?? 0
              })),
              scores: lobby.gameState.scores,
              isLastRound: lobby.gameState.rounds.length === lobby.gameState.prompterOrder.length,
              nextRoundTime: currentRound.phaseEndTime,
              readyPlayers: currentRound.readyPlayers,
              readyPhaseEndTime: currentRound.phaseEndTime
            }}
            players={lobby.players}
          />
        )}

        {/* Fallback if no condition is met */}
        {(!currentRound || currentRound.phase === undefined) && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full mb-4" />
              <p className="text-slate-600">Transitioning to next round...</p>
              <p className="text-xs text-slate-400 mt-2">
                Debug: {lobby?.gameState?.rounds.length || 0} rounds, Phase: {currentRound?.phase || 'undefined'}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
