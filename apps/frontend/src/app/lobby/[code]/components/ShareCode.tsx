"use client";

import { useState } from "react";

interface ShareCodeProps {
  code: string;
}

export function ShareCode({ code }: ShareCodeProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="text-center mb-4">
        <h2 className="text-lg font-medium text-slate-600">
          Share this code with your friends
        </h2>
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="bg-slate-50 px-6 py-3 rounded-lg">
          <span className="text-2xl font-mono font-bold tracking-wider text-[#4F46E5]">
            {code.split("").join(" ")}
          </span>
        </div>

        <button
          onClick={copyCode}
          className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg
                   hover:bg-[#4F46E5]/90 transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={copied}
        >
          {copied ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
