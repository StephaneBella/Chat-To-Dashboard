// this file holds all the specs configuration , 
// its like for validation on the data but using zod so that we can have a better type inference and validation at the same time
import { z } from "zod";

// field types of the x and y axis : number for quantitative data, category for qualitative data
export const FieldTypeSchema = z.enum(["number", "category", "date"]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const FieldFormatSchema = z.enum(["number", "currency","percent","compact"]);
export type FieldFormat = z.infer<typeof FieldFormatSchema>

// setting options for the aggregate fields
export const AggregateSchema = z.enum(["sum", "avg","min","max","count"]);
export type Aggregate = z.infer<typeof AggregateSchema>

//metadata for one field
export const FieldSpecSchema = z.object({
    field: z.string().min(1,"field must be a non-empty column name"), //column's name
    type: FieldTypeSchema.optional(),
    title: z.string().optional(),
    format: FieldFormatSchema.optional(),
    aggregate: AggregateSchema.optional(),
    axis: z.enum(["left","right"]).optional(),
})
export type FieldSpec = z.infer<typeof FieldSpecSchema>;

export const SingleFieldSpecSchema = FieldSpecSchema ; //to show that a channel takes exactly one element 
export const FieldSpecOrArraySchema = z.union([
    FieldSpecSchema,
    z.array(FieldSpecSchema).min(1),
]); //either an array or a single FieldSpecSchema

export const OptionalFieldSpecSchema = z.union([
    FieldSpecSchema,
    z.array(FieldSpecSchema).min(1),
]).nullish();

export type OptionalFieldSpec = z.infer<typeof OptionalFieldSpecSchema>

//chart types
export const ChartTypeSchema = z.enum(["line","area","bar","hbar",
    "stackedBar","groupedBar","pie","donut","kpi","table","scatter","heatmap"
])
export type ChartType = z.infer<typeof ChartTypeSchema>;

//encoding schema
export const EncodingSchema = z.object({
    x: OptionalFieldSpecSchema, // horizontal dimension
    y: OptionalFieldSpecSchema, // measure(s)
    series: OptionalFieldSpecSchema, // grouping(s)
    value: OptionalFieldSpecSchema,
    label: OptionalFieldSpecSchema,

});
export type Encoding = z.infer<typeof EncodingSchema>

//the options schema
export const OptionsSchema = z.object({
    stacked: z.boolean().optional(),
    smooth: z.boolean().optional(),
    horizontal: z.boolean().optional(),
    legend: z.boolean().optional(),
    missing: z.enum(["null","zero"]).optional(),
    seriesSeparator: z.string().optional(), // how multi group names are joined
    format: FieldFormatSchema.optional(),
    sort: z.enum(["none","asc","desc"]).optional(),
});
export type Options = z.infer<typeof OptionsSchema>;

// the over all spec schema with conditions
export const SpecSchema = z.object({
    id: z.string().min(1),
    chartType: ChartTypeSchema,
    title: z.string().optional,
    subtitle: z.string().optional(),
    encoding: EncodingSchema,
    options: OptionsSchema.optional()
}).superRefine((spec, ctx) => {

    //takes as paramter an optional field and returns a boolean
    const has = (v: z.infer<typeof OptionalFieldSpecSchema>): boolean =>
      v != null && (!Array.isArray(v) || v.length > 0);

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
        break;
    }
  });
export type Spec = z.infer<typeof SpecSchema>;
//Above this is to condition the different fields needed based on the type of chart

// rows, errors ,meta ,envelope
export const RowSchema = z.record(z.string(), z.unknown())
export type Row = z.infer<typeof RowSchema>

export const ContractErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
})
export type ContractError = z.infer<typeof ContractErrorSchema>

export const MetaSchema = z.object({
    rowCount: z.number(),
    truncated: z.boolean().optional(),
    generatedAt: z.string().optional()
})
export type Meta = z.infer<typeof MetaSchema>

export const EnvelopeSchema = z.object({
    contractVersion: z.literal(1),
    status: z.enum(["success","empty","error"]),
    spec: SpecSchema.nullable(),
    data: z.array(RowSchema),
    error: ContractErrorSchema.nullable(),
    meta: MetaSchema.optional()
}).superRefine((env,ctx)=>{
    if (env.status === "success" && env.spec == null) {
      ctx.addIssue({ code: "custom", path: ["spec"], message: "status is 'success' but spec is null" });
    }
    if (env.status === "error" && env.error == null) {
      ctx.addIssue({ code: "custom", path: ["error"], message: "status is 'error' but error is null" });
    }
});
export type ContractEnveloper = z.infer<typeof EnvelopeSchema>;

