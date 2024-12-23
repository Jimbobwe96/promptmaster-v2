import React from "react";
import { Timer } from "../Timer";

interface WaitingForGuessesProps {
  endTime: number;
  imageUrl: string;
  guessCount: number;
}

export const WaitingForGuesses: React.FC<WaitingForGuessesProps> = ({
  endTime,
  imageUrl,
  guessCount,
}) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm text-center">
      <img
        src={imageUrl}
        alt="AI Generated"
        className="w-full h-64 object-cover rounded-lg mb-4"
      />
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          Waiting for Guesses
        </h2>
        <p className="text-slate-600">
          Other players are trying to guess your prompt...
          <br />
          <span className="font-medium">
            {guessCount} {guessCount === 1 ? "guess" : "guesses"} submitted
          </span>
        </p>
      </div>

      <div className="flex justify-center">
        <Timer endTime={endTime} />
      </div>
    </div>
  );
};

// import React from "react";
// import { Timer } from "../Timer";

// interface WaitingForGuessesProps {
//   timeLimit: number;
//   imageUrl: string;
//   endTime: number;
// }

// export const WaitingForGuesses: React.FC<WaitingForGuessesProps> = ({
//   timeLimit,
//   imageUrl,
// }) => {
//   return (
//     <div className="bg-white rounded-xl p-6 shadow-sm text-center">
//       <div className="mb-6">
//         <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
//           <svg
//             className="w-8 h-8 text-indigo-600"
//             fill="none"
//             stroke="currentColor"
//             viewBox="0 0 24 24"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               strokeWidth={2}
//               d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
//             />
//           </svg>
//         </div>
//         <h2 className="text-xl font-semibold text-slate-800 mb-2">
//           Waiting for Guesses
//         </h2>
//         <p className="text-slate-600 mb-6">
//           Other players are trying to guess your prompt...
//         </p>

//         <div className="mb-6">
//           <img
//             src={imageUrl}
//             alt="AI Generated Image"
//             className="w-full rounded-lg shadow-md"
//           />
//         </div>
//       </div>

//       <div className="flex justify-center">
//         <Timer duration={timeLimit} />
//       </div>
//     </div>
//   );
// };
