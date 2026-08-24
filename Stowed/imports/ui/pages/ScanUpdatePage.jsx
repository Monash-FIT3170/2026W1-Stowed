import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Products, ProductRecords } from "../../api/products/collections";
import { Sites, FloorMaps, StorageUnits, StorageLocations } from "../../api/locations/collections";
import { ProductThumbnail } from "../components/ProductThumbnail";
import { useIsDesktop } from "../hooks/deviceDimension";
import "../Global.css";
import "./ScanUpdatePage.css";

/**
 * Quick stock update after scanning a product barcode. This is the hand-held
 * screen: picture, name, location, current quantity, [-] [+] and Save. After
 * saving it asks whether to open the full product details.
 *
 * Laptop-width visitors are redirected to the product editing page instead,
 * which is what the client asked for on desktop.
 */
export function ScanUpdatePage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const { loading, product, records, storageLocations, storageUnits, floorMaps, sites } =
    useTracker(() => {
      const p = Meteor.subscribe("products");
      const r = Meteor.subscribe("productRecords");
      const l = Meteor.subscribe("locations.all");
      return {
        loading: !p.ready() || !r.ready() || !l.ready(),
        product: Products.findOne(productId),
        records: ProductRecords.find({ productId }, { sort: { quantity: -1 } }).fetch(),
        storageLocations: StorageLocations.find().fetch(),
        storageUnits: StorageUnits.find().fetch(),
        floorMaps: FloorMaps.find().fetch(),
        sites: Sites.find().fetch(),
      };
    }, [productId]);

  // Location options: largest stock first (that's the default).
  const locationOptions = useMemo(
    () =>
      records.map((record) => {
        const loc = storageLocations.find((l) => l._id === record.locationId);
        const unit = loc ? storageUnits.find((u) => u._id === loc.storageUnitId) : null;
        const map = unit ? floorMaps.find((f) => f._id === unit.floorMapId) : null;
        const site = map ? sites.find((s) => s._id === map.siteId) : null;
        return {
          locationId: record.locationId,
          quantity: record.quantity,
          label:
            [site?.name, map?.name, unit?.name, loc?.name].filter(Boolean).join(" → ") ||
            record.locationId,
        };
      }),
    [records, storageLocations, storageUnits, floorMaps, sites],
  );

  const [locationId, setLocationId] = useState("");
  const [delta, setDelta] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null); // { name, newQuantity, newTotal }

  // Default to the location holding the most stock once data arrives.
  useEffect(() => {
    if (!locationId && locationOptions.length) setLocationId(locationOptions[0].locationId);
  }, [locationOptions, locationId]);

  // On a laptop the client wants the editing page straight away, so anyone who
  // reaches this route on a wide screen (deep link, resized window) is passed on.
  useEffect(() => {
    if (isDesktop) {
      navigate(`/inventory/${productId}/edit?from=scan`, { replace: true });
    }
  }, [isDesktop, productId, navigate]);

  const selected = locationOptions.find((o) => o.locationId === locationId);
  const currentQty = selected ? selected.quantity : 0;
  const nextQty = Math.max(0, currentQty + delta);

  async function handleSave() {
    if (!delta || !locationId || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await Meteor.callAsync("products.adjustStock", {
        productId,
        locationId,
        delta,
      });
      setSaved({ name: product.name, newQuantity: result.newQuantity, newTotal: result.newTotal });
      setDelta(0);
    } catch (err) {
      setError(err.reason || err.message || "Could not save stock.");
    } finally {
      setSaving(false);
    }
  }

  // Redirect above is in flight — render nothing rather than flashing this UI.
  if (isDesktop) return null;

  if (loading) {
    return (
      <div className="product-detail-container scan-update-page">
        <p className="scan-update-message">Loading…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-container scan-update-page">
        <div className="scan-update-card">
          <p className="scan-update-message">Product not found.</p>
          <Link to="/scan" className="btn-primary scan-update-link">
            Back to scan
          </Link>
        </div>
      </div>
    );
  }

  // ---- Success state ----
  if (saved) {
    return (
      <div className="product-detail-container scan-update-page">
        <div className="scan-update-card scan-update-success">
          <div className="scan-update-check" aria-hidden="true">
            ✓
          </div>
          <h1 className="scan-update-title">Stock saved</h1>
          <p className="scan-update-message">
            <strong>{saved.name}</strong> — {saved.newQuantity} at this location, {saved.newTotal}{" "}
            in total.
          </p>
          <p className="scan-update-question">Open the full product details?</p>
          <div className="scan-update-actions">
            <Link to={`/inventory/${productId}`} className="btn-primary scan-update-link">
              Yes, open details
            </Link>
            <Link to="/scan" className="btn-secondary scan-update-link">
              No, scan next
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Update state ----
  return (
    <div className="product-detail-container scan-update-page">
      <div className="scan-update-card">
        <div className="scan-update-product">
          <ProductThumbnail
            images={product.images || product.catalogImages}
            photoUrl={product.photoUrl}
            name={product.name}
          />
          <div className="scan-update-name">
            <h1 className="scan-update-title">{product.name}</h1>
            {product.sku && <span className="scan-update-sku">SKU {product.sku}</span>}
          </div>
        </div>

        {locationOptions.length === 0 ? (
          <p className="scan-update-message">
            This product has no storage location yet. Add one from the item details page first.
          </p>
        ) : (
          <>
            {locationOptions.length > 1 && (
              <label className="scan-update-field">
                <span>Location</span>
                <select
                  className="form-input"
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    setDelta(0);
                  }}
                >
                  {locationOptions.map((o) => (
                    <option key={o.locationId} value={o.locationId}>
                      {o.label} ({o.quantity})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {locationOptions.length === 1 && (
              <p className="scan-update-location">{locationOptions[0].label}</p>
            )}

            <div className="scan-update-stepper">
              <button
                type="button"
                className="scan-update-btn"
                onClick={() => setDelta((d) => d - 1)}
                disabled={saving || nextQty <= 0}
                aria-label="Remove one"
              >
                −
              </button>
              <div className="scan-update-qty">
                <span className="scan-update-qty-value">{nextQty}</span>
                <span className="scan-update-qty-label">
                  {delta === 0
                    ? "current stock"
                    : `${delta > 0 ? "+" : ""}${delta} from ${currentQty}`}
                </span>
              </div>
              <button
                type="button"
                className="scan-update-btn"
                onClick={() => setDelta((d) => d + 1)}
                disabled={saving}
                aria-label="Add one"
              >
                +
              </button>
            </div>

            {error && <p className="scan-update-error">{error}</p>}

            <div className="scan-update-actions">
              <button
                type="button"
                className="btn-primary scan-update-save"
                onClick={handleSave}
                disabled={saving || delta === 0}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/scan")}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
