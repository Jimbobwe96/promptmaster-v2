"use client";

import React, { useEffect, useState, useCallback } from "react";

interface TimerProps {
  duration: number; // in seconds
  onComplete?: () => void;
  isPaused?: boolean;
}

export const Timer: React.FC<TimerProps> = ({
  duration,
  onComplete,
  isPaused = false,
}) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(true);

  // Reset timer when duration changes
  useEffect(() => {
    setTimeLeft(duration);
    setIsRunning(true);
  }, [duration]);

  // Pause timer when isPaused changes
  useEffect(() => {
    setIsRunning(!isPaused);
  }, [isPaused]);

  // Timer countdown logic
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, onComplete]);

  // Format time as mm:ss
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Calculate progress percentage
  const progress = (timeLeft / duration) * 100;

  // Determine color based on time left
  const getColor = useCallback(() => {
    if (progress > 60) return "bg-emerald-500";
    if (progress > 30) return "bg-amber-500";
    return "bg-red-500";
  }, [progress]);

  return (
    <div className="flex items-center space-x-2">
      {/* Timer circle */}
      <div className="relative w-12 h-12">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-slate-200"
          />
          {/* Progress circle */}
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
            className={`transition-all duration-1000 ${getColor()}`}
          />
        </svg>
        {/* Time text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-slate-700">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Optional: Text description */}
      <span className="text-sm text-slate-600">
        {timeLeft > 0 ? "Time Remaining" : "Time's up!"}
      </span>
    </div>
  );
};
