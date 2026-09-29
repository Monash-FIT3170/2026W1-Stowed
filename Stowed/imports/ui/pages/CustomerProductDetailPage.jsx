import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getCustomerOrgCode } from "../customerSession";
import { StatusBadge } from "../components/StatusBadge";
import { ProductThumbnail } from "./InventoryListPage";
import { currency } from "./shoppingListHelpers";
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

  const backLink = (
    <Link to={SEARCH_PATH} onClick={handleBack} className="customer-detail-back">
      ← Back to search
    </Link>
  );

  if (loadState !== "ready") {
    return (
      <div className="customer-page customer-detail">
        {backLink}
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

  return (
    <div className="customer-page customer-detail">
      {backLink}

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
          <StatusBadge status={product.stockStatus} />
          <h1 className="customer-page-title">{product.name}</h1>
          {(product.brand || product.categoryName) && (
            <p className="customer-product-meta">
              {[product.brand, product.categoryName].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="customer-detail-price">
            {product.price != null ? currency(product.price) : "Price on request"}
          </p>

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
                {product.locations.map((loc) => (
                  <li key={loc.label}>{loc.label}</li>
                ))}
              </ul>
            ) : (
              <p>Ask a staff member for help finding this product.</p>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
