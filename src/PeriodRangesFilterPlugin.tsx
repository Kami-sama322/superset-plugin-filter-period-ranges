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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { AppSection, ensureIsArray } from '@superset-ui/core';
import { RangePicker } from '@superset-ui/core/components';
import { Button, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { FilterPluginStyle, StatusMessage } from './common';
import { validationMessages } from './periodMessages';
import { usePeriodsList } from './usePeriodsList';
import { buildPeriodRangesMask, isSafeSqlColumn } from './mask';
import type { PeriodRange } from './periods';
import type { PluginFilterPeriodRangesProps } from './types';

/** dayjs() is lenient: guard against corrupt persisted ownState values */
const toDayjs = (value: string): Dayjs | null => {
  // ternary, not `value &&` — a falsy string must become null, not itself
  const parsed = value ? dayjs(value) : null;
  return parsed?.isValid() ? parsed : null;
};

/**
 * Period ranges native filter: 1-5 equal-length date ranges. Emits a
 * tagged OR adhoc clause (multi-range filtering for every chart in scope)
 * and the structured ranges in custom_form_data (consumed by the period
 * comparison chart). The picker state persists in the filter's ownState.
 */
export default function PeriodRangesFilterPlugin(
  props: PluginFilterPeriodRangesProps,
) {
  const {
    filterState,
    formData,
    height,
    width,
    ownState,
    appSection,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    inputRef,
  } = props;
  const theme = useTheme();

  const { groupby = [], enableEmptyFilter = false } = formData;
  const [col = ''] = ensureIsArray(groupby);

  const onCommit = useCallback(
    (next: PeriodRange[]) => {
      setDataMask(buildPeriodRangesMask(next, col));
    },
    [col, setDataMask],
  );

  // picker state restored from the filter's persisted ownState; hosts that
  // provide no ownState at all (the default-value preview in the filter
  // config modal) fall back to the filterState.periods mirror
  const ownStatePeriods = (ownState as { periods?: PeriodRange[] } | undefined)
    ?.periods;
  const persistedPeriods =
    ownStatePeriods ??
    (filterState as { periods?: PeriodRange[] } | undefined)?.periods;
  const value = useMemo(
    () => (Array.isArray(persistedPeriods) ? persistedPeriods : []),
    [persistedPeriods],
  );

  // "Filter value is required" (enableEmptyFilter) forbids an empty set:
  // the last picker stays and empty lists are never committed. Default is
  // optional (allowEmpty), matching the framework's checkbox semantics.
  const {
    draft,
    validation,
    canAdd,
    canRemove,
    onRangeChange,
    addPeriod,
    removePeriod,
  } = usePeriodsList({
    value,
    onCommit,
    allowEmpty: !enableEmptyFilter,
  });

  // Re-assert the presence marker after a framework reset (Clear all,
  // dashboard load): comparison charts in scope must keep deferring to
  // this filter even while it has no ranges selected. The assert is
  // dashboard-only: the default-value preview in the filter config modal
  // (AppSection.FilterConfigModal) does not round-trip ownState, and an
  // assert there would clobber the saved default with an empty marker.
  // Even on the dashboard it runs at most once until ownState comes back
  // as an array (a non-round-tripping host must never loop setDataMask).
  const presenceAssertedRef = useRef(false);
  const isConfigModalPreview = appSection === AppSection.FilterConfigModal;
  useEffect(() => {
    if (Array.isArray(ownStatePeriods)) {
      // ownState round-trips: re-arm so a future reset re-asserts once
      presenceAssertedRef.current = false;
      return;
    }
    if (isConfigModalPreview || presenceAssertedRef.current) {
      return;
    }
    presenceAssertedRef.current = true;
    setDataMask(buildPeriodRangesMask([], col));
  }, [isConfigModalPreview, ownStatePeriods, col, setDataMask]);

  // "Clear all" resets filterState/extra_form_data but keeps our persisted
  // ownState — without this the pickers would keep stale ranges while the
  // dashboard is already unfiltered. Reset the picker state too.
  useEffect(() => {
    if (
      filterState?.value == null &&
      Array.isArray(ownStatePeriods) &&
      ownStatePeriods.length > 0
    ) {
      setDataMask(buildPeriodRangesMask([], col));
    }
  }, [filterState, ownStatePeriods, col, setDataMask]);

  const { errors, warnings } = validationMessages(validation);
  // the mask degrades to the presence marker for unsafe column names —
  // surface that instead of failing silently
  const columnWarning =
    col && !isSafeSqlColumn(col)
      ? t(
          'Date column "%(col)s" is not a valid SQL identifier — the filter is not applied',
          { col },
        )
      : null;
  const allWarnings = columnWarning ? [...warnings, columnWarning] : warnings;

  const statusMessage =
    filterState.validateStatus === 'error' ? (
      <StatusMessage>{filterState.validateMessage}</StatusMessage>
    ) : null;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setFilterActive(true);
        setHoveredFilter();
        setFocusedFilter();
        return;
      }
      setFilterActive(false);
      unsetHoveredFilter();
      unsetFocusedFilter();
    },
    [
      setFilterActive,
      setFocusedFilter,
      setHoveredFilter,
      unsetFocusedFilter,
      unsetHoveredFilter,
    ],
  );

  return (
    <FilterPluginStyle
      className="filter-box"
      height={height}
      width={width}
      onMouseEnter={setHoveredFilter}
      onMouseLeave={unsetHoveredFilter}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {draft.map((period, index) => (
          <Space key={period.id} size={4} style={{ width: '100%' }}>
            <RangePicker
              ref={index === 0 ? inputRef : undefined}
              size="small"
              allowEmpty={[true, true]}
              format="DD.MM.YYYY"
              style={{ flex: '1 1 auto' }}
              value={[toDayjs(period.start), toDayjs(period.end)]}
              onChange={values => onRangeChange(index, values)}
              onOpenChange={handleOpenChange}
              aria-label={t('Period %(index)s', { index: index + 1 })}
            />
            <Button
              size="small"
              type="text"
              aria-label={t('Remove period %(index)s', { index: index + 1 })}
              disabled={!canRemove}
              onClick={() => removePeriod(index)}
            >
              ×
            </Button>
          </Space>
        ))}
        <div>
          <Button size="small" disabled={!canAdd} onClick={addPeriod}>
            + {t('Period')}
          </Button>
        </div>
        {errors.length > 0 || allWarnings.length > 0 ? (
          <div role="alert" style={{ fontSize: 12, lineHeight: 1.4 }}>
            {[
              { items: errors, color: theme.colorError },
              { items: allWarnings, color: theme.colorWarning },
            ].map(({ items, color }) =>
              items.map(message => (
                <div key={message} style={{ color }}>
                  {message}
                </div>
              )),
            )}
          </div>
        ) : null}
      </div>
      {statusMessage}
    </FilterPluginStyle>
  );
}
