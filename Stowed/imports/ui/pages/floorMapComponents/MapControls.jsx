import { FloorMapIcon } from "./FloorMapIcon";

export function MapSelectors({
  sites,
  floorMaps,
  currentSite,
  currentFloorMap,
  onSiteChange,
  onFloorMapChange,
  context = "staff",
}) {
  const siteMaps = floorMaps.filter((map) => map.siteId === currentSite?._id);
  return (
    <div className={`floor-map-selectors floor-map-selectors--${context}`}>
      <label className="floor-map-field">
        <span>Site</span>
        <select
          value={currentSite?._id ?? ""}
          onChange={(event) => onSiteChange(event.target.value)}
          aria-label="Select site"
        >
          {sites.map((site) => (
            <option key={site._id} value={site._id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      {siteMaps.length > 1 && (
        <label className="floor-map-field">
          <span>Floor map</span>
          <select
            value={currentFloorMap?._id ?? ""}
            onChange={(event) => onFloorMapChange(event.target.value)}
            aria-label="Select floor map"
          >
            {siteMaps.map((map) => (
              <option key={map._id} value={map._id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function MapState({ loading, title, description }) {
  return (
    <div className="floor-map-state" role={loading ? "status" : undefined}>
      {loading && <span className="floor-map-spinner" aria-hidden="true" />}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function EditorTabs({ activeTab, onChange }) {
  return (
    <div className="floor-map-tabs" role="tablist" aria-label="Editor tools">
      {[
        { id: "units", label: "Storage Units", icon: "units" },
        { id: "templates", label: "Templates", icon: "templates" },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`floor-map-tab-${tab.id}`}
          aria-controls={`floor-map-tabpanel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              const next = activeTab === "units" ? "templates" : "units";
              onChange(next);
              event.currentTarget.parentElement?.querySelector(`#floor-map-tab-${next}`)?.focus();
            }
          }}
        >
          <FloorMapIcon name={tab.icon} size={17} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
