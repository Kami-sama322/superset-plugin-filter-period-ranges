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
import { Behavior, DataRecord, FilterState, QueryFormData, SetDataMaskHook, JsonObject } from '@superset-ui/core';
import { RefObject } from 'react';
import type { PeriodRange } from './periods';

export enum FilterBarOrientation {
  Vertical = 'VERTICAL',
  Horizontal = 'HORIZONTAL',
}

export interface PluginFilterStylesProps {
  height: number;
  width: number;
  orientation?: FilterBarOrientation;
  overflow?: boolean;
}

export interface PluginFilterHooks {
  setDataMask: SetDataMaskHook;
  setFocusedFilter: () => void;
  unsetFocusedFilter: () => void;
  setHoveredFilter: () => void;
  unsetHoveredFilter: () => void;
  setFilterActive: (isActive: boolean) => void;
}

export interface PluginFilterPeriodRangesCustomizeProps {
  enableEmptyFilter?: boolean;
}

export type PluginFilterPeriodRangesQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterPeriodRangesCustomizeProps;

export type PluginFilterPeriodRangesProps = PluginFilterStylesProps & {
  behaviors: Behavior[];
  data: DataRecord[];
  filterState: FilterState;
  formData: PluginFilterPeriodRangesQueryFormData;
  inputRef: RefObject<HTMLInputElement>;
  /** Persisted picker state (restored after dashboard reloads) */
  ownState: JsonObject;
  filterBarOrientation?: FilterBarOrientation;
  isOverflowingFilterBar?: boolean;
} & PluginFilterHooks;

export type { PeriodRange };

export const DEFAULT_FORM_DATA: PluginFilterPeriodRangesCustomizeProps = {
  enableEmptyFilter: false,
};
