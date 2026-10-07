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
  createPeriodIdFactory,
  serializePeriods,
  shouldCommit,
  stripDraftIds,
  withStableIds,
  type DraftPeriod,
} from "./usePeriodsList";
import { validatePeriods } from "./periods";

test("createPeriodIdFactory yields unique sequential ids", () => {
  const nextId = createPeriodIdFactory();
  const ids = [nextId(), nextId(), nextId()];
  expect(new Set(ids).size).toBe(3);
  // separate instances do not share the counter
  expect(createPeriodIdFactory()()).toBe("period-1");
});

test("withStableIds stamps every period and keeps the bounds", () => {
  const nextId = createPeriodIdFactory();
  const draft = withStableIds(
    [
      { start: "2026-01-05", end: "2026-01-09" },
      { start: "2026-02-02", end: "2026-02-06" },
    ],
    nextId,
  );
  expect(draft).toHaveLength(2);
  expect(draft[0].start).toBe("2026-01-05");
  expect(draft[0].end).toBe("2026-01-09");
  expect(draft[0].id).not.toBe(draft[1].id);
});

test("serializePeriods compares content only, ignoring draft ids", () => {
  const clean = [{ start: "2026-01-05", end: "2026-01-09" }];
  const drafted = withStableIds(clean, createPeriodIdFactory());
  expect(serializePeriods(drafted)).toBe(serializePeriods(clean));
  expect(serializePeriods([{ start: "2026-01-06", end: "2026-01-09" }])).not.toBe(
    serializePeriods(clean),
  );
});

test("stripDraftIds removes the id fields", () => {
  const drafted: DraftPeriod[] = [
    { start: "2026-01-05", end: "2026-01-09", id: "period-1" },
  ];
  expect(stripDraftIds(drafted)).toEqual([
    { start: "2026-01-05", end: "2026-01-09" },
  ]);
});

const VALID = [
  { start: "2026-01-05", end: "2026-01-09" },
  { start: "2026-02-02", end: "2026-02-06" },
];
const UNEQUAL = [
  { start: "2026-01-05", end: "2026-01-09" },
  { start: "2026-02-02", end: "2026-02-08" },
];

test("shouldCommit: valid non-empty sets commit by default", () => {
  expect(shouldCommit(validatePeriods(VALID), {})).toBe(true);
});

test("shouldCommit: invalid sets are blocked unless commitInvalid", () => {
  const validation = validatePeriods(UNEQUAL); // length_mismatch error
  expect(shouldCommit(validation, {})).toBe(false);
  expect(
    shouldCommit(validation, { commitInvalid: true }),
  ).toBe(true);
});

test("shouldCommit: empty sets follow allowEmpty", () => {
  const empty = validatePeriods([]);
  expect(shouldCommit(empty, {})).toBe(false);
  expect(shouldCommit(empty, { allowEmpty: true })).toBe(true);
  // commitInvalid overrides the empty-set gate too (Explore control)
  expect(shouldCommit(empty, { commitInvalid: true })).toBe(true);
});
