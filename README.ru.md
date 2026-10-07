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
- Мультидиапазонная OR-фильтрация: таблицы и любые другие чарты в скоупе фильтруются по `range1 OR range2 OR …`. Штатные клаузы `TEMPORAL_RANGE` объединяются ядром через AND, поэтому фильтр эмитит одну тегированную adhoc-клаузу: `/* period_ranges:v1 */ (col >= 'S1' AND col < 'E1') OR (…)`
- Саргибельная клауза: предикат остаётся дружественным к индексам (range-scan / BitmapOr), а пересекающиеся и примыкающие диапазоны сливаются в минимальный дизъюнктный набор перед эмиссией — OR-ветки не разрастаются лишними условиями
- Валидация равной длины: все диапазоны должны быть одной длительности (блокирует, ошибка inline); пересечения — предупреждение
- Чекбокс «Filter value is required»: запрещает применять фильтр, пока не выбран хотя бы один диапазон; без него пикеры можно удалять вплоть до нуля — пустой набор просто не фильтрует
- Structured-канал для Period Comparison chart: диапазоны дополнительно эмитятся в `extra_form_data.custom_form_data`, и пикеры чарта заменяются плашкой, когда фильтр в скоупе; маркер присутствия эмитится даже без выбранных диапазонов — «Clear all» не возвращает пикеры чарта, пока фильтр существует
- Скоуп — стандартный UI нативных фильтров (все чарты или выборочно)

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

Плагин не подгружает внешних ресурсов — CSP-исключения не требуются. `superset_config.py` из репозитория нужен только для удобной dev-среды (DEBUG, флаги `DASHBOARD_NATIVE_FILTERS` / `DASHBOARD_CROSS_FILTERING`).

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
    sqlExpression: "/* period_ranges:v1 */ (col >= 'S' AND col < 'E') OR …",
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
