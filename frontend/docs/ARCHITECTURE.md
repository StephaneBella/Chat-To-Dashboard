# Config-Driven Chart Engine — Full Architecture & Build Guide

> A complete, beginner-friendly walkthrough of the visualization engine:
> what we are building, why every piece exists, and exactly how to build it.
> By the end you will be able to run the frontend, ask it a question, and watch a
> **simulated backend response** turn into a correctly rendered chart.

---

## How to read this document

This document is written in four parts, and you should read them in order the
first time:

- **Part I — Ideas.** The concepts, the data contract, and the map of files.
  No code assumptions. Read this even if you never open the code.
- **Part II — How it works.** The *pipeline*: the exact journey a backend
  response takes from raw JSON to a chart on screen. One real dataset is traced
  the whole way, so you can see the numbers move.
- **Part III — The code.** Every file, in full, ready to copy. Each block is
  explained in four ways:
  1. **In plain words** — the human explanation.
  2. **Why it exists** — the problem it solves.
  3. **Line by line** — what each instruction actually does.
  4. **How it connects** — who gives it input, who takes its output.
- **Part IV — Build & run.** The step-by-step order to create the files, how to
  *simulate* the backend, and a click-by-click demo script that proves it works.

There is no prior knowledge assumed. Every time a new programming idea appears
(like `type`, `interface`, `async/await`, or `.map`), it is explained the first
time. If you can read this paragraph, you can read this document.

---

## Who this is for (and what "done" means)

You are building a **dashboard engine**. A user asks a question in plain words
("compare sales and profit across regions"). Somewhere a piece of software
decides *which kind of chart* answers that question and *how to arrange the
data*. Your job — this project — is the piece that takes that decision plus the
data and **draws the chart**, correctly, for every kind of question.

We are **frontend-only right now**. There is no real backend yet. So we will:

1. Define the exact JSON shape the backend *will* return (the **contract**).
2. Build the engine that consumes that shape.
3. Build a **mock backend**: a fake function that returns the contract-shaped
   JSON, so you can run and prove the engine today.
4. Make the mock swappable for the real backend later, without touching the
   engine.

**"Done" for this project** means: on the Agent screen you click an example
question, a loading state appears, then the correct chart renders — and if the
data is empty or broken, you get a clean empty/error card instead of a crash.

### The vocabulary we will use

| Term | Means |
| --- | --- |
| **Spec** | The *description* of a chart: its type, title, and which columns map to which visual role. Contains no data. |
| **Data** | The rows of values, in **long format** (one row per combination). |
| **Envelope** | The outer wrapper that carries the status, the spec, the data, and any error together. |
| **Field** | One column name shared by the spec and every data row (e.g. `region`). |
| **Encoding** | The mapping from fields to visual roles (`x`, `y`, `series`, `value`, `label`). |
| **Channel** | One visual role inside the encoding (`x`, `y`, `series`, …). |
| **Series** | One drawn line/bar-group/pie-slice-set on the chart. |
| **Adapter** | The code that converts *spec + data* into the charting library's own format. |
| **Registry** | A lookup table from `chartType` string to the React component that draws it. |
| **Reshape / Pivot** | Turning many long rows into the wide arrays every chart library expects. |

---

# Part I — Ideas

## 1. The three producers (and the one consumer)

The most important idea in this whole project: **the thing that knows the data
and the thing that knows the chart are different things, made by different
people.**

There are three producers of information:

```
 ┌───────────────┐     ┌──────────────────┐     ┌────────────────────┐
 │   BACKEND     │     │   AGENT / LLM    │     │   ORCHESTRATOR     │
 │ (SQL / data)  │     │ (picks the chart)│     │  (glues them)      │
 └───────┬───────┘     └────────┬─────────┘     └─────────┬──────────┘
         │                      │                         │
     columns + rows         the Spec                 the Envelope
   (data + column types)  (type + encoding)     { status, spec, data }
         │                      │                         │
         └──────────────────────┴──────────────┬──────────┘
                                               ▼
                                    ┌────────────────────┐
                                    │   CHART ENGINE     │
                                    │ (this project)     │
                                    │ consumes {spec,data}│
                                    └────────────────────┘
```

- The **backend** answers "here are the rows, and here is the type of each
  column." It never thinks about line-vs-bar.
- The **agent / LLM** answers "here is the spec — a line chart with `year` on x
  and `order_count` on y, split by `region`." It never touches rows.
- The **orchestrator** combines both into one **envelope** and hands it to us.

**Why split them?** Because if they were welded into a single object, two
different programs could never produce them independently. The backend team can
change their query without breaking the chart-choice logic, and the LLM can
change its chart choice without breaking the backend. Each side has one job.

**What this means for us:** the engine's only input is `{ spec, data }` (plus an
optional status/error). It does **not care who made them**. Today we fake both
with mocks; tomorrow the agent fills the spec and the backend fills the data.
That is the seam that keeps us unblocked.

### The naive first attempt, and why it fails

Imagine we tried the simplest possible thing: one chart config with one field on
x and one field on y.

```
x = "region", y = "sales"      → OK for one measure.
```

Then the user asks: **"compare sales and profit across regions."** That is *two*
numbers per region. Our single `y` cannot hold two fields. We would have to beg
the backend to reshape `sales` and `profit` into one awkward measure column —
easy to get wrong, and it distorts the data.

So we make `y` able to be **one field or an array of fields**. The same problem
happens with grouping: "shipping modes by region" groups by *two* things
(region *and* mode). So `series` is also one-field-or-an-array.

That single decision — `y` and `series` can each be a single field **or a list**
— is what lets one engine answer every example question without hacks. We will
enforce it in the contract with a type called `FieldSpecOrArray`.

## 2. Long format: the one data shape to rule them all

Chart libraries want *wide* data:

```
{ region: "Central", sales: 120000, profit: 18000 }
```

But wide data cannot express "two grouping fields" and breaks the moment the
number of series changes. So the backend always returns **long format**:

```
{ region: "Central", year: "2022", order_count: 120 }
{ region: "Central", year: "2023", order_count: 150 }
{ region: "North",   year: "2022", order_count: 90 }
...
```

One row per unique combination of dimensions. It is boring, it is predictable,
and — crucially — **every encoded field is present as a key in every row**. The
engine's job is to reshape (pivot) these rows into the wide arrays the library
wants. The backend never pivots; the frontend never aggregates. Clean division.

## 3. Where the work happens (the division of labour)

This is the rule that prevents the classic double-counting bug:

| Job | Owner | Why there |
| --- | --- | --- |
| Filtering, joining, `GROUP BY`, `SUM` | **SQL / backend** | It is what databases are built for; doing it twice invents wrong numbers. |
| Reshaping rows into arrays | **Frontend adapter** | Pure layout; no arithmetic on the values. |
| Choosing chart type | **Agent / LLM** | It is a language decision, not a maths one. |
| Drawing pixels | **ECharts** | A mature rendering library. |

The frontend **does not re-aggregate**. If the rows are already summed, summing
them again doubles them. We only aggregate when the spec explicitly says the
rows are raw (`aggregate: "sum"`), which should be rare.

## 4. Missing combinations are gaps, not zeros

If `(region=North, year=2021)` has no row, that is a **gap** — the value is
unknown. If we auto-fill it with `0`, the line plunges to the floor and invents
a trend that does not exist. So the default is `null` (a gap). A chart can
opt into zeros with `options.missing: "zero"` if it truly must (some stacked
bars do).

---

## 5. The contract, field by field

Everything below is JSON. The engine will validate it with **Zod** (explained in
Part III) so that bad input produces a friendly error, not a crash.

### 5.1 The envelope (what the engine receives)

```jsonc
{
  "contractVersion": 1,          // lets the format evolve later without breaking
  "status": "success",           // "success" | "empty" | "error"
  "spec": { /* see 5.2 */ },     // null when status is "error"
  "data": [ /* long-format rows */ ],
  "error": null,                 // { "code": "...", "message": "..." } when status="error"
  "meta": {
    "rowCount": 8,
    "truncated": false,          // true if the backend capped the result
    "generatedAt": "2026-10-13T10:00:00Z"
  }
}
```

- **`contractVersion`** — a number. If we ever change the shape, we bump this and
  old code can detect it. Start at `1`.
- **`status`** — the *first thing the engine reads*. It decides whether to show a
  chart, an empty state, or an error card. Making status explicit means empty and
  error are normal, expected outcomes — not exceptions.
- **`spec`** — the chart description. Kept *outside* the data so the same spec
  can be reused on a new result set, and so two different producers can fill
  them.
- **`data`** — the long-format rows.
- **`error`** — present only for `status: "error"`.
- **`meta`** — optional bookkeeping; `truncated` lets the UI warn "results capped."

### 5.2 The spec (the chart description)

```jsonc
{
  "id": "mode-by-region",                // a stable identifier, used as React key
  "chartType": "line",                   // line|area|bar|hbar|stackedBar|groupedBar|pie|donut|kpi|table
  "title": "Evolution of Shipping Modes by Region",
  "subtitle": "",                        // optional
  "encoding": {
    "x":      { "field": "year",        "type": "category", "title": "Year" },
    "y":      [ { "field": "order_count","type": "number",  "title": "Orders", "format": "number" } ],
    "series": [ { "field": "region" }, { "field": "shipping_mode" } ],
    "value":  null,
    "label":  null
  },
  "options": {
    "stacked": false,
    "smooth": true,
    "legend": true,
    "horizontal": false,
    "missing": "null",
    "seriesSeparator": " — "
  }
}
```

### 5.3 A `FieldSpec` (one channel value)

Every channel (`x`, `y`, `series`, `value`, `label`) holds one of these, or for
`y`/`series` also a **list** of these:

| Key | Required | Meaning |
| --- | --- | --- |
| `field` | yes | Must exactly match a key in every data row. |
| `type` | no | `"number"` \| `"category"` \| `"date"`. Tells axis/scaling how to treat it. |
| `title` | no | The human label for the axis/legend. Falls back to `field`. |
| `format` | no | `"number"` \| `"currency"` \| `"percent"` \| `"compact"`. Presentation only. |
| `aggregate` | no | `"sum"` \| `"avg"` \| `"min"` \| `"max"` \| `"count"`. **Normally absent** — the backend already aggregated. |
| `axis` | no | `"left"` \| `"right"`. Reserved for future dual-axis. |

### 5.4 Data rules the backend must follow

1. **Always long format** — one row per unique dimension combination.
2. Every encoded field exists as a key in **every** row (or explicit `null`).
3. Value types match `type`: numbers as JSON numbers, categories as strings,
   dates as ISO-8601 strings (`"2023-01-01"`).
4. **Row order = display order.** The backend sorts rows to control the order of
   x-categories and series. The frontend preserves first-seen order. (Exception:
   when `x.type` is `number`/`date`, the frontend sorts naturally.)
