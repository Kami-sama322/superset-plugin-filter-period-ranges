/*
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
  buildPeriodRangesMask,
  buildTaggedRangesClause,
  mergeRanges,
  PERIOD_RANGES_TAG,
} from "./mask";

const periods = [
  { start: "2026-01-05", end: "2026-01-09" },
  { start: "2026-02-02", end: "2026-02-06" },
];

test("valid periods emit one tagged OR clause and the structured ranges", () => {
  const mask = buildPeriodRangesMask(periods, "ds");
  expect(mask.extraFormData.filters).toEqual([]);
  expect(mask.extraFormData.adhoc_filters).toHaveLength(1);
  const clause = mask.extraFormData.adhoc_filters[0];
  expect(clause.clause).toBe("WHERE");
  expect(clause.expressionType).toBe("SQL");
  expect(clause.sqlExpression).toContain(PERIOD_RANGES_TAG);
  expect(clause.sqlExpression).toBe(
    `${PERIOD_RANGES_TAG} (ds >= '2026-01-05 00:00:00' AND ds < '2026-01-10 00:00:00') OR ` +
      `(ds >= '2026-02-02 00:00:00' AND ds < '2026-02-07 00:00:00')`,
  );
  expect(mask.extraFormData.custom_form_data).toEqual([
    {
      col: "ds",
      start: "2026-01-05T00:00:00.000Z",
      end: "2026-01-09T23:59:59.999Z",
    },
    {
      col: "ds",
      start: "2026-02-02T00:00:00.000Z",
      end: "2026-02-06T23:59:59.999Z",
    },
  ]);
  expect(mask.filterState.value).toBe(
    "2026-01-05 00:00:00 : 2026-02-07 00:00:00",
  );
  expect(mask.filterState.label).toContain("05.01");
  // the pickers restore from ownState after dashboard reloads
  expect(mask.ownState.periods).toEqual(periods);
  // filterState mirrors ownState.periods for hosts without ownState
  // (the default-value preview in the filter config modal)
  expect(mask.filterState.periods).toEqual(periods);
});

test("an invalid set emits the presence marker and clears the filter", () => {
  const unequal = buildPeriodRangesMask(
    [
      { start: "2026-01-05", end: "2026-01-09" },
      { start: "2026-02-02", end: "2026-02-08" },
    ],
    "ds",
  );
  expect(unequal.extraFormData.adhoc_filters).toEqual([]);
  expect(unequal.extraFormData.custom_form_data).toEqual([{ col: "ds" }]);
  expect(unequal.filterState.value).toBeNull();
});

test("an empty list emits the presence marker too", () => {
  const mask = buildPeriodRangesMask([], "ds");
  expect(mask.extraFormData.adhoc_filters).toEqual([]);
  expect(mask.extraFormData.custom_form_data).toEqual([{ col: "ds" }]);
  expect(mask.filterState.value).toBeNull();
  expect(mask.ownState.periods).toEqual([]);
});

test("the presence marker is emitted even without a configured column", () => {
  const mask = buildPeriodRangesMask(periods, undefined);
  expect(mask.extraFormData.adhoc_filters).toEqual([]);
  expect(mask.extraFormData.custom_form_data).toEqual([{ col: "" }]);
});

test("the presence marker works without a configured column too", () => {
  const mask = buildPeriodRangesMask([], undefined);
  expect(mask.extraFormData.adhoc_filters).toEqual([]);
  expect(mask.extraFormData.custom_form_data).toEqual([{ col: "" }]);
  expect(mask.filterState.value).toBeNull();
  expect(mask.ownState.periods).toEqual([]);
});

test("a schema-qualified column is applied as-is", () => {
  const mask = buildPeriodRangesMask(periods, "events.dt");
  expect(mask.extraFormData.adhoc_filters).toHaveLength(1);
  expect(mask.extraFormData.custom_form_data[0].col).toBe("events.dt");
});

test("an unsafe column name degrades to the presence marker", () => {
  const unsafe =
    "ds); DROP TABLE users; --";
  const mask = buildPeriodRangesMask(periods, unsafe);
  expect(mask.extraFormData.adhoc_filters).toEqual([]);
  expect(mask.extraFormData.custom_form_data).toEqual([{ col: "" }]);
  expect(mask.filterState.value).toBeNull();
  // the pickers keep the drafted periods regardless
  expect(mask.ownState.periods).toEqual(periods);
});

test("buildTaggedRangesClause joins per-range clauses with OR", () => {
  const clause = buildTaggedRangesClause("events.dt", [
    { startMs: Date.UTC(2026, 0, 5), endMs: Date.UTC(2026, 0, 9, 23, 59, 59, 999) },
  ]);
  expect(clause).toBe(
    `${PERIOD_RANGES_TAG} (events.dt >= '2026-01-05 00:00:00' AND events.dt < '2026-01-10 00:00:00')`,
  );
});

test("mergeRanges collapses overlapping and adjacent ranges", () => {
  const utc = (d: number) => Date.UTC(2026, 0, d);
  const endOfDay = (d: number) => Date.UTC(2026, 0, d) + 86399999;
  // overlapping
  expect(
    mergeRanges([
      { startMs: utc(5), endMs: endOfDay(9) },
      { startMs: utc(7), endMs: endOfDay(12) },
    ]),
  ).toEqual([{ startMs: utc(5), endExclusiveMs: utc(13) }]);
  // adjacent: next start == previous exclusive end
  expect(
    mergeRanges([
      { startMs: utc(5), endMs: endOfDay(9) },
      { startMs: utc(10), endMs: endOfDay(12) },
    ]),
  ).toEqual([{ startMs: utc(5), endExclusiveMs: utc(13) }]);
  // disjoint ranges survive sorted
  expect(
    mergeRanges([
      { startMs: utc(10), endMs: endOfDay(12) },
      { startMs: utc(1), endMs: endOfDay(3) },
    ]),
  ).toEqual([
    { startMs: utc(1), endExclusiveMs: utc(4) },
    { startMs: utc(10), endExclusiveMs: utc(13) },
  ]);
  // duplicates collapse into one
  expect(
    mergeRanges([
      { startMs: utc(5), endMs: endOfDay(9) },
      { startMs: utc(5), endMs: endOfDay(9) },
    ]),
  ).toEqual([{ startMs: utc(5), endExclusiveMs: utc(10) }]);
});

test("the emitted clause uses merged ranges", () => {
  const clause = buildTaggedRangesClause("ds", [
    { startMs: Date.UTC(2026, 0, 5), endMs: Date.UTC(2026, 0, 9, 23, 59, 59, 999) },
    { startMs: Date.UTC(2026, 0, 10), endMs: Date.UTC(2026, 0, 12, 23, 59, 59, 999) },
  ]);
  expect(clause).toBe(
    `${PERIOD_RANGES_TAG} (ds >= '2026-01-05 00:00:00' AND ds < '2026-01-13 00:00:00')`,
  );
});

test("overlapping periods produce a merged clause", () => {
  const clause = buildTaggedRangesClause("ds", [
    { startMs: Date.UTC(2026, 0, 5), endMs: Date.UTC(2026, 0, 12, 23, 59, 59, 999) },
    { startMs: Date.UTC(2026, 0, 7), endMs: Date.UTC(2026, 0, 9, 23, 59, 59, 999) },
  ]);
  expect(clause).toBe(
    `${PERIOD_RANGES_TAG} (ds >= '2026-01-05 00:00:00' AND ds < '2026-01-13 00:00:00')`,
  );
});
