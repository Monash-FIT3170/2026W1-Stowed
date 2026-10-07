import { useEffect, useState } from "react";
import { Meteor } from "meteor/meteor";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getCustomerOrgCode } from "../customerSession";
import { CustomerProductDetails } from "../components/CustomerProductDetails";
import "../Global.css";
import "./CustomerProductSearchPage.css";

/**
 * PRODUCT DETAIL (customer)
 * One product as a shopper sees it, reached from a search result card. Read
 * only, and built from the same whitelisted shape as the search results - the
 * server scopes the lookup to the visitor's organisation, so an id from another
 * store reads as not found.
 *
 * This page is the fetch and the chrome; the product itself is rendered by
 * CustomerProductDetails, shared with the shopping list's "More info" modal.
 */

const SEARCH_PATH = "/customer/search";

export function CustomerProductDetailPage() {
  const { productId } = useParams();
  const orgCode = getCustomerOrgCode();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  // Bumped by Try again to fetch the product once more.
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let current = true;
    Meteor.callAsync("customer.products.get", { orgCode, productId })
      .then((result) => {
        if (!current) return;
        setProduct(result);
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

      <CustomerProductDetails product={product} />
    </div>
  );
}
