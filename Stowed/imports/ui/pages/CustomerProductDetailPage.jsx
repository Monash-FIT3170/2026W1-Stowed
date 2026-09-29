import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getCustomerOrgCode } from "../customerSession";
import { StatusBadge } from "../components/StatusBadge";
import { ProductThumbnail } from "./InventoryListPage";
import { currency } from "./shoppingListHelpers";
import { STOCK_STATUS } from "/imports/api/products/filters";
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

// A line under the price that turns the stock tag into what it means for a
// shopper standing in the store.
const AVAILABILITY = {
  [STOCK_STATUS.IN]: "Available in store today.",
  [STOCK_STATUS.LOW]: "Only a few left - grab one while you can.",
  [STOCK_STATUS.OUT]: "Sold out for now. Ask a staff member about restocking.",
};

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

  // The shared breadcrumb, led by a way back to the results.
  const breadcrumb = (trail) => (
    <nav className="breadcrumb customer-detail-breadcrumb" aria-label="Breadcrumb">
      <Link to={SEARCH_PATH} onClick={handleBack} className="breadcrumb-link">
        ← Product search
      </Link>
      {trail}
    </nav>
  );

  if (loadState !== "ready") {
    return (
      <div className="customer-page customer-detail">
        {breadcrumb(null)}
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
  const availability = AVAILABILITY[product.stockStatus];
  const categorySearch = product.categoryId
    ? `${SEARCH_PATH}?category=${encodeURIComponent(product.categoryId)}`
    : null;

  return (
    <div className="customer-page customer-detail">
      {breadcrumb(
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

          <p className={`customer-detail-availability ${product.stockStatus}`}>{availability}</p>

          {product.description && (
            <section className="customer-detail-section">
              <h2>About this product</h2>
              <p>{product.description}</p>
            </section>
          )}

          <section className="customer-detail-section">
            <h2>Where to find it</h2>
            {product.locations.length > 0 ? (
              <ul className="customer-detail-locations">
                {product.locations.map((loc, index) => (
                  <li key={loc.label} className="customer-detail-location">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="customer-detail-pin">
                      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                    </svg>
                    <span className="customer-detail-location-label">{loc.label}</span>
                    {/* Locations arrive fullest first, so the first is the
                        likeliest place to find one on the shelf. */}
                    {index === 0 && product.locations.length > 1 && (
                      <span className="customer-detail-location-tag">Best place to look</span>
                    )}
                  </li>
                ))}
              </ul>
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