5. **No pre-pivoting.** Rows stay long; the frontend reshapes.

### 5.5 What each channel means per chart type

| chartType | x | y | series | value | label |
| --- | --- | --- | --- | --- | --- |
| `line` / `area` | dimension | measure(s) | optional grouping | – | – |
| `bar` | dimension | measure(s) | optional grouping | – | – |
| `stackedBar` | dimension | measure(s) | grouping | – | – |
| `groupedBar` | dimension | measure(s) | grouping | – | – |
| `hbar` | dimension | measure(s) | optional grouping | – | – |
| `pie` / `donut` | – | – | – | magnitude | slice name |
| `kpi` | – | measure | – | – | – |
| `table` | – | – | – | – | – |
| `scatter` (stretch) | number | number measure(s) | optional | – | – |
| `heatmap` (stretch) | category | – | row category | magnitude | – |

`y` and `series` may each be a single object **or a list** — that is what makes
"sales and profit" (two y) and "region × mode" (two series) possible in one
engine.

---

## 6. Module map (the files we will build)

```
src/
├── engine/
│   ├── contract/
│   │   ├── spec.ts            # Zod schemas + TypeScript types for the whole contract
│   │   └── index.ts           # re-exports so imports stay short
│   ├── validate.ts            # validateEnvelope() -> typed success/failure result
│   ├── adapter/
│   │   ├── reshape.ts         # long rows -> wide arrays (the pivot)
│   │   ├── format.ts          # formatValue(): currency/percent/compact/number
│   │   ├── toEChartsOption.ts # spec+data -> ECharts `option` object
│   │   └── index.ts           # rebuilds and re-exports the adapter API
│   ├── registry/
│   │   └── chartRegistry.tsx  # chartType string -> React component
│   └── components/
│       ├── EChart.tsx         # thin wrapper: init/setOption/resize/dispose
│       ├── ChartRenderer.tsx  # the public entry: envelope -> screen
│       ├── states/
│       │   ├── LoadingState.tsx
│       │   ├── EmptyState.tsx
│       │   └── ErrorCard.tsx
│       └── dom/
│           ├── KpiCard.tsx    # KPI drawn with plain HTML, not a library
│           └── DataTable.tsx  # table drawn with plain HTML
├── data/
│   ├── mockBackend.ts         # simulated backend: query id -> { columns, rows }
│   ├── mockAgent.ts           # simulated agent:  query id -> spec
│   └── fixtures/
│       └── index.ts           # the example datasets + their specs
└── lib/
    └── visualizationClient.ts # fetchVisualization(): the swappable seam
```

**Why this layout?**
- `contract/` is *only* shapes and types — no behaviour. Everyone imports from
  here, so there is one definition of truth.
- `adapter/` is *pure functions*: JSON in, JSON out, no React, no DOM. Pure code
  is trivial to test and reason about.
- `components/` is the only place that imports React and ECharts.
- `data/` and `lib/` are the *fake backend* we can later delete or replace.

That separation — **backend → adapter → registry → component** — is the entire
architecture in one line. Part II walks a real response through it.

---

# Part II — How it works

## 7. The rendering pipeline

When a response arrives, it passes through a fixed sequence of stations. Each
station does one thing and refuses to guess:

```
  raw envelope (unknown JSON)
        │
        ▼
  ┌───────────────┐   bad shape?  ┌──────────────┐
  │ 1. VALIDATE   │──────────────▶│ ErrorCard     │
  │ validateEnvelope()             └──────────────┘
  └───────┬───────┘
          │  envelope typed & trusted
          ▼
  ┌───────────────┐   status=error?  ┌──────────────┐
  │ 2. ROUTE      │─────────────────▶│ ErrorCard     │
  │ status/spec   │  status=empty?   ├──────────────┤
  │               │─────────────────▶│ EmptyState    │
  └───────┬───────┘                  └──────────────┘
          │  status=success, spec != null
          ▼
  ┌───────────────┐   missing field? ┌──────────────┐
  │ 3. CROSS-CHECK│─────────────────▶│ ErrorCard     │
  │ spec vs data  │                  └──────────────┘
  └───────┬───────┘
          │  every encoded field exists in the rows
          ▼
  ┌───────────────┐
  │ 4. REGISTRY   │  look up chartType -> component
  └───────┬───────┘
          │  the right React component
          ▼
  ┌───────────────┐
  │ 5. ADAPTER    │  spec + data -> ECharts `option`
  └───────┬───────┘
          │  the library's own format
          ▼
  ┌───────────────┐
  │ 6. ECharts    │  init / setOption / resize / dispose
  └───────┬───────┘
          │
          ▼
        pixels
```

**Why this order?** Because each station makes the next one safer. Validation
turns "unknown JSON" into "typed JSON." Routing handles the two non-happy paths
before any chart code runs. Cross-checking catches the most common real bug
(spec says `sales`, rows are missing `sales`). Only then do we look up a
component and adapt. A failure at any station lands on a friendly card.

The order also means **no chart component ever sees invalid data** — they can
assume their inputs are correct, which keeps them small.

## 8. The adapter and the reshape — traced with real numbers

This is the heart of the engine and the part most people get wrong, so we trace
it. We will use the "shipping modes by region" dataset.

### 8.1 The input rows (long format)

```json
[
  { "region": "Central", "shipping_mode": "Air",  "year": "2022", "order_count": 120 },
  { "region": "Central", "shipping_mode": "Sea",  "year": "2022", "order_count": 80  },
  { "region": "Central", "shipping_mode": "Air",  "year": "2023", "order_count": 150 },
  { "region": "Central", "shipping_mode": "Sea",  "year": "2023", "order_count": 95  },
  { "region": "North",   "shipping_mode": "Air",  "year": "2022", "order_count": 90  },
  { "region": "North",   "shipping_mode": "Sea",  "year": "2022", "order_count": 60  },
  { "region": "North",   "shipping_mode": "Air",  "year": "2023", "order_count": 110 },
  { "region": "North",   "shipping_mode": "Sea",  "year": "2023", "order_count": 70  }
]
```

### 8.2 The spec says which fields play which role

```json
"encoding": {
  "x":      { "field": "year" },
  "y":      [ { "field": "order_count", "title": "Orders" } ],
  "series": [ { "field": "region" }, { "field": "shipping_mode" } ]
}
```

Read that as: *x is the year; the height is the order count; and each drawn line
is one combination of (region, shipping_mode).*

### 8.3 Station 1 — collect the x-categories in first-seen order

Walk the rows top to bottom and remember the first time you see each `year`:

```
seen: {}                       → categories = []
row 1 year=2022 → new         → categories = ["2022"]
row 2 year=2022 → already seen
row 3 year=2023 → new         → categories = ["2022", "2023"]
...
final categories = ["2022", "2023"]
```

Because the backend sorted the rows, our preserved order matches the backend's
intended display order. This is the "row order = display order" rule in action.

### 8.4 Station 2 — discover the series and lay down `null` slots

Each unique combination of the `series` fields becomes one drawn series. We give
it a display name by joining its values with the separator (`" — "`):

```
seriesKey = (region + "|" + mode)        display name
─────────────────────────────────────────────────────────
"Central|Air"                     →    "Central — Air"
"Central|Sea"                     →    "Central — Sea"
"North|Air"                       →    "North — Air"
"North|Sea"                       →    "North — Sea"
```

For each series we create an array as long as `categories`, filled with `null`
(our "gap" default):

```
"Central — Air" → [ null, null ]     // one slot per year
"Central — Sea" → [ null, null ]
"North — Air"   → [ null, null ]
"North — Sea"   → [ null, null ]
```

### 8.5 Station 3 — fill the slots

For each row, find its category index and its series, then place the value:

```
row { Central, Air, 2022, 120 } → series "Central — Air", year index 0 → [120, null]
row { Central, Sea, 2022,  80 } → series "Central — Sea", year index 0 → [ 80, null]
row { Central, Air, 2023, 150 } → series "Central — Air", year index 1 → [120, 150 ]
row { Central, Sea, 2023,  95 } → series "Central — Sea", year index 1 → [ 80, 95  ]
row { North,   Air, 2022,  90 } → series "North — Air",   year index 0 → [ 90, null]
row { North,   Sea, 2022,  60 } → series "North — Sea",   year index 0 → [ 60, null]
row { North,   Air, 2023, 110 } → series "North — Air",   year index 1 → [ 90, 110 ]
row { North,   Sea, 2023,  70 } → series "North — Sea",   year index 1 → [ 60, 70  ]
```

A combination that simply has no row stays `null` forever — it becomes a visible
gap instead of a fake zero. That is exactly the honesty rule from Part I.

### 8.6 Station 4 — hand the wide shape to ECharts

The reshape output is now a tidy structure:

```json
{
  "categories": ["2022", "2023"],
  "series": [
    { "name": "Central — Air", "values": [120, 150] },
    { "name": "Central — Sea", "values": [80,  95 ] },
    { "name": "North — Air",   "values": [90,  110] },
    { "name": "North — Sea",   "values": [60,  70 ] }
  ]
}
```

`toEChartsOption` turns this into ECharts' own language:

```js
{
  xAxis: { type: "category", data: ["2022", "2023"] },
  yAxis: { type: "value" },
  series: [
    { name: "Central — Air", type: "line", data: [120, 150] },
    { name: "Central — Sea", type: "line", data: [80,  95 ] },
    { name: "North — Air",   type: "line", data: [90,  110] },
    { name: "North — Sea",   type: "line", data: [60,  70 ] }
  ]
}
```

ECharts draws it. We never did any arithmetic on the numbers — we only moved
them into the right slots. That is the whole adapter.

### 8.7 The multi-measure case ("sales and profit")

Same algorithm, one twist. `y` is an array of two fields and there are **no**
series fields:

```json
"region": "Central", "total_sales": 120000, "total_profit": 18000
```

When there is no `series` field, each `y` field becomes its own series, named by
its `title`:

```json
{
  "categories": ["Central", "North", "South"],
  "series": [
    { "name": "Sales",  "values": [120000, 90000, 70000] },
    { "name": "Profit", "values": [18000,  12000, 9000 ] }
  ]
}
```

That is why `y` being an array matters: it needs no special code path, just a
loop over the measures instead of a single value.

### 8.8 When there are both multiple measures *and* series fields

The result is the cross product: every (measure × series-combination) becomes a
series, named `"<Measure> — <combo>"`. This is powerful but can flood the legend.
A soft cap (e.g. 24 series) is listed as a "deferred" improvement in Part IV.

## 9. Validation with Zod (and why it matters)

### 9.1 The problem: TypeScript types vanish at runtime

