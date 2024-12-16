import React from "react";
import { GuessInput } from "./GuessInput";
import { WaitingForGuesses } from "./WaitingForGuesses";
import type { GameRound } from "@promptmaster/shared";

interface GuessingPhaseProps {
  round: GameRound;
  timeLimit: number;
  currentPlayerId: string;
  onGuessSubmit: (guess: string) => void;
}

export const GuessingPhase: React.FC<GuessingPhaseProps> = ({
  round,
  timeLimit,
  currentPlayerId,
  onGuessSubmit,
}) => {
  const isPrompter = round.prompterId === currentPlayerId;

  if (!round.imageUrl) {
    return (
      <div className="text-center text-slate-600">Waiting for image...</div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isPrompter ? (
        <WaitingForGuesses timeLimit={timeLimit} imageUrl={round.imageUrl} />
      ) : (
        <GuessInput
          timeLimit={timeLimit}
          onSubmit={onGuessSubmit}
          imageUrl={round.imageUrl}
        />
      )}
    </div>
  );
};

// import React from "react";
// import { Timer } from "../Timer";
// import { WaitingForGuesses } from "./components/GuessingPhase/WaitingForGuesses";
// // import WaitingForGuesses from "./components/GuessingPhase/WaitingForGuesses";

// const GuessingPhase = ({
//   round,
//   timeLimit,
//   currentPlayerId,
//   onGuessSubmit,
// }) => {
//   const isPrompter = round.prompterId === currentPlayerId;

//   if (!round.imageUrl) {
//     return (
//       <div className="text-center text-slate-600">Waiting for image...</div>
//     );
//   }

//   return (
//     <div className="w-full max-w-2xl mx-auto">
//       {isPrompter ? (
//         <WaitingForGuesses timeLimit={timeLimit} imageUrl={round.imageUrl} />
//       ) : (
//         <GuessInput
//           timeLimit={timeLimit}
//           onSubmit={onGuessSubmit}
//           imageUrl={round.imageUrl}
//         />
//       )}
//     </div>
//   );
// };

// export default GuessingPhase;
