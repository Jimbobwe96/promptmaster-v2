import React, {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Timer } from "../Timer";

interface GuessInputProps {
  endTime: number;
  imageUrl: string;
  onSubmit: (guess: string) => void;
}

export interface GuessInputHandle {
  getDraft: () => string;
}

export const GuessInput = forwardRef<GuessInputHandle, GuessInputProps>(
  ({ endTime, imageUrl, onSubmit }, ref) => {
    const [guess, setGuess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!guess.trim() || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await onSubmit(guess.trim());
      } catch (error) {
        console.error("Failed to submit guess:", error);
        setIsSubmitting(false);
      }
    };

    // Function to return current draft
    const getDraft = useCallback(() => {
      return guess.trim();
    }, [guess]);

    // Expose getDraft to parent component
    useImperativeHandle(ref, () => ({
      getDraft,
    }));

    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="mb-6">
          <img
            src={imageUrl}
            alt="AI Generated"
            className="w-full h-64 object-cover rounded-lg mb-4"
          />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            What prompt created this image?
          </h2>
          <p className="text-slate-600">
            Try to guess the exact prompt used to generate this image.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="A serene landscape with mountains..."
              className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200
                     focus:outline-none focus:ring-2 focus:ring-indigo-500
                     disabled:bg-slate-50 disabled:text-slate-500"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-between items-center">
            <Timer
              endTime={endTime}
              onComplete={() => {
                if (guess.trim()) {
                  onSubmit(guess.trim());
                }
              }}
            />
            <button
              type="submit"
              disabled={!guess.trim() || isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg
                   hover:bg-indigo-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Submitting...
                </span>
              ) : (
                "Submit Guess"
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }
);

GuessInput.displayName = "GuessInput";

// import React, { useState } from "react";
// import { Timer } from "../Timer";

// interface GuessInputProps {
//   endTime: number;
//   onSubmit: (guess: string) => void;
//   imageUrl: string;
// }

// export const GuessInput: React.FC<GuessInputProps> = ({
//   endTime,
//   onSubmit,
//   imageUrl,
// }) => {
//   const [guess, setGuess] = useState("");
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!guess.trim() || isSubmitting) return;

//     setIsSubmitting(true);
//     try {
//       await onSubmit(guess.trim());
//     } catch (error) {
//       console.error("Failed to submit guess:", error);
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="bg-white rounded-xl p-6 shadow-sm">
//       <div className="mb-6">
//         <h2 className="text-xl font-semibold text-slate-800 mb-2">
//           What prompt created this image?
//         </h2>
//         <p className="text-slate-600">
//           Try to guess what prompt was used to generate this image!
//         </p>
//       </div>

//       <div className="mb-6">
//         <img
//           src={imageUrl}
//           alt="AI Generated Image"
//           className="w-full rounded-lg shadow-md"
//         />
//       </div>

//       <form onSubmit={handleSubmit} className="space-y-4">
//         <div>
//           <textarea
//             value={guess}
//             onChange={(e) => setGuess(e.target.value)}
//             placeholder="Enter your guess..."
//             className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200
//                      focus:outline-none focus:ring-2 focus:ring-indigo-500
//                      disabled:bg-slate-50 disabled:text-slate-500"
//             disabled={isSubmitting}
//           />
//         </div>

//         <div className="flex justify-between items-center">
//           {/* <Timer
//             duration={timeLimit}
//             onComplete={() => {
//               if (guess.trim()) {
//                 onSubmit(guess.trim());
//               }
//             }}
//           /> */}
//           <Timer
//             endTime={endTime} // Add endTime to props interface
//             onComplete={() => {
//               if (guess.trim()) {
//                 onSubmit(guess.trim());
//               }
//             }}
//           />
//           <button
//             type="submit"
//             disabled={!guess.trim() || isSubmitting}
//             className="px-6 py-2 bg-indigo-600 text-white rounded-lg
//                    hover:bg-indigo-700 transition-colors
//                    disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {isSubmitting ? (
//               <span className="flex items-center">
//                 <svg
//                   className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                 >
//                   <circle
//                     className="opacity-25"
//                     cx="12"
//                     cy="12"
//                     r="10"
//                     stroke="currentColor"
//                     strokeWidth="4"
//                   />
//                   <path
//                     className="opacity-75"
//                     fill="currentColor"
//                     d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//                   />
//                 </svg>
//                 Submitting...
//               </span>
//             ) : (
//               "Submit Guess"
//             )}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };
