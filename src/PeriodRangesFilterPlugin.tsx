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
import { useCallback, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { ensureIsArray } from '@superset-ui/core';
import { RangePicker } from '@superset-ui/core/components';
import { Button, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { FilterPluginStyle, StatusMessage } from './common';
import { validationMessages } from './periodMessages';
import { usePeriodsList } from './usePeriodsList';
import { buildPeriodRangesMask } from './mask';
import type { PeriodRange } from './periods';
import type { PluginFilterPeriodRangesProps } from './types';

type PickerValue = [Dayjs | null, Dayjs | null] | null;

/**
 * Period ranges native filter: 1-5 equal-length date ranges. Emits a
 * tagged OR adhoc clause (multi-range filtering for every chart in scope)
 * and the structured ranges in custom_form_data (consumed by the period
 * comparison chart).
 */
export default function PeriodRangesFilterPlugin(
  props: PluginFilterPeriodRangesProps,
) {
  const {
    filterState,
    formData,
    height,
    width,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    inputRef,
  } = props;

  const { groupby = [] } = formData;
  const [col = ''] = ensureIsArray(groupby);

  const onCommit = useCallback(
    (next: PeriodRange[]) => {
      setDataMask(buildPeriodRangesMask(next, col));
    },
    [col, setDataMask],
  );

  const {
    draft,
    validation,
    canAdd,
    canRemove,
    onRangeChange,
    addPeriod,
    removePeriod,
  } = usePeriodsList({ value: [], onCommit });

  const { errors, warnings } = validationMessages(validation);
  const hasIssues = errors.length > 0 || warnings.length > 0;

  const formItemData = useMemo(() => {
    if (filterState.validateStatus === 'error') {
      return {
        validateStatus: 'error' as const,
        help: filterState.validateMessage,
      };
    }
    return {};
  }, [filterState.validateMessage, filterState.validateStatus]);

  const statusMessage = useMemo(() => {
    if (filterState.validateStatus !== 'error') {
      return null;
    }
    return <StatusMessage>{filterState.validateMessage}</StatusMessage>;
  }, [filterState.validateMessage, filterState.validateStatus]);

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
          <Space key={index} size={4} style={{ width: '100%' }}>
            <RangePicker
              ref={index === 0 ? inputRef : undefined}
              size="small"
              allowEmpty={[true, true]}
              format="DD.MM.YYYY"
              style={{ flex: '1 1 auto' }}
              value={[
                period.start ? dayjs(period.start) : null,
                period.end ? dayjs(period.end) : null,
              ]}
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
        {hasIssues ? (
          <div role="alert" style={{ fontSize: 12, lineHeight: 1.4 }}>
            {errors.map(message => (
              <div key={message} style={{ color: '#e0433c' }}>
                {message}
              </div>
            ))}
            {warnings.map(message => (
              <div key={message} style={{ color: '#cc8a24' }}>
                {message}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {statusMessage}
    </FilterPluginStyle>
  );
}
