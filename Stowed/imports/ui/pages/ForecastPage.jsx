import "../Global.css";

/**
 * FORECAST
 * Demand forecasting — predict future stock needs based on usage history.
 *
 * TODO for team:
 *  - Record stock adjustment events (consumption, restock) in a history collection
 *  - Calculate rolling average consumption rate per item
 *  - Project days-until-stockout for each item given current stock and consumption rate
 *  - Render a chart (e.g. Recharts) showing stock level over time vs reorder threshold
 *  - Surface items predicted to go below threshold in the next 7 / 14 / 30 days
 */

export function ForecastPage() {
  return (
    <div className="item-detail-container">
      <div className="item-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Tools</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Forecast</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Demand <em>Forecast</em></h1>
        </div>
      </div>
    </div>
  );
}