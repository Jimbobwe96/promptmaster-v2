import React, { useEffect, useState, useCallback } from 'react';

interface TimerProps {
  endTime: number; // Unix timestamp in milliseconds
  onComplete?: () => void;
  isPaused?: boolean;
}

export const Timer: React.FC<TimerProps> = ({
  endTime,
  onComplete,
  isPaused = false
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isComplete, setIsComplete] = useState(false);

  // Debug log
  useEffect(() => {
    console.log(
      'Timer received endTime:',
      endTime,
      'Current time:',
      Date.now()
    );
  }, [endTime]);

  // Calculate and format remaining time
  const updateTimer = useCallback(() => {
    const now = Date.now();
    // Validate endTime
    if (!endTime || isNaN(endTime)) {
      console.error('Invalid endTime:', endTime);
      return 0;
    }

    const remaining = Math.max(0, endTime - now);

    if (remaining <= 0 && !isComplete) {
      setIsComplete(true);
      onComplete?.();
      return 0;
    }

    return remaining;
  }, [endTime, onComplete, isComplete]);

  useEffect(() => {
    if (isPaused || isComplete) return;

    let animationFrameId: number;
    let lastUpdate = Date.now();

    const tick = () => {
      const now = Date.now();
      // Only update state if at least 100ms have passed (smoother updates)
      if (now - lastUpdate >= 100) {
        const newTimeLeft = updateTimer();
        setTimeLeft(newTimeLeft);
        lastUpdate = now;
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPaused, updateTimer, isComplete]);

  // Format time as mm:ss with validation
  const formatTime = useCallback((ms: number) => {
    if (isNaN(ms) || ms < 0) {
      console.error('Invalid time value:', ms);
      return '0:00';
    }

    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calculate progress percentage with validation
  const progress = (() => {
    if (!endTime || isNaN(endTime)) return 0;
    const total = endTime - Date.now();
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, (timeLeft / total) * 100));
  })();

  // Determine color based on time left
  const getColor = useCallback(() => {
    if (progress > 60) return 'bg-emerald-500';
    if (progress > 30) return 'bg-amber-500';
    return 'bg-red-500';
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
            className={`transition-all duration-100 ${getColor()}`}
          />
        </svg>
        {/* Time text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-slate-700">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Text description */}
      <span className="text-sm text-slate-600">
        {timeLeft > 0 ? 'Time Remaining' : "Time's up!"}
      </span>
    </div>
  );
};
