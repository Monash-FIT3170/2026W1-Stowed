import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";
import { ProductThumbnail } from "../pages/InventoryListPage";
import { currency } from "../pages/shoppingListHelpers";
import "../pages/CustomerProductSearchPage.css";

/**
 * One product as a shopper sees it: gallery, price, stock, description and
 * where to find it.
 *
 * Shared by the /customer/search/:productId page and the shopping list's
 * "More info" modal, so the two can never drift into showing different things
 * about the same product. The surrounding chrome - breadcrumbs on the page, a
 * dialog around the modal - stays with each caller.
 */

const SEARCH_PATH = "/customer/search";

export function CustomerProductDetails({ product }) {
  const [selectedImage, setSelectedImage] = useState(0);

  const { images } = product;
  const categorySearch = product.categoryId
    ? `${SEARCH_PATH}?category=${encodeURIComponent(product.categoryId)}`
    : null;

  return (
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
  );
}
