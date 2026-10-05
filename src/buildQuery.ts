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
import { GenericDataType } from '@apache-superset/core/common';
import { buildQueryContext, QueryFormData } from '@superset-ui/core';

/**
 * The filter does not aggregate data itself; the query only fetches the
 * MIN/MAX bounds of the configured column (same pattern as the calendar
 * filter) so the framework has a valid query to run per filter instance.
 */
export default function buildQuery(formData: QueryFormData) {
  const { groupby } = formData;
  const [column = ''] = groupby || [];
  // @ts-expect-error (need update interface Column )
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: [],
      metrics: [
        {
          aggregate: 'MIN',
          column: {
            column_name: column,
            id: 1,
            type_generic: GenericDataType.Temporal,
          },
          expressionType: 'SIMPLE',
          hasCustomLabel: true,
          label: 'min',
        },
        {
          aggregate: 'MAX',
          column: {
            column_name: column,
            id: 2,
            type_generic: GenericDataType.Temporal,
          },
          expressionType: 'SIMPLE',
          hasCustomLabel: true,
          label: 'max',
        },
      ],
    },
  ]);
}
