import { createElement, useMemo } from "react";
import { crossValidate, validateEnvelope } from "../validate";
import { getChartComponent } from "../registry/chartRegistry";
import { ErrorCard } from "./states/ErrorCard";
import { EmptyState } from "./states/EmptyState";

export interface ChartRendererProps {
  /** The raw, unknown response (typed as unknown on purpose). */
  response: unknown;
  /** Optional registered ECharts theme applied to rendered charts. */
  theme?: string;
  /** Chart height in pixels (ECharts-backed types only). */
  height?: number;
}

export function ChartRenderer({ response, theme, height }: ChartRendererProps) {
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
      <ErrorCard
        title={cross.message}
        message="Field mismatch"
        issues={cross.issues}
      />
    );
  }

  // Station 4: find the component for this chart type.
  const chartComponent = getChartComponent(envelope.spec.chartType);
  if (!chartComponent) {
    return (
      <ErrorCard
        message={`Unsupported chart type "${envelope.spec.chartType}".`}
      />
    );
  }

  // Stations 5-6: hand off to the component (which adapts + draws).
  return (
    <div className="h-full w-full">
      {createElement(chartComponent, {
        spec: envelope.spec,
        data: envelope.data,
        theme,
        height,
      })}
    </div>
  );
}
