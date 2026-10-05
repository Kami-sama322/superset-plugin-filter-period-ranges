#!/usr/bin/env bash
# =============================================================================
#  Установка нативного фильтра «Period ranges» в Apache Superset 6.1.0
# =============================================================================
#
#  Использование:
#     ./install.sh <путь-к-корню-superset>
#
#  Плагин устанавливается как полноценный npm-пакет в
#  `superset-frontend/plugins/plugin-filter-period-ranges/`.
#
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

if [ "$#" -ne 1 ]; then
  error "Укажите путь к корню репозитория Superset:"
  echo "   $0 ./superset"
  exit 1
fi
SUPERSET_DIR="$(cd "$1" && pwd)"
FRONTEND_DIR="$SUPERSET_DIR/superset-frontend"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC_DIR="$SCRIPT_DIR/src"

PKG_DIR="$FRONTEND_DIR/plugins/plugin-filter-period-ranges"
EXTRA_FILE="$FRONTEND_DIR/src/setup/setupPluginsExtra.ts"
TSCONFIG_FILE="$FRONTEND_DIR/tsconfig.json"
TYPES_FILE="$FRONTEND_DIR/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/constants.ts"

echo ""
echo -e "${GREEN}==============================================================${NC}"
echo -e "${GREEN}  Period Ranges Filter Plugin → Apache Superset${NC}"
echo -e "${GREEN}  Установка пакета + регистрация в точках расширения${NC}"
echo -e "${GREEN}==============================================================${NC}"
echo ""

if [ ! -d "$FRONTEND_DIR" ]; then
  error "Каталог superset-frontend не найден: $FRONTEND_DIR"
  exit 1
fi
if [ ! -d "$PLUGIN_SRC_DIR" ]; then
  error "Каталог с исходниками плагина не найден: $PLUGIN_SRC_DIR"
  exit 1
fi

info "Шаг 0/3: копирую пакет плагина в $PKG_DIR"
mkdir -p "$PKG_DIR/src"
cp -r "$PLUGIN_SRC_DIR/." "$PKG_DIR/src/"
cp "$SCRIPT_DIR/package.json" "$PKG_DIR/package.json"
cp "$SCRIPT_DIR/tsconfig.json" "$PKG_DIR/tsconfig.json"
ok "Пакет скопирован (src/, package.json, tsconfig.json). npm workspace свяжет его при 'npm ci'."

if [ ! -f "$EXTRA_FILE" ]; then
  error "Файл точки расширения не найден: $EXTRA_FILE"
  exit 1
fi

if grep -q "@superset-ui/plugin-filter-period-ranges" "$EXTRA_FILE"; then
  warn "Импорт плагина уже есть в $EXTRA_FILE"
else
  info "Шаг 1/3: регистрирую плагин в setupPluginsExtra.ts"
  sed -i "/^\/\/ For individual deployments to add custom overrides$/i import PeriodRangesFilterPlugin from '@superset-ui/plugin-filter-period-ranges';" "$EXTRA_FILE"
  ok "Импорт добавлен в $EXTRA_FILE"
fi

if grep -q "PeriodRangesFilterPlugin().configure" "$EXTRA_FILE"; then
  warn "Регистрация плагина уже есть в $EXTRA_FILE"
elif grep -q "export default function setupPluginsExtra() {}" "$EXTRA_FILE"; then
  sed -i "s/export default function setupPluginsExtra() {}/export default function setupPluginsExtra() {\n  new PeriodRangesFilterPlugin().configure({ key: 'period_ranges' }).register();\n}/" "$EXTRA_FILE"
  ok "Регистрация (configure + register) добавлена"
elif grep -q "export default function setupPluginsExtra() {" "$EXTRA_FILE"; then
  sed -i "/export default function setupPluginsExtra() {/a\\  new PeriodRangesFilterPlugin().configure({ key: 'period_ranges' }).register();" "$EXTRA_FILE"
  ok "Регистрация (configure + register) добавлена в непустую функцию"
else
  error "Не удалось найти setupPluginsExtra() — зарегистрируйте плагин вручную:"
  echo "  import PeriodRangesFilterPlugin from '@superset-ui/plugin-filter-period-ranges';"
  echo "  new PeriodRangesFilterPlugin().configure({ key: 'period_ranges' }).register();"
  exit 1
fi

if [ ! -f "$TSCONFIG_FILE" ]; then
  error "Файл tsconfig.json не найден: $TSCONFIG_FILE"
  exit 1
fi

if grep -q "plugin-filter-period-ranges" "$TSCONFIG_FILE"; then
  warn "Путь @superset-ui/plugin-filter-period-ranges уже есть в tsconfig.json"
else
  info "Шаг 2/3: добавляю path alias в tsconfig.json"
  sed -i 's|^\([[:space:]]*\)"@superset-ui/plugin-chart-\*":[[:space:]]*\["\./plugins/plugin-chart-\*/src"\],$|\1"@superset-ui/plugin-chart-*": ["./plugins/plugin-chart-*/src"],\n\1"@superset-ui/plugin-filter-period-ranges": ["./plugins/plugin-filter-period-ranges/src"],|' "$TSCONFIG_FILE"
  if grep -q "plugin-filter-period-ranges" "$TSCONFIG_FILE"; then
    ok "Path alias добавлен в tsconfig.json"
  else
    error "Не удалось найти строку-якорь в tsconfig.json — добавьте path вручную."
  fi
fi

if [ ! -f "$TYPES_FILE" ]; then
  error "Файл FiltersConfigForm/constants.ts не найден: $TYPES_FILE"
  exit 1
fi

if grep -q "period_ranges" "$TYPES_FILE"; then
  warn "Запись period_ranges уже есть в FILTER_SUPPORTED_TYPES"
else
  info "Шаг 3/3: добавляю period_ranges в FILTER_SUPPORTED_TYPES"
  sed -i 's|^\([[:space:]]*\)filter_timegrain: \[GenericDataType\.Temporal\],$|\1filter_timegrain: [GenericDataType.Temporal],\n\1period_ranges: [GenericDataType.Temporal],|' "$TYPES_FILE"
  if grep -q "period_ranges" "$TYPES_FILE"; then
    ok "Запись period_ranges добавлена в FILTER_SUPPORTED_TYPES"
  else
    error "Не удалось найти строку-якорь в constants.ts — добавьте запись вручную."
  fi
fi

echo ""
echo -e "${GREEN}==============================================================${NC}"
echo -e "${GREEN}Плагин установлен.${NC}"
echo ""
echo -e "${CYAN}Дальнейшие шаги:${NC}"
echo -e "  ${CYAN}1.${NC} cd superset-frontend && npm install    # workspace свяжет плагин"
echo -e "  ${CYAN}2.${NC} npm run dev-server                     # режим разработки"
echo -e "  ${CYAN}3.${NC} В дашборде: Edit → + Add filter → Period ranges filter"
echo -e "${GREEN}==============================================================${NC}"
