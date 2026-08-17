import { useId } from "react";
import "./DashboardWidget.css";

export function DashboardWidget({ title, subtitle, action, children, className = "" }) {
  const titleId = useId();

  return (
    <section
      className={`dashboard-widget${className ? ` ${className}` : ""}`}
      aria-labelledby={titleId}
    >
      <header className="dashboard-widget-header">
        <div>
          <h2 id={titleId} className="dashboard-widget-title">
            {title}
          </h2>
          {subtitle && <p className="dashboard-widget-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="dashboard-widget-action">{action}</div>}
      </header>
      <div className="dashboard-widget-content">{children}</div>
    </section>
  );
}
