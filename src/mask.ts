/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  formatPeriodLabel,
  snapEndExclusiveMs,
  spanFilterValue,
  toUtcSqlString,
  validatePeriods,
  type PeriodRange,
} from "./periods";

/**
 * The wire contract between this filter and the rest of the dashboard.
 * Dependency-free and unit-testable outside the Superset tree.
 *
 * - `extra_form_data.adhoc_filters` carries ONE tagged OR clause so every
 *   chart in scope (tables etc.) gets correct multi-range OR semantics —
 *   plain TEMPORAL_RANGE clauses would be AND-combined by the backend.
 * - `extra_form_data.custom_form_data` carries the structured ranges and
 *   reaches every chart's formData verbatim (APPEND key handled by
 *   buildQueryObject) — this is how the period comparison chart receives
 *   the periods.
 */

export const PERIOD_RANGES_TAG = "/* period_ranges:v1 */";

export type RangeEntry = {
  col: string;
  /** Inclusive range bound, ISO 8601 UTC */
  start: string;
  /** Inclusive range bound, ISO 8601 UTC */
  end: string;
};

export type DataMaskLike = {
  ownState: Record<string, unknown>;
  extraFormData: {
    filters: never[];
    adhoc_filters: {
      clause: string;
      expressionType: string;
      sqlExpression: string;
    }[];
    custom_form_data: RangeEntry[];
  };
  filterState: { value: string | null; label?: string };
};

const toIso = (ms: number): string => new Date(ms).toISOString();

/**
 * Merge overlapping and adjacent ranges into a sorted disjoint set.
 *
 * The user's periods stay untouched for the comparison chart (they are
 * rendered as separate lines), but the SQL predicate for the other charts
 * benefits: fewer OR branches, no redundant index scans over overlapping
 * intervals, and a deterministic clause. Semantics are preserved — a row
 * inside two overlapping ranges matches the union either way.
 */
export function mergeRanges(
  periods: Parameters<typeof spanFilterValue>[0],
): { startMs: number; endExclusiveMs: number }[] {
  const bounds = periods
    .map(period => ({
      startMs: period.startMs,
      endExclusiveMs: snapEndExclusiveMs(period.endMs, "day"),
    }))
    .sort((a, b) => a.startMs - b.startMs);
  const merged: { startMs: number; endExclusiveMs: number }[] = [];
  for (const bound of bounds) {
    const last = merged[merged.length - 1];
    if (last && bound.startMs <= last.endExclusiveMs) {
      last.endExclusiveMs = Math.max(last.endExclusiveMs, bound.endExclusiveMs);
    } else {
      merged.push({ ...bound });
    }
  }
  return merged;
}

/** Tagged OR clause consumed by every in-scope chart's query builder */
export function buildTaggedRangesClause(
  col: string,
  periods: Parameters<typeof spanFilterValue>[0],
): string {
  const clauses = mergeRanges(periods).map(
    bound =>
      `(${col} >= '${toUtcSqlString(bound.startMs)}' AND ${col} < '${toUtcSqlString(
        bound.endExclusiveMs,
      )}')`,
  );
  return `${PERIOD_RANGES_TAG} ${clauses.join(" OR ")}`;
}

/**
 * Full data mask of the filter. Empty/invalid periods clear the filter
 * (NO_TIME_RANGE) but keep the picker state in ownState so it survives
 * dashboard reloads.
 */
export function buildPeriodRangesMask(
  periods: PeriodRange[],
  col: string | null | undefined,
): DataMaskLike {
  const { periods: validated } = validatePeriods(periods);
  const valid = validated.length > 0 && Boolean(col);
  const entries: RangeEntry[] = validated.map(period => ({
    col: col || "",
    start: toIso(period.startMs),
    end: toIso(period.endMs),
  }));
  return {
    // persisted picker state: the pickers restore from here on remount
    ownState: { periods: periods.map(({ start, end }) => ({ start, end })) },
    extraFormData: {
      filters: [],
      adhoc_filters: valid
        ? [
            {
              clause: "WHERE",
              expressionType: "SQL",
              sqlExpression: buildTaggedRangesClause(
                col as string,
                validated,
              ),
            },
          ]
        : [],
      custom_form_data: valid ? entries : [],
    },
    filterState: {
      value: valid ? spanFilterValue(validated) : null,
      label: valid
        ? validated.map(formatPeriodLabel).join(", ")
        : undefined,
    },
  };
}
