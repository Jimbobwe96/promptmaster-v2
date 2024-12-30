'use client';

import React, {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react';
import { Timer } from '../Timer';

interface PromptInputProps {
  endTime: number;
  onSubmit: (prompt: string) => void;
}

// Export the type so we can use it in the parent component
export interface PromptInputHandle {
  getDraft: () => string;
}

export const PromptInput = forwardRef<PromptInputHandle, PromptInputProps>(
  ({ endTime, onSubmit }, ref) => {
    const [prompt, setPrompt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isSubmitting) return;

      setIsSubmitting(true);
      try {
        await onSubmit(prompt.trim());
      } catch (error) {
        console.error('Failed to submit prompt:', error);
        setIsSubmitting(false);
      }
    };

    // Function to return current draft
    const getDraft = useCallback(() => {
      return prompt.trim();
    }, [prompt]);

    // Expose getDraft to parent component
    useImperativeHandle(ref, () => ({
      getDraft
    }));

    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Enter Your Prompt
          </h2>
          <p className="text-slate-600">
            Describe the image you want to generate. Be creative!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A serene landscape with mountains..."
              className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200 text-slate-800
                     focus:outline-none focus:ring-2 focus:ring-indigo-500
                     disabled:bg-slate-50 disabled:text-slate-500"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-between items-center">
            <Timer
              endTime={endTime}
              onComplete={() => {
                if (prompt.trim()) {
                  onSubmit(prompt.trim());
                }
              }}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isSubmitting}
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
                'Submit Prompt'
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }
);

PromptInput.displayName = 'PromptInput';
