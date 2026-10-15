# Period Ranges Filter — плагин фильтра Apache Superset
---

### 🇷🇺 Русский | [🇬🇧 English](README.md)

---

> **Кастомный плагин Apache Superset**: Native Filter с **1–5 произвольными
> диапазонами дат** одинаковой длины — фильтрует все чарты в скоупе с
> корректной **OR**-семантикой и управляет чартом
> [Period Comparison](https://github.com/Kami-sama322/superset-plugin-chart-period-comparison).

---

## Возможности

- Native Filter для дашборда (не график)
- Самостоятельная сущность дашборда: добавляется через *Edit → + Add filter → Period ranges filter*, рендерится в фильтр-баре; не привязана к конкретному чарту
- Мультидиапазонная OR-фильтрация: таблицы и любые другие чарты в скоупе фильтруются по `range1 OR range2 OR …`. Штатные клаузы `TEMPORAL_RANGE` объединяются ядром через AND, поэтому фильтр эмитит одну тегированную adhoc-клаузу: `/* period_ranges:v1 */ (col >= 'S1' AND col <= 'E1 23:59:59.999999') OR (…)` — обе границы включительные, контракт совпадает с calendar-фильтром
- Саргибельная клауза: предикат остаётся дружественным к индексам (range-scan / BitmapOr), а пересекающиеся и примыкающие диапазоны сливаются в минимальный дизъюнктный набор перед эмиссией — OR-ветки не разрастаются лишними условиями
- Валидация равной длины: все диапазоны должны быть одной длительности (блокирует, ошибка inline); пересечения — предупреждение
- Чекбокс «Filter value is required»: запрещает применять фильтр, пока не выбран хотя бы один диапазон; без него пикеры можно удалять вплоть до нуля — пустой набор просто не фильтрует
- Structured-канал для Period Comparison chart: диапазоны дополнительно эмитятся в `extra_form_data.custom_form_data`, и пикеры чарта заменяются плашкой, когда фильтр в скоупе; маркер присутствия эмитится даже без выбранных диапазонов — «Clear all» не возвращает пикеры чарта, пока фильтр существует
- Скоуп — стандартный UI нативных фильтров (все чарты или выборочно)
- Поставляет Jinja-аддон (`jinja_addon/`), размечающий строки датасета выбранными периодами — стандартные Table / Pivot Table чарты могут агрегировать по периодам (см. [Jinja-аддон для виртуальных датасетов](#jinja-аддон-для-виртуальных-датасетов))

---

![Period ranges filter](images/chart_example.png)


## Требования

| Компонент | Версия |
|-----------|--------|
| Apache Superset | 6.1.0 |
| Python | 3.10+ |
| Node.js | 20+ (сборка образа: 22) |
| npm | 10+ |
| React (peer) | ^17.0.2 |
| npm-пакет | `@superset-ui/plugin-filter-period-ranges` |
| Ключ плагина | `period_ranges` |
| Зависимости | `dayjs` |
| Пара (опционально) | [`superset-plugin-chart-period-comparison`](https://github.com/Kami-sama322/superset-plugin-chart-period-comparison) |

---

## Установка

### Шаг 1. Клонировать репозиторий Superset нужной версии

```bash
git clone https://github.com/apache/superset.git -b 6.1.0;
```

### Шаг 2. Клонировать репозиторий плагина

```bash
git clone https://github.com/Kami-sama322/superset-plugin-filter-period-ranges.git;
```

### Шаг 3. Запустить скрипт автоустановки

```bash
chmod +x superset-plugin-filter-period-ranges/install.sh;
./superset-plugin-filter-period-ranges/install.sh ./superset;
```

> `./superset` — корень репозитория Superset из шага 1. Скрипт устанавливает плагин как **отдельный npm-пакет** в `superset-frontend/plugins/plugin-filter-period-ranges/` и регистрирует его в документированных точках расширения Superset. Скрипт идемпотентен (grep-якоря).

#### Что делает скрипт:

| Действие | Файл |
|----------|------|
| 0. Копирует пакет плагина | `superset-frontend/plugins/plugin-filter-period-ranges/` |
| 1. Регистрирует плагин | `superset-frontend/src/setup/setupPluginsExtra.ts` (`key: period_ranges`) |
| 2. Добавляет path alias | `superset-frontend/tsconfig.json` |
| 3. Регистрирует тип фильтра | `FILTER_SUPPORTED_TYPES` → `period_ranges: [GenericDataType.Temporal]` |

> В отличие от chart-плагинов Native Filter **требует** собственный path alias в `tsconfig.json` и запись в `FILTER_SUPPORTED_TYPES` (`FiltersConfigForm/constants.ts`) — без неё фильтр недоступен в списке «Add filter».

---

### Шаг 4б. Ручная регистрация плагина (если install.sh не сработал)

#### 1. Скопировать пакет в каталог plugins

```bash
mkdir -p superset-frontend/plugins/plugin-filter-period-ranges/src
cp -r superset-plugin-filter-period-ranges/src/. superset-frontend/plugins/plugin-filter-period-ranges/src/
cp superset-plugin-filter-period-ranges/package.json superset-frontend/plugins/plugin-filter-period-ranges/package.json
cp superset-plugin-filter-period-ranges/tsconfig.json superset-frontend/plugins/plugin-filter-period-ranges/tsconfig.json
```

#### 2. Зарегистрировать в `superset-frontend/src/setup/setupPluginsExtra.ts`

```typescript
import PeriodRangesFilterPlugin from '@superset-ui/plugin-filter-period-ranges';

export default function setupPluginsExtra() {
  new PeriodRangesFilterPlugin()
    .configure({ key: 'period_ranges' })
    .register();
}
```

> Дополнительно добавьте path alias `@superset-ui/plugin-filter-period-ranges` в `superset-frontend/tsconfig.json` и `period_ranges: [GenericDataType.Temporal]` в `FILTER_SUPPORTED_TYPES` (`src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/constants.ts`).

Затем выполните `npm install` и `npm run dev-server`.

---

## Запуск Superset в режиме разработки

### Шаг 5. Python-окружение

```bash
cd superset
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/development.txt
```

### Шаг 6. Конфигурация

Скопируйте или сделайте symlink на `superset_config.py` из этого репозитория, либо укажите:

```bash
export SUPERSET_CONFIG_PATH=/path/to/superset-plugin-filter-period-ranges/superset_config.py
```

Плагин не подгружает внешних ресурсов — CSP-исключения не требуются. `superset_config.py` из репозитория нужен только для удобной dev-среды (DEBUG, флаги `DASHBOARD_NATIVE_FILTERS` / `DASHBOARD_CROSS_FILTERING`) и уже подключает Jinja-аддон `jinja_addon/` (см. [Jinja-аддон для виртуальных датасетов](#jinja-аддон-для-виртуальных-датасетов)).

### Шаги 7–10. База данных и администратор

```bash
superset db upgrade
superset fab create-admin \
  --username admin --firstname Admin --lastname User \
  --email admin@example.com --password admin
superset init
```

### Шаги 11–13. Backend и frontend

```bash
# терминал 1 — backend
superset run -h 0.0.0.0 -p 8088 --with-threads --reload --debugger

# терминал 2 — frontend (после install.sh + npm install в superset-frontend)
cd superset-frontend
npm install
npm run dev-server
```

---

## Быстрый старт через Docker

В репозитории есть автономный стенд: `Dockerfile` собирает Superset **6.1.0**
с уже встроенным плагином; `docker-compose.yml` монтирует `superset_config.py`
(dev-конфиг) read-only.

**Нужно:** Docker, Docker Compose v2, ~8 GB RAM на сборку фронтенда.

```bash
git clone https://github.com/Kami-sama322/superset-plugin-filter-period-ranges.git
cd superset-plugin-filter-period-ranges

docker compose build    # первый раз: клон Superset 6.1.0 + npm run build (15–40 мин)
docker compose up -d    # init БД, admin/admin, load-examples при первом запуске
```

Открыть **http://localhost:8088** → вход **admin** / **admin**.

При первом запуске контейнер выполняет `superset db upgrade`, создаёт админа
и загружает примеры датасетов (1–3 мин). Повторные запуски пропускают init,
если том сохранён.

**Сброс окружения** (чистая БД и примеры):

```bash
docker compose down -v
docker compose up -d
```

**Проверка фильтра:** Dashboard → Edit → + Add filter → **Period ranges filter**;
в конфигурации фильтра выберите датасет и temporal-колонку.

---

## Как использовать фильтр

1. **Dashboard → Edit dashboard → + Add filter → Period ranges filter**
2. В конфигурации фильтра выберите датасет и **Date column** (temporal-колонку) — диапазоны будут применяться к ней на всех чартах в скоупе
3. На панели фильтра добавьте **1–5 диапазонов дат** одинаковой длины (выбор по датам; последний день включается). Неравные длины блокируют применение с inline-ошибкой; пересечения дают предупреждение
4. Опционально включите **Filter value is required** — тогда фильтр нельзя применить, пока не выбран хотя бы один диапазон
5. Настройте **скоуп** фильтра (все чарты или выборочно) и примените конфигурацию
6. Для управления чартом [Period Comparison](https://github.com/Kami-sama322/superset-plugin-chart-period-comparison) добавьте его на дашборд и включите в скоуп фильтра — он перейдёт под управление фильтра автоматически

### Контракт передачи (для авторов плагинов)

Полезная нагрузка `setDataMask`:

```ts
extraFormData: {
  filters: [],                       // не используется — simple clauses AND-ятся
  adhoc_filters: [{                  // тегированная OR-клауза
    clause: 'WHERE', expressionType: 'SQL',
    sqlExpression: "/* period_ranges:v1 */ (col >= 'S' AND col <= 'E 23:59:59.999999') OR …",
  }],
  custom_form_data: [                // structured-диапазоны (comparison chart)
    { col, start, end }, …           // ISO 8601 UTC, включительные границы
  ],
},
filterState: { value: '2026-01-05 00:00:00 : 2026-02-07 00:00:00' },
```

- `adhoc_filters` — APPEND-ключ (`buildQueryObject` конкатенирует): клауза OR-семантики доезжает до любых чартов, не конфликтуя со штатными AND-объединениями `TEMPORAL_RANGE`
- `custom_form_data` — APPEND-ключ, доезжает до `QueryObject` и `rawFormData.extra_form_data.custom_form_data` comparison chart
- Пустое/невалидное состояние очищает фильтр (семантика `NO_TIME_RANGE`), а `custom_form_data` несёт **маркер присутствия** `[{col}]` — comparison chart в скоупе скрывает свои пикеры сразу
- Колонка (`groupby`) попадает в SQL-строку as-is после проверки `isSafeSqlColumn`; небезопасное имя деградирует маску до маркера присутствия, UI показывает warning

---

## Jinja-аддон для виртуальных датасетов

Стандартные чарты Table / Pivot Table не умеют строить «одну строку на период»:
фильтр доезжает до них только как WHERE-клауза, которая режет строки, но не
размечает их. В репозитории есть Jinja-аддон — `jinja_addon/`: он читает
structured-канал фильтра (`custom_form_data`) на бэкенде и возвращает
CASE-выражение, размечающее каждую строку покрывающим её периодом, поэтому
Table-чарт с dimension = `period` агрегирует строки **по периодам**, а метрики
(`count(*)`, `sum(...)`, `max(...)`) идут колонками.

**Требуется** флаг `ENABLE_TEMPLATE_PROCESSING`.

### Установка

1. Скопируйте `jinja_addon/` рядом с вашим `superset_config.py` (для Docker-стенда:
   смонтируйте в `/app/pythonpath/jinja_addon`).
2. В `superset_config.py`:

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jinja_addon.period_ranges import JINJA_CONTEXT_ADDONS as PERIOD_RANGES_ADDONS

FEATURE_FLAGS = {
    # ...
    "ENABLE_TEMPLATE_PROCESSING": True,
}
JINJA_CONTEXT_ADDONS = {**PERIOD_RANGES_ADDONS}
```

Собственный `superset_config.py` репозитория уже подключён таким образом, а
Docker-стенд монтирует `jinja_addon/` автоматически.

### Макросы

| Макрос | Возвращает |
|--------|------------|
| `period_ranges('ts')` | `CASE WHEN ts >= 'S' AND ts <= 'E 23:59:59.999999' THEN 'S – E' … ELSE NULL END` — метка периода для каждой строки; пустой фильтр → `NULL` |
| `period_ranges_where('ts')` | `(ts >= 'S' AND ts <= 'E 23:59:59.999999') OR …` — WHERE-фрагмент для заталкивания фильтра в подзапрос (оконные функции); пустой фильтр → `''` |

Аргумент должен посимвольно совпадать с **колонкой, выбранной в конфигурации
фильтра** (сравнение с `custom_form_data.col`). Границы повторяют
инклюзивный конец маски фильтра (`col <= 'E 23:59:59.999999'`, т.е.
`snapEndExclusiveMs(end, "day")` минус последняя микросекунда), поэтому CASE
всегда согласован с tagged OR-клаузой; `mergeRanges` гарантирует, что каждая
строка попадает ровно в одну ветку. Работает любая допустимая фильтром длина
периода (день и крупнее — пикеры date-only).

### Пример виртуального датасета

```sql
{% set _ = cache_key_wrapper(period_ranges_where('ts')) %}
WITH FOR_FILTERS AS (
    Select *
        , {{ period_ranges('ts') }} AS period
    from main.messages
    where 1=1
    {% if period_ranges_where('ts') %}
      AND ({{ period_ranges_where('ts') }})
    {% endif %}
)

SELECT
* FROM FOR_FILTERS
```

- Table-чарт: dimension = `period`, метрики = `count(*)`, `sum(...)`, `max(...)`.
- Строка `cache_key_wrapper` **обязательна**: проход сбора кэш-ключей знает
  только встроенные имена макросов — без неё разные выборы фильтра попадают
  в один закэшированный результат.
- Пустой фильтр → все метки `NULL` → одна строка «N/A» с итогом по всей таблице
  (фильтр не применён); с чекбоксом **Filter value is required** это состояние
  заблокировано.

---

## Структура пакета

```
superset-plugin-filter-period-ranges/
├── README.md
├── README.ru.md
├── src/
│   ├── index.ts                       # ChartPlugin, key period_ranges
│   ├── PeriodRangesFilterPlugin.tsx   # пикеры + setDataMask
│   ├── mask.ts                        # tagged OR-клауза + custom_form_data
│   ├── buildQuery.ts                  # MIN/MAX колонки
│   ├── transformProps.ts
│   ├── types.ts / common.ts / controlPanel.ts
│   ├── images/thumbnail.png
│   └── *.test.ts
├── jinja_addon/                      # Jinja-аддон для виртуальных датасетов
│   ├── __init__.py
│   └── period_ranges.py              # макросы period_ranges / period_ranges_where
├── scripts/                        # standalone test runner (node strip-types)
├── package.json
├── install.sh
├── Dockerfile                      # Superset 6.1.0 + production-сборка плагина
├── docker-compose.yml              # локальный demo-стенд
└── superset_config.py              # конфиг dev/Docker
```

---

## Лицензия

Apache License 2.0 (как у Superset)