TypeScript types are a *compile-time* promise. But backend JSON arrives at
runtime, and TypeScript has already been erased by then. If we trust it blindly
and the backend sends `"data": null` instead of `[]`, our `.map()` explodes and
the whole app white-screens.

**Zod** is a small library that checks JSON against a schema **while the program
is running**, and it can also *infer* the TypeScript type from that schema — so
you write the shape once and get both runtime safety and compile-time types.

```ts
const FieldSpecSchema = z.object({ field: z.string().min(1) });
type FieldSpec = z.infer<typeof FieldSpecSchema>;   // { field: string }
```

### 9.2 `safeParse` vs `parse`

- `schema.parse(x)` throws when invalid → good for cases where you *want* the
  exception.
- `schema.safeParse(x)` returns an object:
  `{ success: true, data }` or `{ success: false, error }` → good for us,
  because we want to *show a card*, not crash.

### 9.3 Two layers of validation

1. **Shape validation** — `validateEnvelope` checks the envelope/spec/data are
   structurally correct (right keys, right primitive types).
2. **Cross validation** — after the shape is trusted, `crossValidate(spec, data)`
   checks a *semantic* rule Zod cannot express: every field named in the
   encoding must actually exist as a key in the rows. If the spec says `sales`
   and the rows lack `sales`, we show an error card instead of drawing nonsense.

### 9.4 The spec's own rules (`superRefine`)

Some rules depend on `chartType`. A `pie` needs `value` and `label`; a `line`
needs `x` and `y`. Zod's `.superRefine((value, ctx) => …)` lets us attach these
conditional checks to the same schema. When a rule fails we push an issue with
`ctx.addIssue`, and the parse fails with a readable message.

---

---

# Part III — The code

> Create the files in the order shown. Each block is explained four ways:
> **In plain words**, **Why it exists**, **Line by line**, and **How it connects**.

## 10. `src/engine/contract/spec.ts`

**In plain words.** This file is the dictionary of the whole project. It defines,
using Zod, exactly what every part of the contract looks like, and then asks Zod
to also produce the matching TypeScript types. Nothing here draws or transforms
anything — it only *describes*.

**Why it exists.** If two files each invented their own idea of what a `spec` is,
they would slowly drift apart and break. By defining it once and importing it
everywhere, there is a single source of truth.

```ts
import { z } from "zod";

/* ---------- Primitive vocabularies ---------- */

// The allowed data types for a column.
export const FieldTypeSchema = z.enum(["number", "category", "date"]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

// Presentation formats (how a number is displayed, never computed).
export const FieldFormatSchema = z.enum(["number", "currency", "percent", "compact"]);
export type FieldFormat = z.infer<typeof FieldFormatSchema>;

// How to combine duplicate rows when the backend did NOT pre-aggregate.
export const AggregateSchema = z.enum(["sum", "avg", "min", "max", "count"]);
export type Aggregate = z.infer<typeof AggregateSchema>;

/* ---------- A single channel value ---------- */

export const FieldSpecSchema = z.object({
  field: z.string().min(1, "field must be a non-empty column name"),
  type: FieldTypeSchema.optional(),
  title: z.string().optional(),
  format: FieldFormatSchema.optional(),
  aggregate: AggregateSchema.optional(),
  axis: z.enum(["left", "right"]).optional(),
});
export type FieldSpec = z.infer<typeof FieldSpecSchema>;

/* ---------- "one field OR a list of fields" ---------- */

// x/value/label take exactly one field.
export const SingleFieldSpecSchema = FieldSpecSchema;

// y/series accept one field OR a non-empty list of fields.
export const FieldSpecOrArraySchema = z.union([
  FieldSpecSchema,
  z.array(FieldSpecSchema).min(1),
]);

// Optional channels may also be null / undefined.
export const OptionalFieldSpecSchema = z
  .union([FieldSpecSchema, z.array(FieldSpecSchema).min(1)])
  .nullish(); // nullish() = nullable() + optional()
export type OptionalFieldSpec = z.infer<typeof OptionalFieldSpecSchema>;

/* ---------- Chart types ---------- */

export const ChartTypeSchema = z.enum([
  "line",
  "area",
  "bar",
  "hbar",
  "stackedBar",
  "groupedBar",
  "pie",
  "donut",
  "kpi",
  "table",
  "scatter",
  "heatmap",
]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

/* ---------- Encoding ---------- */

export const EncodingSchema = z.object({
  x: OptionalFieldSpecSchema,
  y: OptionalFieldSpecSchema,
  series: OptionalFieldSpecSchema,
  value: OptionalFieldSpecSchema,
  label: OptionalFieldSpecSchema,
});
export type Encoding = z.infer<typeof EncodingSchema>;

/* ---------- Options (look-and-feel flags) ---------- */

export const OptionsSchema = z.object({
  stacked: z.boolean().optional(),
  smooth: z.boolean().optional(),
  horizontal: z.boolean().optional(),
  legend: z.boolean().optional(),
  missing: z.enum(["null", "zero"]).optional(),
  seriesSeparator: z.string().optional(),
  format: FieldFormatSchema.optional(),
  sort: z.enum(["none", "asc", "desc"]).optional(),
});
export type Options = z.infer<typeof OptionsSchema>;

/* ---------- The spec + its conditional rules ---------- */

export const SpecSchema = z
  .object({
    id: z.string().min(1),
    chartType: ChartTypeSchema,
    title: z.string().optional(),
    subtitle: z.string().optional(),
    encoding: EncodingSchema,
    options: OptionsSchema.optional(),
  })
  .superRefine((spec, ctx) => {
    const has = (
      v: z.infer<typeof OptionalFieldSpecSchema>,
    ): boolean => v != null && (!Array.isArray(v) || v.length > 0);

    const needs = (cond: boolean, channel: string) => {
      if (cond) {
        ctx.addIssue({
          code: "custom",
          path: ["encoding", channel],
          message: `chartType "${spec.chartType}" requires encoding.${channel}`,
        });
      }
    };

    switch (spec.chartType) {
      case "line":
      case "area":
      case "bar":
      case "hbar":
      case "stackedBar":
      case "groupedBar":
        needs(!has(spec.encoding.x), "x");
        needs(!has(spec.encoding.y), "y");
        break;
      case "pie":
      case "donut":
        needs(!has(spec.encoding.value), "value");
        needs(!has(spec.encoding.label), "label");
        break;
      case "kpi":
        needs(!has(spec.encoding.y), "y");
        break;
      case "heatmap":
        needs(!has(spec.encoding.x), "x");
        needs(!has(spec.encoding.series), "series");
        needs(!has(spec.encoding.value), "value");
        break;
      case "table":
      case "scatter":
        // table needs nothing special; scatter uses x/y (numbers)
        break;
    }
  });
export type Spec = z.infer<typeof SpecSchema>;

/* ---------- Rows and the envelope ---------- */

export const RowSchema = z.record(z.string(), z.unknown());
export type Row = z.infer<typeof RowSchema>;

export const ContractErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ContractError = z.infer<typeof ContractErrorSchema>;

export const MetaSchema = z.object({
  rowCount: z.number(),
  truncated: z.boolean().optional(),
  generatedAt: z.string().optional(),
});
export type Meta = z.infer<typeof MetaSchema>;

export const EnvelopeSchema = z
  .object({
    contractVersion: z.literal(1),
    status: z.enum(["success", "empty", "error"]),
    spec: SpecSchema.nullable(),
    data: z.array(RowSchema),
    error: ContractErrorSchema.nullable(),
    meta: MetaSchema.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.status === "success" && env.spec == null) {
      ctx.addIssue({
        code: "custom",
        path: ["spec"],
        message: "status is 'success' but spec is null",
      });
    }
    if (env.status === "error" && env.error == null) {
      ctx.addIssue({
        code: "custom",
        path: ["error"],
        message: "status is 'error' but error is null",
      });
    }
  });
export type ContractEnvelope = z.infer<typeof EnvelopeSchema>;
```

**Line by line.**

- `import { z } from "zod"` — pulls in Zod. `z` is the namespace where every
  schema helper lives.
- `z.enum([...])` — creates a schema that accepts *only* those exact strings. It
  is how we prevent typos like `"piechart"`.
- `z.infer<typeof X>` — a *type-level* trick. It reads the schema `X` and
  produces the matching TypeScript type. So `FieldType` becomes
  `"number" | "category" | "date"`. Write the shape once, get two things.
- `z.object({ ... })` — an object schema. Each key is a rule for that key.
- `z.string().min(1, "…")` — a string that is at least 1 character; the second
  argument is the error message shown when it is too short.
- `.optional()` — the key may be absent or `undefined`.
- `.nullish()` — shorthand for "may be `null` or absent."
- `z.union([A, B])` — accepts a value matching **either** A or B. We use it for
  "one field or an array of fields."
- `z.array(S).min(1)` — an array of at least one element, each matching `S`.
- `z.record(z.string(), z.unknown())` — a plain object with string keys and
  *any* values. This is a data row, since columns vary per query.
- `z.literal(1)` — accepts exactly the number `1`. Used to pin the contract
  version.
- `.superRefine((value, ctx) => …)` — attaches custom logic after the basic
  checks. `ctx.addIssue({ code: "custom", path, message })` records a failure
  that makes parsing fail with a helpful message. We use it for the per-chart
  channel requirements and for envelope consistency.
- In the `superRefine` for `SpecSchema`, the tiny `has` helper normalizes a
  channel (which may be a single object, an array, `null`, or absent) into a
  boolean "is there something useful here?", and `needs` records an issue only
  when a required channel is missing.

**How it connects.** Every other engine file imports its types from here.
`validate.ts` uses the schemas; `adapter/*` uses the types; `components/*` uses
`Spec` and `Row`. Change a channel name in this file and TypeScript will point
at every place that must follow.

## 11. `src/engine/contract/index.ts`

**In plain words.** A tiny convenience file that forwards everything from
`spec.ts`, so other files can write `from "../contract"` instead of
`from "../contract/spec"`.

```ts
export * from "./spec";
```

**Why it exists.** Shorter, stable import paths. If we later split the contract
into several files, callers do not change.

**Line by line.** `export *` re-exports every named export from `spec.ts`.

**How it connects.** It is the public door to the contract folder.

## 12. `src/engine/validate.ts`

**In plain words.** This is station 1 and 3 of the pipeline. It checks the
envelope's shape, and separately checks that the columns named in the spec really
exist in the data.

**Why it exists.** So invalid input becomes a typed, friendly result instead of a
crash, and so chart components can trust their inputs.

