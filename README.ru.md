# Period Ranges Filter (Фильтр периодов) — Native Filter для Apache Superset

Native filter плагин для **Apache Superset 6.1.0**: 1–5 произвольных
диапазонов дат одинаковой длины, фильтрующий все чарты в скоупе с корректной
**OR**-семантикой, и управляющий
[Period Comparison chart](https://github.com/Kami-sama322/superset-plugin-chart-period-comparison).

![Period ranges filter](src/images/thumbnail.png)

## Возможности

- **Самостоятельная сущность дашборда** — добавляется через *Edit →
  + Add filter → Period ranges filter*, рендерится в фильтр-баре;
  не привязана к конкретному чарту.
- **Мультидиапазонная OR-фильтрация** — таблицы и любые другие чарты в
  скоупе фильтруются по `range1 OR range2 OR …`. Штатные клаузы
  `TEMPORAL_RANGE` объединяются через AND, поэтому фильтр эмитит одну
  тегированную adhoc-клаузу: `/* period_ranges:v1 */ (col >= 'S1' AND col < 'E1') OR (…)`.
- **Валидация равной длины** — все диапазоны должны быть одной
  длительности (блокирует, ошибка inline); пересечения — предупреждение;
  минимум один пикер остаётся.
- **Structured-канал для Period Comparison chart** — диапазоны дополнительно
  эмитятся в `extra_form_data.custom_form_data`; comparison chart забирает
  их (пикеры заменяются плашкой «Periods from filter», когда фильтр в скоупе).
- **Скоуп** — стандартный UI нативных фильтров (все чарты или выборочно).

## Требования

- Apache Superset **6.1.0**, Node.js 22.
- Для интеграции с comparison-чартом установите рядом
  `superset-plugin-chart-period-comparison` (обе стороны контракта
  идут парой).

## Установка

```bash
./install.sh /path/to/superset
cd /path/to/superset/superset-frontend
npm install
npm run dev-server
```

`install.sh` идемпотентен: копирует пакет в
`plugins/plugin-filter-period-ranges/`, регистрирует key `period_ranges`
в `setupPluginsExtra.ts`, добавляет tsconfig path alias и
`FILTER_SUPPORTED_TYPES.period_ranges = [Temporal]`.

Проверка: **Dashboard → Edit → + Add filter → Period ranges filter**;
в конфигурации фильтра выберите датасет и temporal-колонку.

## Контракт передачи (для авторов плагинов)

Полезная нагрузка `setDataMask`:

```ts
extraFormData: {
  filters: [],                       // не используется — simple clauses AND-ятся
  adhoc_filters: [{                  // тегированная OR-клауза
    clause: 'WHERE', expressionType: 'SQL',
    sqlExpression: "/* period_ranges:v1 */ (col >= 'S' AND col < 'E') OR …",
  }],
  custom_form_data: [                // structured-диапазоны (comparison chart)
    { col, start, end }, …           // ISO 8601 UTC, включительные границы
  ],
},
filterState: { value: '2026-01-05 00:00:00 : 2026-02-07 00:00:00' },
```

Пустое состояние очищает фильтр (семантика `NO_TIME_RANGE`).

## Тесты

Standalone (без Jest/npm install, Node ≥ 22.6):

```bash
node --experimental-strip-types scripts/run-tests.mjs
```

Внутри дерева фронтенда Superset те же тесты идут под Jest.
Покрыто: сборка маски (тегированная клауза, custom_form_data, очистка).

## Лицензия

Apache-2.0
