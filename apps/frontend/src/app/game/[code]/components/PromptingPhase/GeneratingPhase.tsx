export const GeneratingPhase = () => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl p-6 shadow-sm text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-indigo-600 animate-spin"
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
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          Generating Image
        </h2>
        <p className="text-slate-600">Teaching AI to paint like Bob Ross...</p>
      </div>
    </div>
  );
};
