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
  PERIOD_RANGES_TAG,
  snapEndExclusiveMs,
  spanFilterValue,
  toUtcSqlString,
  validatePeriods,
  type PeriodRange,
} from "./periods";

// single source of truth for the tag: periods.ts (the synced chart copy)
// declares it too, so re-export instead of redefining
export { PERIOD_RANGES_TAG };

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

export type RangeEntry = {
  col: string;
  /** Inclusive range bound, ISO 8601 UTC */
  start: string;
  /** Inclusive range bound, ISO 8601 UTC */
  end: string;
};

/**
 * Column names that can be embedded as bare SQL identifiers (optionally
 * schema-qualified). The tagged clause is a hand-written SQL string, so a
 * hostile or malformed column name must never reach it.
 */
const SAFE_COLUMN_RE =
  /^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$/;

/** True when the column can be embedded into the tagged SQL clause as-is */
export function isSafeSqlColumn(col: string): boolean {
  return SAFE_COLUMN_RE.test(col);
}

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
  filterState: {
    value: string | null;
    label?: string;
    /** Portable mirror of ownState.periods: the default-value preview in
     * the filter config modal never receives ownState */
    periods?: PeriodRange[];
  };
};

const toIso = (ms: number): string => new Date(ms).toISOString();

/**
 * Inclusive upper bound as SQL: the last representable instant of the
 * exclusive bound (endExclusiveMs - 1ms = 23:59:59.999) plus a microsecond
 * suffix so microsecond-precision timestamp columns are fully covered by
 * the `<=` comparison. Matches the calendar filter's inclusive-end
 * contract (`col <= end`) that users expect.
 */
const toInclusiveEndSql = (endExclusiveMs: number): string =>
  `${toUtcSqlString(endExclusiveMs - 1)}.999999`;

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

/**
 * Tagged OR clause consumed by every in-scope chart's query builder.
 * Inclusive-end contract: `(col >= 'S 00:00:00' AND col <= 'E 23:59:59.999999')`
 * — semantically identical to the half-open form and visually matching the
 * calendar filter. Callers must pass `isSafeSqlColumn(col)` — the column is
 * embedded verbatim.
 */
export function buildTaggedRangesClause(
  col: string,
  periods: Parameters<typeof spanFilterValue>[0],
): string {
  const clauses = mergeRanges(periods).map(
    bound =>
      `(${col} >= '${toUtcSqlString(bound.startMs)}' AND ${col} <= '${toInclusiveEndSql(
        bound.endExclusiveMs,
      )}')`,
  );
  return `${PERIOD_RANGES_TAG} ${clauses.join(" OR ")}`;
}

/** Raw picker entry: only { start, end } survives persistence */
const toRawPeriod = ({ start, end }: PeriodRange): PeriodRange => ({
  start,
  end,
});

/**
 * Full data mask of the filter. Empty/invalid periods emit a presence-only
 * marker entry (`{ col }` without dates) so that every period comparison
 * chart in scope knows the filter EXISTS and hides its own pickers, while
 * the filter itself applies nothing (NO_TIME_RANGE). The picker state
 * persists in ownState and survives dashboard reloads.
 */
export function buildPeriodRangesMask(
  periods: PeriodRange[],
  col: string | null | undefined,
): DataMaskLike {
  const { periods: validated } = validatePeriods(periods);
  // unsafe column names degrade to the presence marker (same as no
  // column) instead of reaching the SQL string
  const safeCol = col && isSafeSqlColumn(col) ? col : "";
  const valid = validated.length > 0 && Boolean(safeCol);
  const rawPeriods = periods.map(toRawPeriod);
  return {
    // persisted picker state: the pickers restore from here on remount
    ownState: { periods: rawPeriods },
    extraFormData: {
      filters: [],
      adhoc_filters: valid
        ? [
            {
              clause: "WHERE",
              expressionType: "SQL",
              sqlExpression: buildTaggedRangesClause(safeCol, validated),
            },
          ]
        : [],
      custom_form_data: valid
        ? validated.map(period => ({
            col: safeCol,
            start: toIso(period.startMs),
            end: toIso(period.endMs),
          }))
        : [{ col: safeCol }], // presence-only marker (no dates)
    },
    filterState: {
      value: valid ? spanFilterValue(validated) : null,
      label: valid
        ? validated.map(formatPeriodLabel).join(", ")
        : undefined,
      periods: rawPeriods,
    },
  };
}
