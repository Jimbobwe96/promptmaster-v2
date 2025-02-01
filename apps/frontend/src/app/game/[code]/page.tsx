'use client';

import React, { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import type {
  GameState,
  LobbySession,
  LobbyPlayer
} from '@promptmaster/shared';
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
  const { socket, connect, disconnect, error, validateLobby, emit } =
    useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');

  const promptInputRef = useRef<PromptInputHandle>(null);
  const guessInputRef = useRef<GuessInputHandle>(null);

  useEffect(() => {
    console.log('Setting up socket listeners, socket id:', socket?.id);

    let mounted = true;

    const initializeGame = async () => {
      try {
        const sessionData = sessionStorage.getItem(`lobby:${code}`);
        if (!sessionData) {
          throw new Error('No session data found');
        }

        const session: LobbySession = JSON.parse(sessionData);

        const initialGameState = sessionStorage.getItem(`game:${code}:state`);
        if (initialGameState) {
          setGameState(JSON.parse(initialGameState));
          sessionStorage.removeItem(`game:${code}:state`);
        }

        await connect();

        if (!mounted) return;

        if (socket) {
          setCurrentPlayerId(socket.id || '');
        }

        const lobby = await validateLobby(code, session.username);

        setPlayers(lobby.players);

        socket?.on('game:started', (initialState: GameState) => {
          console.log('Received initial game state:', initialState);
          if (mounted) setGameState(initialState);
        });

        socket?.on('game:round_started', (round) => {
          if (!mounted || !gameState) return;
          const currentRound = gameState.rounds[gameState.rounds.length - 1];
          if (currentRound) {
            currentRound.endTime = round.endTime;
            setGameState({ ...gameState });
          }
        });

        // triggers generating phase
        socket?.on('game:prompt_submitted', (prompterId) => {
          console.log(
            '\n\n\nRECEIVED GAME PROMPT SUBMITTED EVENT ON FRONTEND\n\n\n'
          );

          if (!mounted || !gameState) return;
          const currentRound = gameState.rounds[gameState.rounds.length - 1];
          if (currentRound) {
            currentRound.status = 'generating';
            setGameState({ ...gameState });
          }
        });

        socket?.on('game:request_draft', () => {
          console.log('Received draft request');
          if (promptInputRef.current) {
            const draft = promptInputRef.current.getDraft();
            console.log('Sending draft:', draft);
            if (draft) {
              emit('game:submit_draft', draft);
            }
          }
        });

        socket?.on(
          'game:guessing_started',
          ({ imageUrl, timeLimit, endTime }) => {
            console.log('Received game:guessing_started event:', {
              imageUrl,
              timeLimit,
              endTime
            });

            if (!mounted) return;

            setGameState((prevState) => {
              if (!prevState) {
                console.error(
                  'No game state available when handling guessing_started'
                );
                return null;
              }

              const updatedRounds = prevState.rounds.map((round, index) => {
                if (index === prevState.rounds.length - 1) {
                  return {
                    ...round,
                    status: 'guessing' as const,
                    imageUrl,
                    endTime
                  };
                }
                return round;
              });

              return {
                ...prevState,
                rounds: updatedRounds
              };
            });
          }
        );

        socket?.on('game:guess_submitted', (playerId) => {
          if (!mounted) return;

          setGameState((prevState) => {
            if (!prevState) return null;

            // Get current round
            const currentRound = prevState.rounds[prevState.rounds.length - 1];
            if (!currentRound) return prevState;

            // Only add guess if it doesn't exist already
            if (!currentRound.guesses.some((g) => g.playerId === playerId)) {
              // Create new guess array with the new guess
              const updatedGuesses = [
                ...currentRound.guesses,
                {
                  playerId,
                  guess: '', // We don't know the guess content on other clients
                  submittedAt: new Date()
                }
              ];

              // Create updated rounds array with the new guess
              const updatedRounds = prevState.rounds.map((round, index) => {
                if (index === prevState.rounds.length - 1) {
                  return {
                    ...round,
                    guesses: updatedGuesses
                  };
                }
                return round;
              });

              // Return new state with updated rounds
              return {
                ...prevState,
                rounds: updatedRounds
              };
            }

            return prevState;
          });
        });

        socket?.on('game:request_guess_draft', () => {
          console.log('Received guess draft request');
          if (guessInputRef.current) {
            const draft = guessInputRef.current.getDraft();
            console.log('Sending guess draft:', draft);
            if (draft) {
              emit('game:submit_guess_draft', draft);
            }
          }
        });

        socket?.on('game:scoring_started', () => {
          console.log('Received game:scoring_started event');

          if (!mounted || !gameState) {
            console.log('Component not mounted or no game state available');
            return;
          }

          setGameState((prevState) => {
            if (!prevState) {
              console.error(
                'No game state available when handling scoring_started'
              );
              return null;
            }

            // Create new state immutably
            return {
              ...prevState,
              rounds: prevState.rounds.map((round, index) => {
                if (index === prevState.rounds.length - 1) {
                  // Update only the last round
                  return {
                    ...round,
                    status: 'scoring'
                  };
                }
                return round;
              })
            };
          });
        });

        socket?.on('game:results', (results) => {
          console.log('Received game results:', results);
          if (!mounted || !gameState) return;

          const currentRound = gameState.rounds[gameState.rounds.length - 1];
          if (currentRound) {
            // Update the round with results data
            currentRound.status = 'results';
            currentRound.prompt = results.originalPrompt;
            currentRound.guesses = results.guesses;
            currentRound.nextRoundTime = results.nextRoundTime;

            // Update game state scores (fix the property name)
            gameState.scores = results.scores; // Changed from results.totalScores

            console.log('Updated gameState:', gameState); // Debug log
            setGameState({ ...gameState });
          }
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
      if (socket) {
        socket.off('game:started');
        socket.off('game:round_started');
        socket.off('game:prompt_submitted');
        socket.off('game:request_draft');
        socket.off('game:guessing_started');
        socket.off('game:guess_submitted');
        socket.off('game:request_guess_draft');
        socket.off('game:scoring_started');
        socket.off('game:results');
        socket.off('game:ended');
      }
      disconnect();
    };
  }, [
    gameState,
    code,
    connect,
    disconnect,
    validateLobby,
    router,
    socket,
    emit
  ]);

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
          <p className="text-slate-600 mb-4">
            {connectionError || error?.message}
          </p>
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

  if (!gameState) {
    console.log('No game state available');
    return null;
  }

  const currentRound = gameState.rounds[gameState.rounds.length - 1];
  console.log('Current game state:', gameState);
  console.log('Current round:', currentRound);

  if (!currentRound) {
    console.log('No current round');
    return null;
  }

  // Ensure endTime exists before rendering PromptingPhase
  if (currentRound.status === 'prompting' && !currentRound.endTime) {
    console.log('Waiting for round endTime...');
    return null;
  }

  console.log(
    'CURRENT ROUND STATUS FOR CONDITIONAL RENDER:' + currentRound.status + '\n'
  );
  // console.log(currentRound.status);

  console.log(currentRound.prompt);

  return (
    <main className="min-h-screen bg-[#FAFBFF] relative overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Round {gameState.rounds.length}
          </h1>
          <p className="text-slate-600">
            {currentRound.status === 'prompting' && 'Waiting for prompt...'}
            {currentRound.status === 'generating' && 'Generating image...'}
            {currentRound.status === 'guessing' && 'Time to guess!'}
            {currentRound.status === 'scoring' && 'Scoring guesses...'}
            {currentRound.status === 'results' && 'Round Results'}
          </p>
        </div>

        {currentRound.status === 'prompting' && (
          <PromptingPhase
            round={currentRound}
            currentPlayerId={currentPlayerId}
            onPromptSubmit={handlePromptSubmit}
            players={players}
            ref={promptInputRef}
          />
        )}

        {currentRound.status === 'generating' && <GeneratingPhase />}

        {currentRound.status === 'guessing' && (
          <GuessingPhase
            round={currentRound}
            currentPlayerId={currentPlayerId}
            onGuessSubmit={handleGuessSubmit}
            ref={guessInputRef}
          />
        )}

        {currentRound.status === 'scoring' && <ScoringPhase />}

        {currentRound.status === 'results' && gameState.scores && (
          <ResultsPhase
            results={{
              roundNumber: gameState.rounds.length,
              imageUrl: currentRound.imageUrl!,
              prompterId: currentRound.prompterId,
              originalPrompt: currentRound.prompt,
              guesses: currentRound.guesses.map((guess) => ({
                ...guess,
                score: guess.score ?? 0
              })),
              roundScores: gameState.scores.map((score) => ({
                playerId: score.playerId,
                score:
                  currentRound.guesses.find(
                    (g) => g.playerId === score.playerId
                  )?.score ?? 0
              })),
              scores: gameState.scores,
              isLastRound:
                gameState.rounds.length === gameState.prompterOrder.length,
              nextRoundTime: currentRound.nextRoundTime!
            }}
            players={players}
            onNextRound={() => {
              console.log('Ready for next round');
            }}
          />
        )}
      </div>
    </main>
  );
}
