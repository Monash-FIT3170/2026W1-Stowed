import { useParams } from "react-router-dom";

export function StorageUnitDetailPage() {
  const { unitId } = useParams();

  return (
    <div style={{ padding: "24px" }}>
      <h2>Storage Unit: {unitId}</h2>

      {/* Photo section - wire up once DB has photo field */}
      <div style={{ width: "100%", maxWidth: "400px", background: "#eee", height: "250px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>No photo yet</p>
      </div>

      {/* Items inside this unit - wire up once subscribed to DB */}
      <h3 style={{ marginTop: "24px" }}>Items in this unit</h3>
      <p>Coming soon</p>
    </div>
  );
}