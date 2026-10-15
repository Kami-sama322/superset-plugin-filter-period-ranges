"""Jinja-макросы для датасетов, работающих с native-фильтром period_ranges.

Читают structured-канал фильтра — extra_form_data.custom_form_data
([{col, start, end}, ...], start/end включительно, ISO 8601 UTC), который
доезжает до бэкенда в queries[0] каждого запроса чарта.

    period_ranges(col)       -> CASE «строка -> метка периода»;
                                пустой фильтр -> NULL
    period_ranges_where(col) -> "(col >= S AND col <= E) OR ..."; пустой
                                фильтр -> '' (удобно для {% if %})

Верхняя граница ветки — инклюзивная (контракт col <= end, последний
момент конечного дня), синхронно с buildTaggedRangesClause в src/mask.ts,
поэтому макросы всегда согласованы с tagged OR-клаузой фильтра при любой
длине периода (день и крупнее; пикеры фильтра date-only). mergeRanges
гарантирует непересечение диапазонов — каждая строка попадает ровно в
одну ветку CASE.

Все импорты superset.* — ленивые (внутри функций): конфиг исполняется
до инициализации приложения, тяжёлые импорты верхнего уровня дали бы
циркулярный импорт.

Подключение (в superset_config.py; каталог, где лежит jinja_addon/,
должен быть в sys.path — рядом с конфигом он туда добавляется явно):

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from jinja_addon.period_ranges import JINJA_CONTEXT_ADDONS

    JINJA_CONTEXT_ADDONS = {**JINJA_CONTEXT_ADDONS}

Требуется флаг ENABLE_TEMPLATE_PROCESSING.
"""
import re
from datetime import datetime, timedelta

# Формат, который эмитит плагин: toIso(...) -> ISO 8601 UTC
_PERIOD_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$")
# Тот же контракт, что isSafeSqlColumn в src/mask.ts
_PERIOD_COLUMN_RE = re.compile(
    r"^[A-Za-z_][A-Za-z0-9_$]*(?:\.[A-Za-z_][A-Za-z0-9_$]*)*$"
)


def _period_bounds(column: str) -> list:
    """custom_form_data фильтра -> [(start_dt, end_inclusive_dt)] по колонке.

    Возвращает [] для пустого фильтра (маркер присутствия [{col}] без дат)
    или если в маске нет записей для этой колонки.

    Верхняя граница — инклюзивная, последний момент (микросекунда) конечного
    дня («2026-01-10 23:59:59.999999»), синхронно с
    buildTaggedRangesClause в src/mask.ts (контракт col <= end).
    """
    from superset.views.utils import get_form_data

    form_data, _ = get_form_data()
    entries = form_data.get("custom_form_data") or (
        form_data.get("extra_form_data", {}).get("custom_form_data") or []
    )

    bounds = []
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict) or entry.get("col") != column:
            continue

        start, end = entry.get("start"), entry.get("end")
        if not (
            start
            and end
            and _PERIOD_DATE_RE.match(str(start))
            and _PERIOD_DATE_RE.match(str(end))
        ):
            continue  # маркер присутствия / мусор — ветку не строим

        start_dt = datetime.fromisoformat(str(start).replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(str(end).replace("Z", "+00:00"))
        end_day = end_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_exclusive = end_day if end_dt == end_day else end_day + timedelta(days=1)
        bounds.append((start_dt, end_exclusive - timedelta(microseconds=1)))

    return bounds


def period_ranges(column: str) -> str:
    """CASE-выражение «строка -> метка периода»; пустой фильтр -> NULL.

    Аргумент column должен посимвольно совпадать с колонкой, выбранной
    в конфигурации фильтра (сравнение с custom_form_data.col).
    """
    from superset.exceptions import SupersetTemplateException

    if not _PERIOD_COLUMN_RE.match(column or ""):
        raise SupersetTemplateException(f"Unsafe column name: {column!r}")

    branches = [
        f"WHEN {column} >= '{s:%Y-%m-%d %H:%M:%S}' "
        f"AND {column} <= '{e:%Y-%m-%d %H:%M:%S}.999999' "
        f"THEN '{s:%Y-%m-%d} – {e:%Y-%m-%d}'"
        for s, e in _period_bounds(column)
    ]
    if not branches:
        return "NULL"

    return "CASE " + " ".join(branches) + " ELSE NULL END"


def period_ranges_where(column: str) -> str:
    """WHERE-фрагмент "(col >= S AND col <= E) OR ..."; пустой фильтр -> ''.

    Для заталкивания период-фильтра внутрь подзапроса виртуального
    датасета (шаблон FOR_FILTERS + оконные функции): оконные функции
    должны считаться по отфильтрованным данным, а tagged OR-клауза
    применяется ядром только в верхнем WHERE. Дублирование клаузы
    (внутри + снаружи) безвредно — предикат идемпотентный и саргибельный.
    """
    from superset.exceptions import SupersetTemplateException

    if not _PERIOD_COLUMN_RE.match(column or ""):
        raise SupersetTemplateException(f"Unsafe column name: {column!r}")

    return " OR ".join(
        f"({column} >= '{s:%Y-%m-%d %H:%M:%S}' AND {column} <= '{e:%Y-%m-%d %H:%M:%S}.999999')"
        for s, e in _period_bounds(column)
    )


# Готовый словарь для superset_config.py:
JINJA_CONTEXT_ADDONS = {
    "period_ranges": period_ranges,
    "period_ranges_where": period_ranges_where,
}
