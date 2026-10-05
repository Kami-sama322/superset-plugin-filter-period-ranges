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
});

test("an invalid set clears the filter but the clause needs a column", () => {
  const unequal = buildPeriodRangesMask(
    [
      { start: "2026-01-05", end: "2026-01-09" },
      { start: "2026-02-02", end: "2026-02-08" },
    ],
    "ds",
  );
  expect(unequal.extraFormData.adhoc_filters).toEqual([]);
  expect(unequal.extraFormData.custom_form_data).toEqual([]);
  expect(unequal.filterState.value).toBeNull();

  const noCol = buildPeriodRangesMask(periods, undefined);
  expect(noCol.extraFormData.adhoc_filters).toEqual([]);
  expect(noCol.extraFormData.custom_form_data).toEqual([]);
});

test("an empty list clears the filter", () => {
  const mask = buildPeriodRangesMask([], "ds");
  expect(mask.extraFormData.adhoc_filters).toEqual([]);
  expect(mask.extraFormData.custom_form_data).toEqual([]);
  expect(mask.filterState.value).toBeNull();
  expect(mask.ownState).toEqual({});
});

test("buildTaggedRangesClause joins per-range clauses with OR", () => {
  const clause = buildTaggedRangesClause("events.dt", [
    { startMs: Date.UTC(2026, 0, 5), endMs: Date.UTC(2026, 0, 9, 23, 59, 59, 999) },
  ]);
  expect(clause).toBe(
    `${PERIOD_RANGES_TAG} (events.dt >= '2026-01-05 00:00:00' AND events.dt < '2026-01-10 00:00:00')`,
  );
});
