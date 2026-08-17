export const DASHBOARD_WIDGET_CATALOG = [
  { id: "snapshot", label: "Inventory snapshot" },
  { id: "stocktake", label: "Stocktake attention" },
  { id: "low-stock", label: "Low stock" },
  { id: "recent", label: "Recent activity" },
];

export const DEFAULT_DASHBOARD_WIDGET_ORDER = DASHBOARD_WIDGET_CATALOG.map((widget) => widget.id);

const DASHBOARD_WIDGET_IDS = new Set(DEFAULT_DASHBOARD_WIDGET_ORDER);

export function normalizeDashboardPreferences(value) {
  const requestedOrder = Array.isArray(value?.order) ? value.order : [];
  const requestedHidden = Array.isArray(value?.hidden) ? value.hidden : [];
  const order = [];

  for (const widgetId of requestedOrder) {
    if (DASHBOARD_WIDGET_IDS.has(widgetId) && !order.includes(widgetId)) {
      order.push(widgetId);
    }
  }

  for (const widgetId of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!order.includes(widgetId)) order.push(widgetId);
  }

  return {
    order,
    hidden: [...new Set(requestedHidden.filter((widgetId) => DASHBOARD_WIDGET_IDS.has(widgetId)))],
  };
}

export function reorderDashboardWidgets(order, sourceId, targetId) {
  const nextOrder = [...order];
  const sourceIndex = nextOrder.indexOf(sourceId);
  const targetIndex = nextOrder.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return nextOrder;

  const [movedWidget] = nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, movedWidget);
  return nextOrder;
}

export function isDefaultDashboardPreferences(preferences) {
  const normalized = normalizeDashboardPreferences(preferences);
  return (
    normalized.hidden.length === 0 &&
    normalized.order.every((widgetId, index) => widgetId === DEFAULT_DASHBOARD_WIDGET_ORDER[index])
  );
}
