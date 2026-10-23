import { Link } from "react-router-dom";

export function ChatLauncher() {
  return (
    <Link
      to="/agent"
      id="open-chat-launcher"
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-4 py-3 text-white shadow-2xl shadow-emerald-900/30 ring-1 ring-white/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-emerald-900/40 sm:right-8 sm:px-5 sm:py-3.5"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
        <span className="material-symbols-outlined text-[20px]">
          forum
        </span>
        <span className="animate-pulse-ring absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-lime-300 ring-2 ring-emerald-600" />
      </span>
      <span className="text-left">
        <span className="flex items-center gap-1.5 text-[13px] font-bold leading-tight">
          Poser une question à l&apos;IA
          <span className="material-symbols-outlined text-[15px] text-lime-200 transition-transform duration-300 group-hover:translate-x-0.5">
            arrow_forward
          </span>
        </span>
        <span className="block text-[11px] leading-tight text-emerald-50/80">
          Insights instantanés sur vos données
        </span>
      </span>
    </Link>
  );
}
