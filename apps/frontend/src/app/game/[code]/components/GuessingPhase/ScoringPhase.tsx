export const ScoringPhase = () => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl p-6 shadow-sm text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          Scoring Guesses
        </h2>
        <p className="text-slate-600">Calculating results...</p>
      </div>
    </div>
  );
};
