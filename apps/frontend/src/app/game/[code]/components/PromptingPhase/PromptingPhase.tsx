import React, { forwardRef } from "react";
import { PromptInput, PromptInputHandle } from "./PromptInput";
import { WaitingForPrompt } from "./WaitingForPrompt";
import type { GameRound } from "@promptmaster/shared";

interface PromptingPhaseProps {
  round: GameRound;
  currentPlayerId: string;
  onPromptSubmit: (prompt: string) => void;
}

export const PromptingPhase = forwardRef<
  PromptInputHandle,
  PromptingPhaseProps
>(({ round, currentPlayerId, onPromptSubmit }, ref) => {
  console.log("Phase endTime:", round.endTime);
  const isPrompter = round.prompterId === currentPlayerId;

  // We can return early if endTime isn't set
  if (!round.endTime) {
    console.log("No endTime available for round");
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isPrompter ? (
        <PromptInput
          ref={ref}
          endTime={round.endTime}
          onSubmit={onPromptSubmit}
        />
      ) : (
        <WaitingForPrompt
          endTime={round.endTime}
          prompterId={round.prompterId}
        />
      )}
    </div>
  );
});

PromptingPhase.displayName = "PromptingPhase";

// import React, { forwardRef } from "react";
// import { PromptInput, PromptInputHandle } from "./PromptInput";
// import { WaitingForPrompt } from "./WaitingForPrompt";
// import type { GameRound } from "@promptmaster/shared";

// interface PromptingPhaseProps {
//   round: GameRound;
//   endTime: number;
//   currentPlayerId: string;
//   onPromptSubmit: (prompt: string) => void;
// }

// export const PromptingPhase = forwardRef<
//   PromptInputHandle,
//   PromptingPhaseProps
// >(({ round, currentPlayerId, onPromptSubmit }, ref) => {
//   console.log("Phase endTime:", round.endTime);
//   const isPrompter = round.prompterId === currentPlayerId;

//   return (
//     <div className="w-full max-w-2xl mx-auto">
//       {isPrompter ? (
//         <PromptInput
//           ref={ref}
//           endTime={round.endTime!}
//           onSubmit={onPromptSubmit}
//         />
//       ) : (
//         <WaitingForPrompt
//           endTime={round.endTime!}
//           prompterId={round.prompterId}
//         />
//       )}
//     </div>
//   );
// });

// PromptingPhase.displayName = "PromptingPhase";

// // import React from "react";
// // import { PromptInput } from "./PromptInput";
// // import { WaitingForPrompt } from "./WaitingForPrompt";
// // import type { GameRound } from "@promptmaster/shared";

// // interface PromptingPhaseProps {
// //   round: GameRound;
// //   // timeLimit: number;
// //   currentPlayerId: string;
// //   onPromptSubmit: (prompt: string) => void;
// //   onDraftChange: (draft: string) => void;
// // }

// // export const PromptingPhase: React.FC<PromptingPhaseProps> = ({
// //   round,
// //   // timeLimit,
// //   currentPlayerId,
// //   onPromptSubmit,
// //   onDraftChange,
// // }) => {
// //   console.log("Phase endTime:", round.endTime);
// //   const isPrompter = round.prompterId === currentPlayerId;

// //   console.log("PromptingPhase passing endTime:", round.endTime);
// //   return (
// //     <div className="w-full max-w-2xl mx-auto">
// //       {isPrompter ? (
// //         <PromptInput
// //           endTime={round.endTime!} // Changed from timeLimit
// //           onSubmit={onPromptSubmit}
// //           onDraftChange={onDraftChange}
// //         />
// //       ) : (
// //         <WaitingForPrompt
// //           endTime={round.endTime!} // Changed from timeLimit
// //           prompterId={round.prompterId}
// //         />
// //       )}
// //     </div>
// //   );
// // };