```ts
import { EnvelopeSchema, type ContractEnvelope, type Spec, type Row } from "./contract";
import { type ZodError } from "zod";

export type ValidationResult =
  | { ok: true; envelope: ContractEnvelope }
  | { ok: false; code: string; message: string; issues: string[] };

/** Turn a ZodError into flat, readable strings. */
function formatIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/** Station 1: is the whole envelope structurally valid? */
export function validateEnvelope(input: unknown): ValidationResult {
  const parsed = EnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_ENVELOPE",
      message: "The response did not match the chart contract.",
      issues: formatIssues(parsed.error),
    };
  }
  return { ok: true, envelope: parsed.data };
}

/** Read every field name a spec asks for. */
function encodedFields(spec: Spec): string[] {
  const fields = new Set<string>();
  const channels = [
    spec.encoding.x,
    spec.encoding.y,
    spec.encoding.series,
    spec.encoding.value,
    spec.encoding.label,
  ];
  for (const channel of channels) {
    if (channel == null) continue;
    const list = Array.isArray(channel) ? channel : [channel];
    for (const f of list) fields.add(f.field);
  }
  return [...fields];
}

export type CrossCheckResult =
  | { ok: true }
  | { ok: false; code: string; message: string; issues: string[] };

/** Station 3: does every encoded field exist as a key in the rows? */
export function crossValidate(spec: Spec, data: Row[]): CrossCheckResult {
  if (data.length === 0) return { ok: true };

  const missing = encodedFields(spec).filter(
    (field) => !(field in data[0]),
  );

  if (missing.length > 0) {
    return {
      ok: false,
      code: "MISSING_FIELDS",
      message: "The spec references columns that are not in the data.",
      issues: missing.map((f) => `field "${f}" not found in data rows`),
    };
  }
  return { ok: true };
}
```

**Line by line.**

- `import { type ZodError }` — we only need Zod's *type*, so `type`-only import
  keeps the bundle smaller.
- `export type ValidationResult = { ok: true; … } | { ok: false; … }` — a
  **discriminated union**. The `ok` field is the discriminator. After
  `if (!result.ok)`, TypeScript *knows* `result.issues` exists. This is how we
  model "success or failure" without exceptions.
- `error.issues.map((issue) => …)` — `.map` builds a new array by transforming
  each element; here each Zod issue becomes a string. `issue.path` is an array
  like `["encoding","y"]`, and `.join(".")` makes it `"encoding.y"`.
- `EnvelopeSchema.safeParse(input)` — validates without throwing.
- `formatIssues` collects all problems, so one bad response can report several
  issues at once instead of stopping at the first.
- `encodedFields` walks all five channels, accepts each being a single object or
  an array, and collects the `field` names into a `Set` (which removes
  duplicates).
- `field in data[0]` — the JavaScript `in` operator checks whether a key exists
  on an object. We test against the first row, which is enough because the
  contract guarantees every row has the same keys.

**How it connects.** `ChartRenderer` calls `validateEnvelope` first and
`crossValidate` third. Either failure becomes an `ErrorCard` with the `issues`
list.

## 13. `src/engine/adapter/format.ts`

**In plain words.** A one-function helper that turns a raw number into the
display string the user should see: `12345` becomes `$12,345` or `12.3K`.

**Why it exists.** Formatting is *presentation*, not data. It should not change
the numbers, only how they read. Keeping it in one place means the axis and the
tooltip always agree.

```ts
import type { FieldFormat } from "../contract";

const DEFAULT_LOCALE = "en-US";

export function formatValue(
  value: unknown,
  format: FieldFormat = "number",
): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");

  switch (format) {
    case "currency":
      return new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);
    case "percent":
      return `${new Intl.NumberFormat(DEFAULT_LOCALE, {
        maximumFractionDigits: 1,
      }).format(n)}%`;
    case "compact":
      return new Intl.NumberFormat(DEFAULT_LOCALE, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
    case "number":
    default:
      return new Intl.NumberFormat(DEFAULT_LOCALE).format(n);
  }
}
```

**Line by line.**

- `Number.isFinite(n)` — returns `false` for `NaN`, `Infinity`, or a failed
  conversion. If the value is not a usable number we fall back to its text,
  which keeps gaps and weird values from throwing.
- `Intl.NumberFormat` — the browser's built-in number formatter. It knows locale
  rules (thousands separators, currency symbols) so we do not hand-roll them.
- `notation: "compact"` — produces `12.3K`, `1.2M`, etc.
- `switch` with a `default` — guarantees we always return a string even for an
  unexpected format.

**How it connects.** `toEChartsOption` uses it to build axis labels and
tooltips.

## 14. `src/engine/adapter/reshape.ts`

**In plain words.** The pivot. It takes the long rows from the backend and the
spec, and produces the tidy `{ categories, series }` structure every chart needs.
This is the exact algorithm traced in section 8.

**Why it exists.** Chart libraries want wide arrays; the contract promises long
rows. Somebody has to bridge that gap, and it must be pure (no React, no DOM) so
it is easy to test.

```ts
import type { FieldFormat, FieldSpec, FieldType, Row, Spec } from "../contract";

/** Normalize "one thing or many" into an array. */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Safely turn any cell into a number (or null for gaps). */
export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface ReshapedSeries {
  name: string;
  values: (number | null)[];
  field: string;
  type?: FieldType;
  format?: FieldFormat;
}

export interface ReshapedData {
  categories: string[];
  series: ReshapedSeries[];
}

const SEP = " \u2014 "; // an em dash with spaces

/** Combine a duplicate value according to an optional aggregate. */
function combine(
  current: number | null,
  next: number | null,
  aggregate: FieldSpec["aggregate"],
): number | null {
  if (next == null) return current;
  if (current == null) return next;
  switch (aggregate) {
    case "sum":   return current + next;
    case "avg":   return (current + next) / 2;
    case "min":   return Math.min(current, next);
    case "max":   return Math.max(current, next);
    case "count": return current + 1;
    default:      return next; // backend already aggregated -> last wins
  }
}

/**
 * Cartesian reshape for line / area / bar family.
 * Groups rows by x-category, splits into one series per measure (x) series combo.
 */
export function buildCartesian(spec: Spec, data: Row[]): ReshapedData {
  const options = spec.options ?? {};
  const separator = options.seriesSeparator ?? SEP;

  const xSpec = asArray(spec.encoding.x)[0];
  const ySpecs = asArray(spec.encoding.y);
  const seriesSpecs = asArray(spec.encoding.series);

  /* Station 1: categories in first-seen order. */
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const key = xSpec ? String(row[xSpec.field] ?? "") : "";
    if (!seen.has(key)) {
      seen.add(key);
      categories.push(key);
    }
  }
  if (options.sort === "asc") categories.sort();
  else if (options.sort === "desc") categories.sort().reverse();

  const catIndex = new Map(categories.map((c, i) => [c, i]));

  /* Stations 2-3: build and fill series lazily. */
  const lookup = new Map<string, ReshapedSeries>();
  const ordered: ReshapedSeries[] = [];

  const getSeries = (key: string, name: string, field: string, ys: FieldSpec) => {
    let s = lookup.get(key);
    if (!s) {
      s = {
        name,
        field,
        type: ys.type,
        format: ys.format,
        values: new Array(categories.length).fill(null),
      };
      lookup.set(key, s);
      ordered.push(s);
    }
    return s;
  };

  for (const row of data) {
    const xIndex = xSpec ? catIndex.get(String(row[xSpec.field] ?? "")) : 0;
    if (xIndex == null) continue;

    const comboParts = seriesSpecs.map((s) => String(row[s.field] ?? ""));

    for (const ys of ySpecs) {
      const value = toNumber(row[ys.field]);

      let name: string;
      let key: string;

      if (seriesSpecs.length === 0) {
        name = ys.title ?? ys.field;
        key = `${ys.field}`;
      } else {
        const combo = comboParts.join(separator);
        name = ySpecs.length > 1 ? `${ys.title ?? ys.field}${separator}${combo}` : combo;
        key = `${ys.field}::${comboParts.join("|")}`;
      }

      const series = getSeries(key, name, ys.field, ys);
      series.values[xIndex] = combine(series.values[xIndex], value, ys.aggregate);
    }
  }

  return { categories, series: ordered };
}

/** Categorical reshape for pie / donut: label -> value. */
export interface CategoricalDatum {
  name: string;
  value: number;
}

export function buildCategorical(spec: Spec, data: Row[]): CategoricalDatum[] {
  const labelSpec = asArray(spec.encoding.label)[0];
  const valueSpec = asArray(spec.encoding.value)[0];
  if (!labelSpec || !valueSpec) return [];

  return data.map((row) => ({
    name: String(row[labelSpec.field] ?? ""),
    value: toNumber(row[valueSpec.field]) ?? 0,
  }));
}
```

**Line by line.**

- `asArray` — collapses "one or many" into a plain array. This is the helper that
  makes `y` and `series` able to be either a single object or a list, everywhere
  in the adapter.
- `toNumber` — converts a cell to a number, returning `null` for gaps. Returning
  `null` (not `0`) is deliberate: it preserves the honesty rule.
- `ReshapedSeries` / `ReshapedData` — `interface`s describing the adapter's
  output. An `interface` describes the *shape* of an object; unlike `type` it can
  be extended later. Both are fine here.
- `const SEP = " \u2014 "` — the Unicode escape `\u2014` is an em dash. We
  default the separator between grouped values to it.
- `combine(current, next, aggregate)` — the only place arithmetic happens, and
  only if the spec explicitly sets an `aggregate`. With no aggregate (the normal
  case), the backend already summed, so we let the last value win.
- `buildCartesian` — station 1 fills `categories` in first-seen order (optionally
  sorted); `catIndex` maps a category back to its slot for O(1) filling.
- `getSeries(key, …)` — lazily creates a series the first time a
  measure×series-combination is seen, and reuses it afterwards. `lazy` means we
  do not need to know all series up front — we discover them from the rows.
- `new Array(n).fill(null)` — creates an array of `n` gaps, ready to be filled.
- `series.values[xIndex] = combine(...)` — places (or merges) the value in the
  slot for this category.
- `buildCategorical` — the pie/donut version: one `{ name, value }` per row,
  using `label` for the name and `value` for the magnitude.

**How it connects.** `toEChartsOption` calls `buildCartesian` for the
line/bar family and `buildCategorical` for pie/donut. It never touches React.

## 15. `src/engine/adapter/toEChartsOption.ts`

**In plain words.** The translator. It takes the tidy structure from `reshape`
and produces the exact object ECharts expects, honoring the spec's look-and-feel
options (stacked, smooth, horizontal, legend).

**Why it exists.** So all the chart-library-specific detail lives in one file. If
we ever changed libraries, this is the only file that would need rewriting.

