import { useParams } from "react-router-dom";
import { getMockProductDetailById } from "../../api/mockProductDetails";

export function ProductDetailView({ product }) {
  if (!product) {
    return <div>Product not found.</div>;
  }

  return (
    <section>
      <h1>{product.name}</h1>

      <img src={product.photoUrl} alt={`${product.name} photo`} />

      <div>
        <span>Quality:</span> {product.quality}
      </div>

      <div>
        <span>Location:</span> {product.location}
      </div>
    </section>
  );
}

export function ProductDetailPage() {
  const { productId } = useParams();
  const product = getMockProductDetailById(productId);

  return <ProductDetailView product={product} />;
}
