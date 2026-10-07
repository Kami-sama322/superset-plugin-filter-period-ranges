import os
import sys

# ---------------------------------------------------------------------------
# Jinja-аддон jinja_addon/period_ranges.py: макросы period_ranges(col) /
# period_ranges_where(col) для виртуальных датасетов — метка периода
# period_ranges-фильтра в каждой строке (см. раздел «Jinja addon» в README).
# Суперсет грузит конфиг через importlib по пути и каталог конфига в
# sys.path сам не добавляет — добавляем явно, чтобы импортировать пакет.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jinja_addon.period_ranges import JINJA_CONTEXT_ADDONS as _PERIOD_RANGES_ADDONS

DEBUG = True
LOG_LEVEL = "DEBUG"

TEMPLATES_AUTO_RELOAD = True

ALLOWED_EXTENSIONS = {"csv", "tsv", "txt", "json"}
ALLOW_DATA_UPLOAD = True

ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": {"*": {"origins": "*"}},
}

PREVENT_UNSAFE_DB_CONNECTIONS = False

WTF_CSRF_ENABLED = False

FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERING": True,
    "ALLOW_DATA_UPLOAD": True,
}

SUPERSET_WEBSERVER_TIMEOUT = 300

JINJA_CONTEXT_ADDONS = {**_PERIOD_RANGES_ADDONS}