```ts
import type { EChartsOption } from "echarts";
import type { Row, Spec, FieldSpec } from "../contract";
import { asArray, buildCartesian, buildCategorical } from "./reshape";
import { formatValue } from "./format";

export function toEChartsOption(spec: Spec, data: Row[]): EChartsOption {
  switch (spec.chartType) {
    case "pie":
    case "donut":
      return buildPieOption(spec, data);
    case "scatter":
      return buildScatterOption(spec, data);
    default:
      return buildCartesianOption(spec, data);
  }
}

function axisTitle(field?: FieldSpec): string | undefined {
  return field?.title ?? field?.field;
}

function buildCartesianOption(spec: Spec, data: Row[]): EChartsOption {
  const { categories, series } = buildCartesian(spec, data);
  const options = spec.options ?? {};
  const horizontal = options.horizontal ?? false;

  const isArea = spec.chartType === "area";
  const isBar = ["bar", "hbar", "stackedBar", "groupedBar"].includes(spec.chartType);
  const stack = options.stacked || spec.chartType === "stackedBar" ? "total" : undefined;

  const xSpec = asArray(spec.encoding.x)[0];
  const ySpecs = asArray(spec.encoding.y);

  const categoryAxis = {
    type: "category" as const,
    data: categories,
    name: horizontal ? axisTitle(ySpecs[0]) : axisTitle(xSpec),
  };
  const valueAxis = {
    type: "value" as const,
    name: horizontal ? axisTitle(xSpec) : axisTitle(ySpecs[0]),
    axisLabel: {
      formatter: (value: number) =>
        formatValue(value, ySpecs[0]?.format ?? "number"),
    },
  };

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) =>
        formatValue(value, ySpecs[0]?.format ?? "number"),
    },
    legend: { show: options.legend ?? true, top: 24 },
    grid: { left: 48, right: 24, bottom: 40, top: 64, containLabel: true },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: series.map((s) => ({
      name: s.name,
      type: isBar ? "bar" : "line",
      data: s.values,
      stack,
      smooth: !isBar && (options.smooth ?? isArea),
      connectNulls: false,
      areaStyle: isArea ? {} : undefined,
    })),
  };
}

function buildPieOption(spec: Spec, data: Row[]): EChartsOption {
  const items = buildCategorical(spec, data);
  const isDonut = spec.chartType === "donut";
  const valueSpec = asArray(spec.encoding.value)[0];
  const options = spec.options ?? {};

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "item",
      valueFormatter: (value) =>
        formatValue(value, (valueSpec?.format ?? options.format ?? "number")),
    },
    legend: { show: options.legend ?? true, bottom: 0 },
    series: [
      {
        type: "pie",
        radius: isDonut ? ["40%", "70%"] : "70%",
        data: items,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" },
        },
      },
    ],
  };
}

function buildScatterOption(spec: Spec, data: Row[]): EChartsOption {
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpec = asArray(spec.encoding.y)[0];
  const seriesSpec = asArray(spec.encoding.series)[0];

  if (!xSpec || !ySpec) return { series: [] };

  if (seriesSpec) {
    const groups = new Map<string, [number, number][]>();
    for (const row of data) {
      const key = String(row[seriesSpec.field] ?? "");
      const point: [number, number] = [
        Number(row[xSpec.field]),
        Number(row[ySpec.field]),
      ];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(point);
    }
    return {
      title: { text: spec.title },
      tooltip: { trigger: "item" },
      legend: { top: 24 },
      xAxis: { type: "value", name: axisTitle(xSpec) },
      yAxis: { type: "value", name: axisTitle(ySpec) },
      series: [...groups.entries()].map(([name, points]) => ({
        name,
        type: "scatter" as const,
        data: points,
      })),
    };
  }

  return {
    title: { text: spec.title },
    tooltip: { trigger: "item" },
    xAxis: { type: "value", name: axisTitle(xSpec) },
    yAxis: { type: "value", name: axisTitle(ySpec) },
    series: [
      {
        type: "scatter",
        data: data.map((row) => [Number(row[xSpec.field]), Number(row[ySpec.field])]),
      },
    ],
  };
}
```

**Line by line.**

- `import type { EChartsOption } from "echarts"` — ECharts ships TypeScript
  types. Using the official `EChartsOption` type means our returned object is
  checked against what ECharts accepts. `type`-only import avoids runtime cost.
- `switch (spec.chartType)` — dispatch. Pie/donut and scatter get dedicated
  builders; everything else (line/area/bar family) shares `buildCartesianOption`.
- `"category" as const` — tells TypeScript "this string is the literal
  `"category"`, not just any string," which is required for ECharts' axis types.
- `horizontal ? valueAxis : categoryAxis` — for a horizontal bar we *swap* which
  axis is categorical and which is numeric. That one swap rotates the chart.
- `stack` — set to `"total"` when the spec opts in; ECharts then stacks bars or
  lines that share the same `stack` name.
- `connectNulls: false` — keeps gaps as gaps, honoring the missing-data rule.
- `valueFormatter` and `axisLabel.formatter` — use `formatValue` so the tooltip
  and axis display currency/percent/compact consistently.
- `buildScatterOption` groups points by the series field (if any) using a `Map`,
  and `groups.get(key)!.push(point)` uses the non-null assertion `!` because we
  just created the key. Scatter is a stretch feature but included for
  completeness.

**How it connects.** The registry's ECharts component calls
`toEChartsOption(spec, data)` and feeds the result to the `EChart` wrapper.

## 16. `src/engine/adapter/index.ts`

**In plain words.** The public door to the adapter folder.

```ts
export { toEChartsOption } from "./toEChartsOption";
export {
  asArray,
  toNumber,
  buildCartesian,
  buildCategorical,
} from "./reshape";
export type { ReshapedData, ReshapedSeries, CategoricalDatum } from "./reshape";
export { formatValue } from "./format";
```

**Why it exists.** Keeps imports short and stable.

**How it connects.** Components import from `"../adapter"`.

---

---

## 17. `src/engine/components/states/LoadingState.tsx`

**In plain words.** A placeholder shown while we wait for the (mock) backend.

```tsx
export function LoadingState() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center text-slate-500">
      <span className="animate-pulse">Loading chart…</span>
    </div>
  );
}
```

**Line by line.** This JSX returns a centred grey box with a pulsing
"Loading chart…" label. Tailwind classes (`flex`, `min-h-64`, `animate-pulse`)
do the styling; there is no logic at all.

**How it connects.** The screen shows it while the `await` in
`fetchVisualization` is pending.

## 18. `src/engine/components/states/EmptyState.tsx`

**In plain words.** Shown when `status === "empty"` or the data list is empty.

```tsx
export function EmptyState({ message = "No data for this question." }: { message?: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-slate-500">
      <span className="text-3xl">∅</span>
      <span>{message}</span>
    </div>
  );
}
```

**Line by line.** `{ message = "…" }` is destructuring with a **default value**:
if the caller omits `message`, the default is used. `?:` in the type marks it
optional.

**How it connects.** `ChartRenderer` uses it for the empty status. An empty
result is a success state, not an error — it gets a calm card.

## 19. `src/engine/components/states/ErrorCard.tsx`

**In plain words.** A friendly card that explains what went wrong, with the list
of specific problems. Used for bad contracts, error statuses, missing fields, and
unknown chart types.

```tsx
export interface ErrorCardProps {
  title?: string;
  message: string;
  issues?: string[];
}

export function ErrorCard({
  title = "Could not render chart",
  message,
  issues = [],
}: ErrorCardProps) {
  return (
    <div className="flex h-full min-h-64 flex-col justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
      <strong className="text-lg">{title}</strong>
      <p>{message}</p>
      {issues.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-red-700">
          {issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Line by line.**

- `interface ErrorCardProps` — the shape of the props this component accepts.
- `issues = []` — default so we can call `.length` and `.map` safely.
- `{issues.length > 0 && ( … )}` — **conditional rendering**. If the left side is
  false, React renders nothing. This is the idiomatic way to show/hide JSX.
- `issues.map((issue, i) => <li key={i}>…)` — builds one `<li>` per issue. React
  needs a stable `key` per list item; using the index is acceptable for a short,
  static list.

**How it connects.** `ChartRenderer` renders it on every failure path, passing
the `issues` array produced by `validate.ts`.

## 20. `src/engine/components/dom/KpiCard.tsx`

**In plain words.** A KPI (key performance indicator) is a single big number with
a label. It needs no chart library at all — plain HTML is best.

**Why it exists.** Not every answer is a chart. Using ECharts for one number
would be wasteful and inflexible; a DOM component is simpler, faster, and easier
to style.

```tsx
import type { Row, Spec } from "../../contract";
import { asArray, formatValue, toNumber } from "../../adapter";

export interface KpiCardProps {
  spec: Spec;
  data: Row[];
}

export function KpiCard({ spec, data }: KpiCardProps) {
  const ySpec = asArray(spec.encoding.y)[0];
  const firstRow = data[0] ?? {};
  const raw = ySpec ? firstRow[ySpec.field] : undefined;
  const value = ySpec ? toNumber(raw) : null;

  const display =
    value == null
      ? "—"
      : formatValue(value, ySpec?.format ?? spec.options?.format ?? "number");

  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-6">
      <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
        {spec.title ?? ySpec?.title ?? ySpec?.field ?? "KPI"}
      </span>
      <span className="text-5xl font-bold text-slate-800">{display}</span>
    </div>
  );
}
```

**Line by line.**

- `asArray(spec.encoding.y)[0]` — normalize and take the first measure.
- `data[0] ?? {}` — the nullish coalescing operator `??` returns the right side
  when the left is `null`/`undefined`. If there are no rows, we use an empty
  object so lookups do not throw.
- The `display` chain reads top-to-bottom: if there is no number show an em dash;
  otherwise format it. The `??` chain picks the first available format.
- The JSX lays out a caption above a big number.

**How it connects.** The registry maps `"kpi"` to this component.

## 21. `src/engine/components/dom/DataTable.tsx`

**In plain words.** A plain HTML table for the raw rows, used for `chartType:
"table"`.

```tsx
import type { Row, Spec } from "../../contract";
import { asArray } from "../../adapter";
import { formatValue } from "../../adapter";

export interface DataTableProps {
  spec: Spec;
  data: Row[];
}

/** Collect the column keys the spec cares about, in a sensible order. */
function columnsFor(spec: Spec, data: Row[]): string[] {
  const encoded = [
    ...asArray(spec.encoding.x),
    ...asArray(spec.encoding.y),
    ...asArray(spec.encoding.series),
    ...asArray(spec.encoding.value),
    ...asArray(spec.encoding.label),
  ].map((f) => f.field);

  if (encoded.length > 0) return [...new Set(encoded)];
  return data.length > 0 ? Object.keys(data[0]) : [];
}

