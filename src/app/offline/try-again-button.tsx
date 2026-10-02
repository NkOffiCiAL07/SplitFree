"use client";

export function TryAgainButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="w-full h-11 rounded-xl gradient-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      Try again
    </button>
  );
}
