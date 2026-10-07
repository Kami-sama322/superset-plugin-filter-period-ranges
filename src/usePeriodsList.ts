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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import {
  MAX_PERIODS,
  validatePeriods,
  type PeriodRange,
  type Validation,
} from "./periods";

type PickerValue = [Dayjs | null, Dayjs | null] | null;

type Args = {
  /** Authoritative value from props (ownState / control value) */
  value: PeriodRange[];
  /**
   * Called with the next list on every committed edit. When `commitInvalid`
   * is false the edit is only committed for valid sets.
   */
  onCommit: (next: PeriodRange[]) => void;
  /** Explore control emits even invalid lists (buildQuery reports details) */
  commitInvalid?: boolean;
  /**
   * Allow removing EVERY picker (an empty set = no filtering). The
   * period_ranges filter allows it; the chart's own toolbar keeps at
   * least one picker so the chart never loses its periods.
   */
  allowEmpty?: boolean;
};

/** Draft entry: period + stable id used as the React list key */
export type DraftPeriod = PeriodRange & { id: string };

/** Factory of unique draft ids, one sequence per hook instance */
export function createPeriodIdFactory(): () => string {
  let counter = 0;
  return () => `period-${(counter += 1)}`;
}

/** Stamp periods with fresh ids (draft rebuild) */
export function withStableIds(
  periods: PeriodRange[],
  nextId: () => string,
): DraftPeriod[] {
  return periods.map(period => ({ ...period, id: nextId() }));
}

/** Content-only identity: draft ids must not participate in sync compares */
export function serializePeriods(periods: PeriodRange[]): string {
  return JSON.stringify(periods.map(({ start, end }) => ({ start, end })));
}

/**
 * Commit gating: the toolbar only commits valid sets; the Explore control
 * always emits so buildQuery can report the problem in the editor.
 */
export function shouldCommit(
  validation: Validation,
  {
    commitInvalid = false,
    allowEmpty = false,
  }: { commitInvalid?: boolean; allowEmpty?: boolean } = {},
): boolean {
  if (commitInvalid) {
    return true;
  }
  if (validation.errors.length > 0) {
    return false;
  }
  return validation.periods.length > 0 || allowEmpty;
}

/** Draft ids are a rendering concern only — commit clean periods */
export function stripDraftIds(draft: DraftPeriod[]): PeriodRange[] {
  return draft.map(({ start, end }) => ({ start, end }));
}

const toIso = (value: Dayjs | null): string =>
  value ? value.format("YYYY-MM-DD") : "";

/**
 * Shared editor state for the 1..5 period pickers (on-chart toolbar and the
 * Explore control): draft list, validation, add/remove/range-change with
 * sync-back from the authoritative prop value.
 */
export function usePeriodsList({
  value,
  onCommit,
  commitInvalid = false,
  allowEmpty = false,
}: Args) {
  const nextId = useMemo(() => createPeriodIdFactory(), []);
  const withIds = useCallback(
    (periods: PeriodRange[]): DraftPeriod[] => withStableIds(periods, nextId),
    [nextId],
  );

  const [draft, setDraft] = useState<DraftPeriod[]>(() => withIds(value));
  const lastSyncedRef = useRef<string>(serializePeriods(value));

  // keep the pickers in sync with externally applied state
  useEffect(() => {
    const serialized = serializePeriods(value);
    if (serialized !== lastSyncedRef.current) {
      lastSyncedRef.current = serialized;
      setDraft(withIds(value));
    }
  }, [value, withIds]);

  const validation: Validation = useMemo(
    () => validatePeriods(draft),
    [draft],
  );

  const apply = useCallback(
    (next: DraftPeriod[]) => {
      setDraft(next);
      if (
        shouldCommit(validatePeriods(next), { commitInvalid, allowEmpty })
      ) {
        const committed = stripDraftIds(next);
        lastSyncedRef.current = serializePeriods(committed);
        onCommit(committed);
      }
    },
    [commitInvalid, allowEmpty, onCommit],
  );

  const onRangeChange = useCallback(
    (index: number, values: PickerValue) => {
      apply(
        draft.map((period, position) =>
          position === index
            ? {
                ...period,
                start: toIso(values?.[0] ?? null),
                end: toIso(values?.[1] ?? null),
              }
            : period,
        ),
      );
    },
    [draft, apply],
  );

  const addPeriod = useCallback(() => {
    if (draft.length >= MAX_PERIODS) {
      return;
    }
    // a new picker starts as a copy of the last one (blank on empty list)
    apply([
      ...draft,
      { ...(draft[draft.length - 1] ?? { start: "", end: "" }), id: nextId() },
    ]);
  }, [draft, apply, nextId]);

  const removePeriod = useCallback(
    (index: number) => {
      // the last picker is removable only when empty sets are allowed
      if (draft.length <= (allowEmpty ? 0 : 1)) {
        return;
      }
      apply(draft.filter((_, position) => position !== index));
    },
    [draft, apply, allowEmpty],
  );

  return {
    draft,
    validation,
    canAdd: draft.length < MAX_PERIODS,
    /** the last picker is removable only when empty sets are allowed */
    canRemove: draft.length > (allowEmpty ? 0 : 1),
    onRangeChange,
    addPeriod,
    removePeriod,
  };
}
