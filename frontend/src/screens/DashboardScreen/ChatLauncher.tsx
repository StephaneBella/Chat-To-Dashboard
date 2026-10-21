import { Link } from "react-router";

export function ChatLauncher() {
  return (
    <Link
      to="/agent"
      id="open-chat-launcher"
      className="fixed bottom-6 right-8 z-40 flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-950/40 border border-blue-400/30 backdrop-blur transition-all duration-200 hover:scale-[1.02] cursor-pointer group"
    >
      <div className="relative">
        <span className="block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <svg
        className="w-5 h-5 text-blue-200 group-hover:rotate-12 transition-transform"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      <div className="text-left">
        <div className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
          Poser une question à l'IA
          <span className="text-blue-200 font-normal">
            • Insights instantanés
          </span>
        </div>
        <div className="text-[11px] text-blue-200/80">
          Ouvrir l'espace d'analyse &amp; chat Claude-split →
        </div>
      </div>
    </Link>
  );
}
