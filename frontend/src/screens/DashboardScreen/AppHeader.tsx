export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 z-50 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-container to-secondary-container flex items-center justify-center text-on-primary-container shadow-sm shadow-primary/20">
            <span className="material-symbols-outlined text-[22px] text-white">
              auto_awesome
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base text-on-surface font-bold leading-none tracking-tight">
              Superstore AI
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container/20 text-secondary text-[11px] font-semibold border border-secondary/30 hidden sm:inline-block">
              Business Edition
            </span>
          </div>
        </div>
        <div className="h-6 w-px bg-outline-variant/30 mx-1 hidden md:block" />
        <div className="flex items-center gap-2 bg-surface-container-lowest/70 border border-outline-variant/30 px-2.5 py-1.5 rounded-xl opacity-90">
          <span className="material-symbols-outlined text-[15px] text-outline">
            database
          </span>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-outline font-semibold leading-none">
              Jeu de données
            </span>
            <span className="text-[12px] font-medium text-on-surface leading-tight flex items-center gap-1.5">
              Superstore (par défaut)
              <span className="material-symbols-outlined text-[13px] text-outline">
                lock
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 hidden">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-[12px] text-on-surface hover:text-white transition-colors cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">
            upload_file
          </span>
          <span className="font-medium">Importer un fichier</span>
        </button>
        <button
          type="button"
          title="Aide &amp; Guide méthodologique"
          className="w-9 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors border border-outline-variant/30"
        >
          <span className="material-symbols-outlined text-[19px]">
            help_outline
          </span>
        </button>
        <div className="flex items-center gap-2 pl-1 border-l border-outline-variant/30">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center font-bold text-on-primary text-[13px] shadow-sm">
            JD
          </div>
        </div>
      </div>
    </header>
  );
}
