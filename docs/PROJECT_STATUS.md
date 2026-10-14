# Project Status — Current State (Scaffolding)

> **Snapshot:** 2026-10-13
> **Purpose:** An honest, accurate record of *what exists in the repository right
> now*, before the chart engine is built. This is the baseline the engine will be
> layered onto (see `docs/ARCHITECTURE.md` for the target design).

---

## 1. One-paragraph summary

The repository is a freshly created **Vite + React 19 + TypeScript** app with
**Tailwind CSS 4** and a minimal **two-route shell** (a Dashboard and an Agent
screen that link to each other). The dependencies the engine will need —
**ECharts 6**, **Zod 4**, and **react-router 7** — are already installed. **No
engine code exists yet**: there is no contract, no adapter, no registry, no mock
backend, no charts. Effectively, the toolbox is bought and the empty rooms are
framed, but nothing has been built inside them.

**Build health right now:** `npm run lint` **passes**; `npm run build`
**fails** with two TypeScript errors (unused `React` imports — see §7).

---

## 2. What has actually been done

| Area | Status |
| --- | --- |
| Project scaffolded (Vite + React + TS) | ✅ done |
| Routing installed and wired (2 screens) | ✅ done |
| Tailwind CSS 4 installed and active | ✅ done |
| ECharts, Zod installed | ✅ done (unused so far) |
| ESLint configured | ✅ done |
| Git repository | ✅ done |
| Chart engine (contract/adapter/registry/renderer) | ❌ not started |
| Mock backend / fixtures | ❌ not started |
| Real backend integration | ❌ not started |
| Unit tests | ❌ none |

So: **infrastructure and a navigable shell exist; the feature does not.**

---

## 3. Installed dependencies

From `package.json`. Version pins are exact as recorded.

### Runtime dependencies

| Package | Version | Why it is here | Used yet? |
| --- | --- | --- | --- |
| `react` | ^19.2.8 | UI library | ✅ shell |
| `react-dom` | ^19.2.8 | Renders React to the DOM | ✅ shell |
| `react-router-dom` | ^7.18.4 | Client-side routing | ✅ shell |
| `echarts` | ^6.1.0 | Chart rendering engine (the chosen library) | ❌ not yet |
| `zod` | ^4.6.7 | Runtime validation + type inference | ❌ not yet |
| `tailwindcss` | ^4.3.3 | Utility-first CSS | ✅ shell |
| `@tailwindcss/vite` | ^4.3.3 | Tailwind Vite plugin | ✅ config |

### Dev dependencies

| Package | Version | Role |
| --- | --- | --- |
| `vite` | ^8.3.0 | Dev server + bundler |
| `@vitejs/plugin-react` | ^6.1.1 | React fast-refresh / JSX |
| `typescript` | ~6.0.2 | Type checker |
| `typescript-eslint` | ^8.69.0 | TS lint rules |
| `eslint` | ^10.10.0 | Linter |
| `@eslint/js` | ^10.0.1 | ESLint base config |
| `eslint-plugin-react-hooks` | ^7.1.1 | Hooks lint rules |
| `eslint-plugin-react-refresh` | ^0.5.6 | Fast-refresh lint rules |
| `globals` | ^17.12.0 | Browser globals for ESLint |
| `@types/node` | ^24.13.3 | Node types |
| `@types/react` | ^19.2.18 | React types |
| `@types/react-dom` | ^19.2.7 | ReactDOM types |

### NPM scripts

| Script | Command | What it does |
| --- | --- | --- |
| `dev` | `vite` | Start the dev server (HMR). |
| `build` | `tsc -b && vite build` | Type-check then produce a production bundle. |
| `lint` | `eslint .` | Lint all files. |
| `preview` | `vite preview` | Serve the built bundle locally. |

---

## 4. Directory tree (exactly what exists)

