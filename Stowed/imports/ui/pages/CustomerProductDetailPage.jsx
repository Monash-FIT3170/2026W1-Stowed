import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FloorMaps, Sites, StorageUnits } from "/imports/api/locations/collections";
import { getCustomerOrgCode } from "../customerSession";
import { StatusBadge } from "../components/StatusBadge";
import { ProductThumbnail } from "./InventoryListPage";
import { currency } from "./shoppingListHelpers";
import { CustomerLocations } from "./CustomerLocations";
import "../Global.css";
import "./CustomerProductSearchPage.css";

/**
 * PRODUCT DETAIL (customer)
 * One product as a shopper sees it, reached from a search result card. Read
 * only, and built from the same whitelisted shape as the search results - the
 * server scopes the lookup to the visitor's organisation, so an id from another
 * store reads as not found.
 */

const SEARCH_PATH = "/customer/search";

export function CustomerProductDetailPage() {
  const { productId } = useParams();
  const orgCode = getCustomerOrgCode();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [selectedImage, setSelectedImage] = useState(0);
  // Bumped by Try again to fetch the product once more.
  const [reloadCount, setReloadCount] = useState(0);
  const { floorMaps, sites, storageUnits, mapsReady } = useTracker(() => {
    const handle = Meteor.subscribe("locations.publicFloorMaps", orgCode ?? "");
    return {
      floorMaps: FloorMaps.find().fetch(),
      sites: Sites.find().fetch(),
      storageUnits: StorageUnits.find().fetch(),
      mapsReady: handle.ready(),
    };
  }, [orgCode]);

  useEffect(() => {
    let current = true;
    Meteor.callAsync("customer.products.get", { orgCode, productId })
      .then((result) => {
        if (!current) return;
        setProduct(result);
        setSelectedImage(0);
        setLoadState("ready");
      })
      .catch((err) => {
        if (!current) return;
        if (err.error === "not-found") {
          setLoadState("not-found");
        } else {
          console.error("Failed to load the product:", err);
          setLoadState("error");
        }
      });
    // A response that lands after the page has moved on is dropped.
    return () => {
      current = false;
    };
  }, [orgCode, productId, reloadCount]);

  // Back to the results the shopper came from, search and filters intact, when
  // they arrived from within the app; a link opened directly goes to search.
  const cameFromApp = location.key !== "default";
  const handleBack = (e) => {
    if (!cameFromApp) return;
    e.preventDefault();
    navigate(-1);
  };

  // A clear button back to the results, beside the shared breadcrumb trail.
  const topBar = (trail) => (
    <div className="customer-detail-topbar">
      <Link to={SEARCH_PATH} onClick={handleBack} className="btn-secondary customer-detail-back">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="customer-detail-back-icon">
          <path d="M15.5 4.5 8 12l7.5 7.5" />
        </svg>
        Back to results
      </Link>
      {trail && (
        <nav className="breadcrumb customer-detail-breadcrumb" aria-label="Breadcrumb">
          <Link to={SEARCH_PATH} className="breadcrumb-link">
            Product search
          </Link>
          {trail}
        </nav>
      )}
    </div>
  );

  if (loadState !== "ready") {
    return (
      <div className="customer-page customer-detail">
        {topBar(null)}
        {loadState === "loading" && <div className="empty-state">Loading product...</div>}
        {loadState === "not-found" && (
          <div className="empty-state">This product isn&apos;t available at this store.</div>
        )}
        {loadState === "error" && (
          <div className="empty-state">
            <p>We couldn&apos;t load this product.</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setLoadState("loading");
                setReloadCount((count) => count + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  const { images } = product;
  const categorySearch = product.categoryId
    ? `${SEARCH_PATH}?category=${encodeURIComponent(product.categoryId)}`
    : null;

  return (
    <div className="customer-page customer-detail">
      {topBar(
        <>
          {product.categoryName && categorySearch && (
            <>
              <span className="breadcrumb-separator">/</span>
              <Link to={categorySearch} className="breadcrumb-link">
                {product.categoryName}
              </Link>
            </>
          )}
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{product.name}</span>
        </>,
      )}

      <article className="customer-detail-layout">
        <div className="customer-detail-gallery">
          <div className="customer-detail-image">
            {/* Keyed on the image, so a picture that fails to load does not
                leave its fallback stuck in place for the next one chosen. */}
            <ProductThumbnail
              key={images[selectedImage] ?? "none"}
              images={images.slice(selectedImage, selectedImage + 1)}
              name={product.name}
            />
          </div>
          {images.length > 1 && (
            <div className="customer-detail-thumbs">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  className={`customer-detail-thumb${index === selectedImage ? " active" : ""}`}
                  onClick={() => setSelectedImage(index)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-pressed={index === selectedImage}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="customer-detail-info">
          {product.brand && <p className="customer-detail-brand">{product.brand}</p>}
          <h1 className="customer-detail-name">{product.name}</h1>
          {product.categoryName && categorySearch && (
            <Link to={categorySearch} className="customer-detail-category">
              {product.categoryName}
            </Link>
          )}

          <div className="customer-detail-price-row">
            <p className="customer-detail-price">
              {product.price != null ? currency(product.price) : "Price on request"}
            </p>
            <StatusBadge status={product.stockStatus} />
          </div>

          {product.description && (
            <section className="customer-detail-section">
              <h2>About this product</h2>
              <p>{product.description}</p>
            </section>
          )}

          <section className="customer-detail-section">
            <h2>Where to find it</h2>
            {product.locations.length > 0 ? (
              <CustomerLocations
                locations={product.locations}
                floorMaps={floorMaps}
                storageUnits={storageUnits}
                sites={sites}
                mapsReady={mapsReady}
              />
            ) : (
              <p className="customer-detail-muted">
                Ask a staff member and they&apos;ll help you find it.
              </p>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
