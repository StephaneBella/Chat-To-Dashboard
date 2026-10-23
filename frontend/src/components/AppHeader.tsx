import { Link, NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Tableau de bord", icon: "space_dashboard", end: true },
  { to: "/agent", label: "Agent IA", icon: "forum", end: false },
];

export function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[72px] glass border-b border-outline-variant/60">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-8">
        <Link
          to="/"
          aria-label="Superstore AI — accueil"
          className="flex items-center gap-3 group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
            <span className="material-symbols-outlined text-[23px]">
              auto_awesome
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-[17px] font-bold leading-none tracking-tight text-on-surface">
                Superstore AI
              </span>
              <span className="hidden rounded-full border border-primary/20 bg-primary-container/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:inline-block">
                Business
              </span>
            </div>
            <span className="mt-1 hidden text-[11px] leading-none text-outline sm:block">
              Analyse décisionnelle cognitive
            </span>
          </div>
        </Link>

        <nav
          aria-label="Navigation principale"
          className="flex items-center gap-1 rounded-2xl border border-outline-variant/60 bg-white/70 p-1 shadow-soft"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition-all duration-200 sm:px-3.5 ${
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-on-surface-variant hover:bg-primary-container/50 hover:text-primary"
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">
                {item.icon}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-outline-variant/60 bg-white/70 px-2.5 py-1.5 lg:flex">
            <span className="material-symbols-outlined text-[16px] text-primary">
              database
            </span>
            <div className="flex flex-col">
              <span className="text-[9px] font-semibold uppercase leading-none tracking-wider text-outline">
                Entrepôt
              </span>
              <span className="flex items-center gap-1 text-[12px] font-medium leading-tight text-on-surface">
                Superstore
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            </div>
          </div>
          {/* <Link
            to="/agent"
            className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 sm:flex"
          >
            <span className="material-symbols-outlined text-[17px]">
              auto_awesome
            </span>
            Nouvelle analyse
          </Link> */}
        </div>
      </div>
    </header>
  );
}