```
frontend/
├── docs/
│   ├── ARCHITECTURE.md        # target design + build guide (written)
│   └── PROJECT_STATUS.md      # this file
├── public/                    # static assets (Vite default)
├── src/
│   ├── screens/
│   │   ├── AgentScreen/
│   │   │   └── AgentScreen.tsx        # placeholder screen
│   │   └── DashboardScreen/
│   │       └── DashboardScreen.tsx    # placeholder screen
│   ├── App.tsx                # route table
│   ├── index.css              # imports Tailwind
│   └── main.tsx               # app entry, mounts <App/>
├── .gitignore
├── eslint.config.js           # ESLint flat config
├── index.html                 # HTML shell
├── package.json
├── package-lock.json
├── README.md                  # default Vite template readme
├── tsconfig.json              # project references root
├── tsconfig.app.json          # app compiler options
├── tsconfig.node.json         # config-file compiler options
└── vite.config.ts             # plugins: react + tailwind
```

There is **no** `src/engine/`, **no** `src/data/`, **no** `src/lib/` yet — those
are the folders the architecture document tells us to create.

---

## 5. Existing files, file by file

### `index.html` (13 lines)
The single-page HTML shell. Title is **"Chat to Dashboard"**. It contains one
`<div id="root">` and loads `/src/main.tsx` as a module. The favicon link is
commented out. Nothing here needs to change for the engine.

### `src/main.tsx` (13 lines)
The application entry point.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- Mounts `App` into `#root`.
- Wraps everything in `<BrowserRouter>` so routing works.
- `<StrictMode>` double-invokes some functions in dev to surface bugs — relevant
  later because ECharts' `useEffect` must be idempotent (our design disposes and
  recreates cleanly, which handles this).

### `src/App.tsx` (15 lines)
The route table.

```tsx
import { Route, Routes } from "react-router"
import AgentScreen from "./screens/AgentScreen/AgentScreen"
import DashboardScreen from "./screens/DashboardScreen/DashboardScreen"

function App() {
  return (
    <Routes>
       <Route path = "/" element = {<DashboardScreen />}/>
       <Route path = "/agent" element = {<AgentScreen />}/>
    </Routes>
  )
}

export default App
```

- Two routes: `/` → Dashboard, `/agent` → Agent.
- Imports from `"react-router"` (the v7 core package).

### `src/screens/DashboardScreen/DashboardScreen.tsx` (13 lines)
Placeholder. Renders `<h1>Dashboard</h1>` and a `Link to="/agent"`. Imports
`Link` from `"react-router"`. Will be replaced by the panel grid in
`ARCHITECTURE.md` §30.

### `src/screens/AgentScreen/AgentScreen.tsx` (14 lines)
Placeholder. Renders `<h1>Agent</h1>` and a `Link to="/"`. Imports `Link` from
`"react-router-dom"`. Will be replaced by the question-driven demo in
`ARCHITECTURE.md` §29.

> **Small inconsistency to note:** one screen imports `Link` from
> `"react-router"` and the other from `"react-router-dom"`. Both work in v7, but
> we should standardize on **`"react-router-dom"`** (or `"react-router"`) to
> avoid confusion. Cheap to fix when the screens are rewritten.

### `src/index.css` (1 line)
```css
@import "tailwindcss";
```
Activates Tailwind v4. All utility classes used in the architecture doc's
components resolve through this.

### `vite.config.ts` (8 lines)
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
Registers the React and Tailwind plugins. No path aliases (`@/…`) are configured,
so the architecture doc uses **relative imports** deliberately.

### `eslint.config.js` (22 lines)
Flat ESLint config: JS recommended + TypeScript recommended + React Hooks +
React Refresh, with browser globals. `dist` is ignored. `npm run lint` currently
passes cleanly.

### `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`
Standard Vite TypeScript setup using **project references**. The app config is
strict in ways that shape how we must write code (see §6).

---

## 6. TypeScript rules that constrain how we code

`tsconfig.app.json` is stricter than a default template. Three flags matter a lot
for the engine code:

1. **`"verbatimModuleSyntax": true`** — type-only imports **must** use
   `import type { … }`. Importing a type as a value will fail the build. The
   architecture doc already writes `import type { Spec } from …` everywhere, so
   this is respected by design.
