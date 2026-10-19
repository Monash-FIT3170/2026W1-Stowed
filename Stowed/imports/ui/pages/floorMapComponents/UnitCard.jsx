export function UnitCard({ unit, onClick }) {
  return (
    <button type="button" className="floor-map-unit-card" onClick={onClick}>
      <span
        className="floor-map-unit-swatch"
        style={{ backgroundColor: unit.fill }}
        aria-hidden="true"
      />
      <span className="floor-map-unit-name">{unit.name}</span>
      <span className="floor-map-unit-size">
        {unit.width.toFixed(2)} × {unit.height.toFixed(2)}m
      </span>
    </button>
  );
}
