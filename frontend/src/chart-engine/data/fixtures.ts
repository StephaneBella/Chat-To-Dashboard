import type { FieldType, Row, Spec } from "../contract";

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

/* ---------- The eight rows traced in the architecture doc ---------- */
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
    id: "sales-table",
    question: "Show the sales table",
    keywords: ["table", "rows", "list"],
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
      id: "sales-table",
      chartType: "table",
      title: "Sales by Region",
      encoding: {
        x: { field: "region", type: "category", title: "Region" },
        y: [
          { field: "total_sales", type: "number", title: "Sales", format: "currency" },
          { field: "total_profit", type: "number", title: "Profit", format: "currency" },
        ],
      },
      options: { format: "currency" },
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
