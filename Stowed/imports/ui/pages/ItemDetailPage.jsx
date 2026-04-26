import { useParams } from "react-router-dom";
import { getMockItemDetailById } from "../../api/mockItemDetails";

export function ItemDetailView({ item }) {
  if (!item) {
    return <div>Item not found.</div>;
  }

  return (
    <section>
      <h1>{item.name}</h1>

      <img src={item.photoUrl} alt={`${item.name} photo`} />

      <div>
        <span>Quality:</span> {item.quality}
      </div>

      <div>
        <span>Location:</span> {item.location}
      </div>
    </section>
  );
}

export function ItemDetailPage() {
  const { itemId } = useParams();
  const item = getMockItemDetailById(itemId);

  return <ItemDetailView item={item} />;
}