2. **`"noUnusedLocals": true` and `"noUnusedParameters": true`** — any unused
   import, variable, or parameter is a **build error**, not a warning. (This is
   the cause of the current build failure — §7.)
3. **`"erasableSyntaxOnly": true`** — disallows TypeScript syntax that cannot be
   erased (e.g. constructor parameter properties, `enum`s with runtime output).
   Our code uses plain types and `z.enum`-style string unions, so it is
   compatible. **Caveat:** a TypeScript `enum` would be rejected; use
   `z.enum([...])` + `z.infer`, exactly as the architecture doc does.

Also: `"target": "es2023"`, `"moduleResolution": "bundler"`,
`"jsx": "react-jsx"` (so **no `import React` is needed for JSX**), and
`"noFallthroughCasesInSwitch": true` (every `case` must `break` or `return`).

---

## 7. Build health (verified just now)

| Command | Result |
| --- | --- |
| `npm run lint` | ✅ **passes** (no output = no problems) |
| `npm run build` | ❌ **fails** (TypeScript) |

Exact errors:

```
src/screens/AgentScreen/AgentScreen.tsx(1,1): error TS6133: 'React' is declared but its value is never read.
src/screens/DashboardScreen/DashboardScreen.tsx(1,1): error TS6133: 'React' is declared but its value is never read.
```

**Cause.** Both placeholder screens still have `import React from 'react'`, a
leftover from the older JSX setup. With `jsx: "react-jsx"` React does not need to
be imported, and `noUnusedLocals` turns the unused import into an error.

**Fix (one line each).** Delete `import React from 'react'` from both screens.
These files are scheduled to be rewritten entirely in `ARCHITECTURE.md` §§29–30,
where the new code does not import React at all. Until then, the dev server
(`npm run dev`) still runs fine — only the production `build` is blocked.

---

## 8. What works today vs. what does not

**Works now**
- `npm run dev` starts and serves the app.
- Navigating between `/` and `/agent` works (the two links).
- Tailwind utilities apply.
- Linting is clean.

**Does not work / does not exist**
- `npm run build` fails (§7).
- No charts, no data, no engine.
- ECharts and Zod are installed but imported nowhere.
- No mock backend, so there is nothing to "hit".
- No tests, no CI.

---

## 9. Where this sits relative to the architecture document

`docs/ARCHITECTURE.md` describes the **target**: a contract (`engine/contract`),
validation (`engine/validate`), an adapter (`engine/adapter`), a registry and
components (`engine/registry`, `engine/components`), and a mock backend
(`data/`, `lib/`). None of those folders exist yet.

The natural first step is **`ARCHITECTURE.md` §31, step 1**: create
`src/engine/contract/spec.ts` and `src/engine/contract/index.ts`. Everything else
depends on the contract, so it must come first.

---

## 10. Recommended immediate next actions (small, then big)

1. *(Optional, 2 minutes)* Remove the two unused `import React` lines so
   `npm run build` is green before we start. Alternatively, leave them — the
   screens get rewritten anyway.
2. *(Start of the engine)* Follow `ARCHITECTURE.md` §31 in order:
   contract → validate → adapter → components → registry → renderer → mocks →
   screens.
3. *(Hygiene)* Standardize the `Link` import source across both screens when they
   are rewritten.
4. *(Before committing engine work)* Confirm `npm run lint` **and**
   `npm run build` both pass.

---

## 11. Conventions to keep (learned from the repo as it stands)

- **Relative imports only** — no path aliases are configured.
- **`import type`** for every type-only import (`verbatimModuleSyntax`).
- **No unused locals/parameters** — the build treats them as errors.
- **No TypeScript `enum`** — use `z.enum([...])` and `z.infer` instead
  (`erasableSyntaxOnly`).
- **`jsx: "react-jsx"`** — never import React just for JSX.
- **Always `break`/`return` in `switch`** — fallthrough is an error.
- **Tailwind v4** — styling is utility classes; `index.css` only imports Tailwind.

---

*This file records the baseline. It should be updated after the engine layers in
`ARCHITECTURE.md` §31 are built, at which point "Scaffolding" becomes a real,
working visualization engine.*