export function DataTable({ spec, data }: DataTableProps) {
  const columns = columnsFor(spec, data);

  return (
    <div className="h-full min-h-64 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-100 text-slate-600">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 font-semibold">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2">
                  {typeof row[col] === "number"
                    ? formatValue(row[col], spec.options?.format ?? "number")
                    : String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Line by line.**

- `columnsFor` — prefers the fields the spec explicitly encodes; if none, falls
  back to whatever keys the first row has. `[...new Set(...)]` deduplicates while
  preserving order.
- `Object.keys(data[0])` — the list of a row's column names.
- The two nested `.map`s build header cells and body cells. Number cells are
  formatted; everything else is shown as text.
- `sticky top-0` — the header stays visible while scrolling a long table.

**How it connects.** The registry maps `"table"` to this component. It reads
`spec` and `data` exactly like the ECharts component does, so the registry can
treat all components uniformly.

## 22. `src/engine/components/EChart.tsx`

**In plain words.** A thin wrapper around ECharts that handles its lifecycle: it
creates the chart when the component appears, updates it when the `option`
changes, resizes it when the window changes, and destroys it when the component
leaves. This is the *only* file that talks to ECharts directly.

**Why it exists.** ECharts is a plain JavaScript library, not a React component.
It needs manual create/update/destroy. Wrapping it once keeps that boilerplate
out of every chart.

```tsx
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export interface EChartProps {
  option: EChartsOption;
  height?: number;
}

export function EChart({ option, height = 320 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Create once, destroy on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update whenever the option changes.
  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
```

**Line by line.**

- `useRef<HTMLDivElement>(null)` — a ref is a box that survives re-renders and
  can hold a DOM node or a value without causing a re-render. `containerRef`
  holds the `<div>`; `chartRef` holds the ECharts instance.
- `useEffect(() => { … }, [])` — runs the code **once after the first render**.
  The empty dependency array `[]` is the "run once" signal.
- `echarts.init(node)` — creates a chart bound to that DOM node.
- `new ResizeObserver(() => chart.resize())` — watches the element's size and
  tells ECharts to redraw when it changes. Without this, charts break on window
  resize.
- The `return () => { … }` inside the effect is **cleanup**, run when the
  component unmounts. We disconnect the observer and `dispose()` the chart so we
  do not leak memory.
- `useEffect(() => { chartRef.current?.setOption(option, true); }, [option])` —
  runs whenever `option` changes. The `?.` is **optional chaining**: if
  `chartRef.current` is null, do nothing instead of crashing. The `true` tells
  ECharts to *replace* rather than merge, which avoids stale series hanging
  around.
- The `<div>` is the mount point; `height` defaults to 320 pixels.

**How it connects.** The registry's ECharts component builds an `option` via
`toEChartsOption` and renders `<EChart option={option} />`.

## 23. `src/engine/registry/chartRegistry.tsx`

**In plain words.** A lookup table from the `chartType` string to the React
component that draws it. This is what makes the engine *config-driven*: to add a
chart type, you add one line here.

**Why it exists.** Without it, a giant `if/else` chain would grow in the
renderer. A table is declarative and easy to read.

```tsx
import type { ReactElement } from "react";
import type { Row, Spec, ChartType } from "../contract";
import { toEChartsOption } from "../adapter";
import { EChart } from "../components/EChart";
import { KpiCard } from "../components/dom/KpiCard";
import { DataTable } from "../components/dom/DataTable";

export interface ChartComponentProps {
  spec: Spec;
  data: Row[];
}

export type ChartComponent = (props: ChartComponentProps) => ReactElement;

/** Every ECharts-backed type shares this component. */
const EChartsChart: ChartComponent = ({ spec, data }) => (
  <EChart option={toEChartsOption(spec, data)} />
);

export const chartRegistry: Record<ChartType, ChartComponent> = {
  line: EChartsChart,
  area: EChartsChart,
  bar: EChartsChart,
  hbar: EChartsChart,
  stackedBar: EChartsChart,
  groupedBar: EChartsChart,
  scatter: EChartsChart,
  heatmap: EChartsChart,
  pie: EChartsChart,
  donut: EChartsChart,
  kpi: KpiCard,
  table: DataTable,
};

export function getChartComponent(type: ChartType): ChartComponent | undefined {
  return chartRegistry[type];
}
```

**Line by line.**

- `ReactElement` — the type of a rendered React element (what a component
  returns).
- `Record<ChartType, ChartComponent>` — a TypeScript **mapped type** meaning "an
  object with a key for *every* value of `ChartType`." This is a small
  superpower: if you add a new chart type to the enum and forget to add it here,
  TypeScript reports an error. The table can never silently miss a type.
- `EChartsChart` — one component used by all ECharts-backed types. It ignores the
  differences between them because `toEChartsOption` already branched on
  `chartType`.
- `getChartComponent` — a safe accessor returning `undefined` for an unknown
  type (useful if a future contract adds a type before the code does).

**How it connects.** `ChartRenderer` calls `getChartComponent(spec.chartType)`,
then renders the returned component with `{ spec, data }`.

## 24. `src/engine/components/ChartRenderer.tsx`

**In plain words.** The engine's front door. You hand it a raw envelope and it
runs the whole pipeline: validate → route status → cross-check fields → look up
a component → render. It is the only thing the screens need to know about.

```tsx
import { useMemo } from "react";
import type { Spec, Row } from "../contract";
import { crossValidate, validateEnvelope } from "../validate";
import { getChartComponent } from "../registry/chartRegistry";
import { ErrorCard } from "./states/ErrorCard";
import { EmptyState } from "./states/EmptyState";

export interface ChartRendererProps {
  /** The raw, unknown response (typed as unknown on purpose). */
  response: unknown;
}

export function ChartRenderer({ response }: ChartRendererProps) {
  // Station 1: validate the shape. Memoized so we only re-run when response changes.
  const result = useMemo(() => validateEnvelope(response), [response]);

  if (!result.ok) {
    return (
      <ErrorCard
        title="Invalid response"
        message={result.message}
        issues={result.issues}
      />
    );
  }

  const envelope = result.envelope;

  // Station 2: route on status.
  if (envelope.status === "error") {
    return (
      <ErrorCard
        title="Query failed"
        message={envelope.error?.message ?? "Unknown error"}
        issues={envelope.error?.code ? [`code: ${envelope.error.code}`] : []}
      />
    );
  }

  if (envelope.status === "empty" || envelope.data.length === 0) {
    return <EmptyState />;
  }

  if (!envelope.spec) {
    return <ErrorCard message="Response is missing its chart spec." />;
  }

  // Station 3: cross-check spec against data.
  const cross = crossValidate(envelope.spec, envelope.data);
  if (!cross.ok) {
    return (
      <ErrorCard title={cross.message} message="Field mismatch" issues={cross.issues} />
    );
  }

  // Station 4: find the component.
  const Component = getChartComponent(envelope.spec.chartType);
  if (!Component) {
    return (
      <ErrorCard
        message={`Unsupported chart type "${envelope.spec.chartType}".`}
      />
    );
  }

  // Station 5-6: hand off to the component (which adapts + draws).
  return (
    <div className="h-full w-full">
      <Component spec={envelope.spec} data={envelope.data} />
    </div>
  );
}
```

**Line by line.**

- `response: unknown` — deliberately `unknown`, not `any`. `unknown` forces us to
  validate before use; `any` would let bugs through silently.
- `useMemo(() => validateEnvelope(response), [response])` — `useMemo` caches the
  result of a computation and recomputes only when `response` changes. Validation
  is cheap here, but caching keeps identity stable and avoids repeated work.
- Each `if` is a **guard clause** returning early. This reads like the pipeline
  diagram top-to-bottom.
- `envelope.error?.message ?? "Unknown error"` — optional chaining then a
  fallback, so a missing error object still renders something sensible.
- The final `return` renders the looked-up component with `spec` and `data`.

**How it connects.** The Agent and Dashboard screens render `<ChartRenderer
response={…} />` and nothing else. All engine complexity is hidden behind this
one prop.

---

---

# Part III (continued) — Simulating the backend

The last three code areas (`data/` and `lib/`) are the **fake backend** that lets
you run the engine today. They are isolated on purpose: when the real backend
exists, you delete `data/` and swap one function in `lib/`.

## 25. `src/data/fixtures/index.ts`

**In plain words.** The example datasets and their specs. Each fixture represents
one question, together with the columns, the rows, and the chart spec that
answers it — exactly what the backend and agent *would* produce separately.

**Why it exists.** So we can prove the engine on realistic data with zero
infrastructure, and so each example question in the brief has a ready payload.

```ts
import type { Spec, Row, FieldType } from "../../engine/contract";

export interface ColumnDef {
  name: string;
  type: FieldType;
}

export interface Fixture {
  id: string;
  question: string;
  keywords: string[];
  columns: ColumnDef[];
  rows: Row[];
  spec: Spec;
  /** Special cases for demoing empty/error states. */
  forceStatus?: "empty" | "error";
}

/* ---------- The eight rows traced in section 8 ---------- */
const modesByRegionRows: Row[] = [
  { region: "Central", shipping_mode: "Air", year: "2022", order_count: 120 },
  { region: "Central", shipping_mode: "Sea", year: "2022", order_count: 80 },
  { region: "Central", shipping_mode: "Air", year: "2023", order_count: 150 },
  { region: "Central", shipping_mode: "Sea", year: "2023", order_count: 95 },
  { region: "North", shipping_mode: "Air", year: "2022", order_count: 90 },
  { region: "North", shipping_mode: "Sea", year: "2022", order_count: 60 },
  { region: "North", shipping_mode: "Air", year: "2023", order_count: 110 },
  { region: "North", shipping_mode: "Sea", year: "2023", order_count: 70 },
];

export const fixtures: Fixture[] = [
  {
    id: "sales-vs-profit",
    question: "Compare sales and profit across regions",
    keywords: ["sales", "profit", "compare"],
    columns: [
      { name: "region", type: "category" },
      { name: "total_sales", type: "number" },
      { name: "total_profit", type: "number" },
    ],
    rows: [
      { region: "Central", total_sales: 120000, total_profit: 18000 },
      { region: "North", total_sales: 90000, total_profit: 12000 },
      { region: "South", total_sales: 70000, total_profit: 9000 },
      { region: "East", total_sales: 110000, total_profit: 21000 },
    ],
    spec: {
      id: "sales-vs-profit",
      chartType: "groupedBar",
      title: "Sales and Profit by Region",
      encoding: {
        x: { field: "region", type: "category", title: "Region" },
        y: [
          { field: "total_sales", type: "number", title: "Sales", format: "currency" },
          { field: "total_profit", type: "number", title: "Profit", format: "currency" },
        ],
      },
      options: { legend: true },
    },
  },
  {
    id: "modes-by-region",
    question: "Evolution of shipping modes by region",
    keywords: ["shipping", "modes", "region", "evolution"],
    columns: [
      { name: "region", type: "category" },
      { name: "shipping_mode", type: "category" },
      { name: "year", type: "category" },
      { name: "order_count", type: "number" },
    ],
    rows: modesByRegionRows,
    spec: {
      id: "modes-by-region",
      chartType: "line",
      title: "Evolution of Shipping Modes by Region",
      encoding: {
        x: { field: "year", type: "category", title: "Year" },
        y: [{ field: "order_count", type: "number", title: "Orders" }],
        series: [{ field: "region" }, { field: "shipping_mode" }],
      },
      options: { smooth: true, legend: true },
    },
  },
  {
    id: "sales-by-category",
    question: "Show total sales by category",
    keywords: ["sales", "category", "share", "pie"],
    columns: [
      { name: "category", type: "category" },
      { name: "total_sales", type: "number" },
    ],
    rows: [
      { category: "Furniture", total_sales: 320000 },
      { category: "Technology", total_sales: 480000 },
      { category: "Office Supplies", total_sales: 210000 },
      { category: "Clothing", total_sales: 150000 },
    ],
    spec: {
      id: "sales-by-category",
      chartType: "pie",
      title: "Sales Share by Category",
      encoding: {
        value: { field: "total_sales", type: "number", format: "currency" },
        label: { field: "category", type: "category", title: "Category" },
      },
      options: { legend: true },
    },
  },
  {
    id: "kpi-total-sales",
    question: "What is the total sales?",
    keywords: ["total", "sales", "kpi"],
    columns: [{ name: "total_sales", type: "number" }],
    rows: [{ total_sales: 1160000 }],
    spec: {
      id: "kpi-total-sales",
      chartType: "kpi",
      title: "Total Sales",
      encoding: {
        y: { field: "total_sales", type: "number", format: "currency" },
      },
    },
  },
  {
    id: "stacked-modes",
    question: "Shipping modes stacked by region",
    keywords: ["stacked", "shipping", "modes", "region"],
    columns: [
      { name: "region", type: "category" },
      { name: "shipping_mode", type: "category" },
      { name: "order_count", type: "number" },
    ],
    rows: [
      { region: "Central", shipping_mode: "Air", order_count: 120 },
      { region: "Central", shipping_mode: "Sea", order_count: 80 },
      { region: "Central", shipping_mode: "Rail", order_count: 40 },
      { region: "North", shipping_mode: "Air", order_count: 90 },
      { region: "North", shipping_mode: "Sea", order_count: 60 },
      { region: "North", shipping_mode: "Rail", order_count: 30 },
      { region: "South", shipping_mode: "Air", order_count: 70 },
      { region: "South", shipping_mode: "Sea", order_count: 50 },
      { region: "South", shipping_mode: "Rail", order_count: 25 },
    ],
    spec: {
      id: "stacked-modes",
      chartType: "stackedBar",
      title: "Shipping Modes by Region (stacked)",
      encoding: {
        x: { field: "region", type: "category", title: "Region" },
        y: [{ field: "order_count", type: "number", title: "Orders" }],
        series: [{ field: "shipping_mode" }],
      },
      options: { stacked: true, legend: true },
    },
  },
  {
    id: "empty-example",
    question: "Sales for a region with no data",
    keywords: ["empty", "none"],
    columns: [
      { name: "region", type: "category" },
      { name: "total_sales", type: "number" },
    ],
    rows: [],
    forceStatus: "empty",
    spec: {
      id: "empty-example",
      chartType: "bar",
      title: "Sales by Region",
      encoding: {
        x: { field: "region", type: "category", title: "Region" },
        y: [{ field: "total_sales", type: "number", title: "Sales", format: "currency" }],
      },
    },
  },
  {
    id: "backend-error",
    question: "A question that fails",
    keywords: ["break", "fail", "error"],
    columns: [],
    rows: [],
    forceStatus: "error",
    spec: {
      id: "backend-error",
      chartType: "bar",
      title: "Unavailable",
      encoding: {},
    },
  },
];

/** Match a free-text question to a fixture by keyword overlap. */
export function matchFixture(question: string): Fixture | undefined {
  const q = question.toLowerCase();
  let best: { fixture: Fixture; score: number } | undefined;

  for (const fixture of fixtures) {
    let score = 0;
    if (fixture.question.toLowerCase() === q) score += 100;
    for (const kw of fixture.keywords) if (q.includes(kw)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { fixture, score };
  }
  return best?.fixture;
}
```

**Line by line.**

- `ColumnDef` / `Fixture` — plain `interface`s describing the fake backend's
  output. `forceStatus` is used only to demo the empty/error cards.
- Each fixture bundles the three things the three producers would supply, so the
  client can hand them out separately (data from "backend", spec from "agent").
- `matchFixture` scores each fixture: an exact question match adds a big 100, and
  every keyword found in the typed question adds 1. It returns the best-scoring
  fixture. This is a stub for what the real LLM will do (understand the question
  and choose a spec).

**How it connects.** `mockBackend` reads `columns`/`rows`; `mockAgent` reads
`spec`; the client orchestrates them into an envelope.

## 26. `src/data/mockBackend.ts`

**In plain words.** The pretend backend. Given a fixture id, it returns the
columns and rows after a short delay, as if a network round-trip happened.

**Why it exists.** To exercise the real code path (including loading states) with
no server, and to be replaced by a one-line swap later.

```ts
import type { Row } from "../engine/contract";
import { fixtures, type ColumnDef } from "./fixtures";

export interface QueryResult {
  columns: ColumnDef[];
  rows: Row[];
}

const SIMULATED_LATENCY_MS = 450;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Stand-in for "run a query and return columns + rows". */
export async function mockBackendQuery(fixtureId: string): Promise<QueryResult> {
  const fixture = fixtures.find((f) => f.id === fixtureId);

  // Pretend the server was slow, so the loading state is visible.
  await delay(null, SIMULATED_LATENCY_MS);

  if (!fixture) {
    return { columns: [], rows: [] };
  }
  return { columns: fixture.columns, rows: fixture.rows };
}
```

**Line by line.**

- `delay` wraps a value in a `Promise` that resolves after `setTimeout`. This is
  how we fake latency.
- `async` marks the function as returning a `Promise`; `await delay(...)` pauses
  until it resolves. Because of this, callers can `await mockBackendQuery(...)`
  and the UI can show a spinner in between.
- It finds the fixture and returns its columns and rows. Note it never mentions
  chart types — exactly like a real backend.

**How it connects.** `visualizationClient` awaits it, then hands `rows` to the
envelope and `columns` to the mock agent.

## 27. `src/data/mockAgent.ts`

**In plain words.** The pretend agent/LLM. Given a fixture id and the available
columns, it returns the chart spec.

**Why it exists.** To keep the "agent chooses the chart" role separate from the
"backend provides data" role, so the seam is obvious in the code.

```ts
import type { Spec } from "../engine/contract";
import { fixtures, type ColumnDef } from "./fixtures";

const SIMULATED_LATENCY_MS = 150;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Stand-in for "the LLM reads the columns and proposes a chart spec".
 * A real agent would look at `columns` and write a spec; here we look it up.
 */
export async function mockAgentSpec(
  fixtureId: string,
  columns: ColumnDef[],
): Promise<Spec | null> {
  await delay(null, SIMULATED_LATENCY_MS);
  void columns; // a real agent would use these; kept for signature parity
  const fixture = fixtures.find((f) => f.id === fixtureId);
  return fixture ? fixture.spec : null;
}
```

**Line by line.**

- The `columns` parameter exists so the signature matches what a real agent would
  receive; `void columns` tells the linter "we know it is unused here."
- It simply returns the fixture's spec (or `null` if unknown).

**How it connects.** `visualizationClient` combines the agent's spec with the
backend's rows.

## 28. `src/lib/visualizationClient.ts` — the swappable seam

**In plain words.** The single function the whole app calls to go from a question
to a renderable envelope. Right now it wires the mocks together. Later it will
call the real services, and nothing else changes.

**Why it exists.** To make "simulate the backend" the *default path*, not a hack.
Mock and real implementations satisfy the same signature, so swapping is a
one-line change.

```ts
import type { ContractEnvelope, ContractError } from "../engine/contract";
import { matchFixture } from "../data/fixtures";
import { mockBackendQuery } from "../data/mockBackend";
import { mockAgentSpec } from "../data/mockAgent";

/** Flip to false when the real services are ready. */
export const USE_MOCK = true;

export interface VisualizationRequest {
  question: string;
}

function errorEnvelope(code: string, message: string): ContractEnvelope {
  return {
    contractVersion: 1,
    status: "error",
    spec: null,
    data: [],
    error: { code, message } satisfies ContractError,
    meta: { rowCount: 0 },
  };
}

/**
 * The one entry point the UI uses.
 * Today: mock backend + mock agent.
 * Tomorrow: real HTTP calls, same return type.
 */
export async function fetchVisualization(
  request: VisualizationRequest,
): Promise<ContractEnvelope> {
  if (!USE_MOCK) {
    return realFetchVisualization(request);
  }

  const fixture = matchFixture(request.question);
  if (!fixture) {
    return errorEnvelope(
      "NO_MATCH",
      `No example matches "${request.question}". Try one of the suggested questions.`,
    );
  }

  if (fixture.forceStatus === "error") {
    return errorEnvelope("BACKEND_ERROR", "The query failed on the server.");
  }

  // Producer 1: the backend returns columns + rows.
  const { columns, rows } = await mockBackendQuery(fixture.id);

  // Producer 2: the agent returns the spec.
  const spec = await mockAgentSpec(fixture.id, columns);

  if (fixture.forceStatus === "empty" || rows.length === 0) {
    return {
      contractVersion: 1,
      status: "empty",
      spec,
      data: rows,
      error: null,
      meta: { rowCount: 0 },
    };
  }

  if (!spec) {
    return errorEnvelope("NO_SPEC", "No chart spec could be produced.");
  }

  // Producer 3: the orchestrator glues them into one envelope.
  return {
    contractVersion: 1,
    status: "success",
    spec,
    data: rows,
    error: null,
    meta: {
      rowCount: rows.length,
      truncated: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * The real implementation, ready to fill in later.
 * It must return a ContractEnvelope — ideally validated before returning.
 */
async function realFetchVisualization(
  request: VisualizationRequest,
): Promise<ContractEnvelope> {
  // Example shape of the future call:
  //
  //   const res = await fetch("/api/visualize", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(request),
  //   });
  //   if (!res.ok) return errorEnvelope("HTTP_ERROR", `HTTP ${res.status}`);
  //   return (await res.json()) as ContractEnvelope;
  //
  return errorEnvelope(
    "NOT_IMPLEMENTED",
    "The real backend is not connected yet.",
  );
}
```

**Line by line.**

- `USE_MOCK` — a single boolean switch. This is the whole "simulate the backend"
  story.
- `errorEnvelope` — a helper that builds a *valid* error envelope, so even
  failures pass validation and render the error card cleanly.
- `satisfies ContractError` — a TypeScript 4.9+ operator that checks the value
  against a type without widening it. It catches typos while keeping precise
  inference.
- `fetchVisualization` is `async`, so the UI can await it and show the loading
  state.
- It looks up the fixture, builds the data via `mockBackendQuery`, gets the spec
  via `mockAgentSpec`, and assembles the envelope with the right `status`.
- `realFetchVisualization` is the placeholder for the future HTTP call, written
  as a comment so the swap is obvious.

**How it connects.** The screens call `fetchVisualization`; `ChartRenderer`
consumes its return value.

---

# Part III (continued) — Screens

## 29. `src/screens/AgentScreen/AgentScreen.tsx`

**In plain words.** The demo screen. It lists the example questions; clicking one
shows a loading state, fetches the envelope, and renders it through
`ChartRenderer`.

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChartRenderer } from "../../engine/components/ChartRenderer";
import { LoadingState } from "../../engine/components/states/LoadingState";
import { fixtures } from "../../data/fixtures";
import { fetchVisualization } from "../../lib/visualizationClient";

const EXAMPLE_QUESTIONS = fixtures
  .filter((f) => f.forceStatus == null)
  .map((f) => f.question);

type Status = "idle" | "loading" | "done";

const AgentScreen = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<unknown>(null);

  async function ask(question: string) {
    setStatus("loading");
    setResponse(null);
    try {
      const envelope = await fetchVisualization({ question });
      setResponse(envelope);
    } catch (err) {
      setResponse({
        contractVersion: 1,
        status: "error",
        spec: null,
        data: [],
        error: { code: "CLIENT_ERROR", message: String(err) },
        meta: { rowCount: 0 },
      });
    } finally {
      setStatus("done");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ask the Agent</h1>
        <Link to="/" className="text-sm text-blue-600 underline">
          Go to Dashboard
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="min-h-80 rounded-xl border border-slate-200 bg-white p-4">
        {status === "idle" && (
          <p className="text-slate-500">Pick a question above to see its chart.</p>
        )}
        {status === "loading" && <LoadingState />}
        {status === "done" && <ChartRenderer response={response} />}
      </div>
    </div>
  );
};

export default AgentScreen;
```

**Line by line.**

- `useState` — React's hook for component memory. `status` tracks idle/loading/
  done; `response` holds whatever the client returned. Calling the setter
  triggers a re-render.
- `EXAMPLE_QUESTIONS` — derived from the fixtures (excluding the demo
  empty/error ones), so the buttons always match the data.
- `async function ask(question)` — sets loading, awaits the envelope, stores it,
  and always returns to `done` via `finally`.
- The `try/catch` guards against an unexpected thrown error by building a valid
  error envelope, so the UI still shows a card.
- In the JSX, the three `{status === … && …}` guards cover the three visual
  states.

**How it connects.** It is the manual driver for the whole engine: button →
client → renderer → adapter → ECharts.

## 30. `src/screens/DashboardScreen/DashboardScreen.tsx`

**In plain words.** A grid that renders several charts at once, to prove the
engine scales to a dashboard.

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChartRenderer } from "../../engine/components/ChartRenderer";
import { fixtures } from "../../data/fixtures";
import { fetchVisualization } from "../../lib/visualizationClient";

const DASHBOARD_IDS = [
  "kpi-total-sales",
  "sales-vs-profit",
  "sales-by-category",
  "stacked-modes",
];

const DashboardScreen = () => {
  const [panels, setPanels] = useState<{ id: string; response: unknown }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loaded = await Promise.all(
        DASHBOARD_IDS.map(async (id) => {
          const fixture = fixtures.find((f) => f.id === id)!;
          const response = await fetchVisualization({ question: fixture.question });
          return { id, response };
        }),
      );
      if (!cancelled) setPanels(loaded);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/agent" className="text-sm text-blue-600 underline">
          Go to Agent Screen
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className="min-h-80 rounded-xl border border-slate-200 bg-white p-4"
          >
            <ChartRenderer response={panel.response} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardScreen;
```

**Line by line.**

- `useEffect(() => { … }, [])` — runs once on mount to load all panels.
- `Promise.all([...])` — starts every fetch at once and waits for all to finish.
  This is faster than loading them one by one.
- `let cancelled = false; … return () => { cancelled = true; }` — a guard against
  setting state after the component unmounts (which React warns about). We only
  call `setPanels` if the component is still mounted.
- The grid renders one card per panel, each running the full pipeline
  independently.

**How it connects.** It demonstrates that `ChartRenderer` is self-contained and
composable.

---

# Part IV — Build & run

## 31. Build order (do it in this exact sequence)

Each step ends with something you can see. Do not skip ahead; each layer depends
on the one above.

1. **Contract** — create `engine/contract/spec.ts` and `index.ts`.
   *Check:* the project still compiles (`npm run build`).
2. **Validation** — create `engine/validate.ts`.
   *Check:* `npm run build` passes.
3. **Adapter** — create `adapter/format.ts`, `adapter/reshape.ts`,
   `adapter/toEChartsOption.ts`, `adapter/index.ts`.
   *Check:* compiles; types line up.
4. **State components** — `states/LoadingState.tsx`, `EmptyState.tsx`,
   `ErrorCard.tsx`.
5. **DOM charts** — `dom/KpiCard.tsx`, `dom/DataTable.tsx`.
6. **ECharts wrapper** — `components/EChart.tsx`.
7. **Registry** — `registry/chartRegistry.tsx`.
8. **Renderer** — `components/ChartRenderer.tsx`.
9. **Fixtures** — `data/fixtures/index.ts`.
10. **Mocks + client** — `data/mockBackend.ts`, `data/mockAgent.ts`,
    `lib/visualizationClient.ts`.
11. **Screens** — replace `AgentScreen.tsx` and `DashboardScreen.tsx`.
12. **Run** — `npm run dev`, open the Agent screen, click questions.
13. **Quality** — `npm run lint` and `npm run build` must both pass.

## 32. How to simulate the backend (and how to stop)

Simulating is not a special mode — it is the **default**. The UI always calls
`fetchVisualization({ question })`. Currently that function:

1. matches the question to a fixture,
2. waits ~450 ms to mimic a network round-trip,
3. returns a **contract-valid** envelope.

To go real, you change exactly two things and touch nothing else:

1. In `lib/visualizationClient.ts`, set `USE_MOCK = false`.
2. Fill in `realFetchVisualization` with your `fetch` call, returning the same
   `ContractEnvelope` type.

Because `ChartRenderer` consumes only the envelope, every screen, the adapter,
the registry, and the components remain untouched. **That** is why we separated
the contract from the code: the seam is one function wide.

## 33. Demo script (click-by-click, to prove it works)

Run `npm run dev` and open the app.

| Step | Do this | You should see |
| --- | --- | --- |
| 1 | Open `/agent` | A row of question buttons. |
| 2 | Click **"Compare sales and profit across regions"** | Brief loading, then a **grouped bar** with two series, Sales and Profit, currency-formatted. |
| 3 | Click **"Evolution of shipping modes by region"** | A **line chart** with four series (`Central — Air`, `Central — Sea`, `North — Air`, `North — Sea`) across two years. |
| 4 | Click **"Show total sales by category"** | A **pie** with four slices, legend at the bottom. |
| 5 | Click **"What is the total sales?"** | A big **KPI card**: `$1,160,000`. |
| 6 | Click **"Shipping modes stacked by region"** | A **stacked bar** (Air/Sea/Rail) per region. |
| 7 | Open `/` (Dashboard) | A 2×2 grid: KPI, grouped bar, pie, stacked bar — all rendered via the same engine. |
| 8 | Resize the window | Charts reflow smoothly (the `ResizeObserver` at work). |

## 34. Acceptance checklist

The engine is "done" when all of these are true:

- [ ] A long-format dataset renders as the correct chart type with no manual
      per-chart code.
- [ ] `y` as an **array** produces multiple series (Sales + Profit).
- [ ] `series` as an **array** groups by **two** fields (region × mode).
- [ ] Missing `(x, series)` combinations appear as **gaps**, not zeros.
- [ ] `status: "empty"` shows the empty card, never a broken chart.
- [ ] `status: "error"` and malformed JSON both show the error card with issues.
- [ ] A spec referencing a column absent from the data shows the field-mismatch
      card.
- [ ] `npm run lint` and `npm run build` both pass.
- [ ] Flipping `USE_MOCK` to `false` requires **no changes** outside
      `visualizationClient.ts`.

## 35. Deferred (explicitly out of scope — saying so is a strength)

- **Dual axes** (`axis: "left" | "right"` is reserved in the contract but not
  drawn yet).
- **Per-series colors**, sorting controls, custom tooltips.
- **Heatmap** rendering (contract supports it; ECharts option is left as an
  exercise).
- **Legend soft cap** — cap series at ~24 and show a "too many series" notice.
- **Filters and drill-down**, real-time updates.
- **The real backend and the real LLM agent.**

Documenting these deferrals shows the reviewer you know the boundaries of the
system, which reads as confidence, not incompleteness.

## 36. Glossary

| Term | Definition |
| --- | --- |
| **Envelope** | The outer JSON wrapper: status + spec + data + error + meta. |
| **Spec** | The chart description (type, title, encoding). Contains no data. |
| **Field** | A column name shared by the spec and every data row. |
| **Encoding** | The map from fields to visual roles. |
| **Channel** | One visual role: `x`, `y`, `series`, `value`, `label`. |
| **FieldSpec** | The metadata for one channel value (field, type, title, format…). |
| **Long format** | One row per dimension combination; the only data shape we accept. |
| **Reshape / pivot** | Converting long rows into the wide arrays a chart library wants. |
| **Series** | One drawn line / bar-group / set of pie slices. |
| **Adapter** | `spec` + `data` → the chart library's own format. |
| **Registry** | `chartType` string → React component. |
| **Discriminated union** | A type whose variants are distinguished by one field (`ok`, `status`). |
| **Zod** | A runtime validation library that also infers TypeScript types. |
| **superRefine** | A Zod hook for custom, cross-field validation rules. |
| **`z.infer`** | Derives a TypeScript type from a Zod schema. |
| **`useRef`** | A React box that persists across renders without causing re-renders. |
| **`useEffect`** | Runs side effects after render; `[]` means "once on mount." |
| **`useMemo`** | Caches a computed value until its dependencies change. |
| **Optional chaining (`?.`)** | Safely access a property that might be null/undefined. |
| **Nullish coalescing (`??`)** | Use the right value when the left is `null`/`undefined`. |
| **Swap seam** | The single function (`fetchVisualization`) that mock and real backends both satisfy. |

---

*End of document. Build the layers in order (section 31), simulate with the
default mocks (section 32), and verify with the demo script (section 33).*
