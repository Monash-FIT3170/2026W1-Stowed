import "../Global.css";
 
export function ListsPage() {
  return (
    <div className="product-detail-container">
      <div className="product-detail-header">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Lists</span>
        </div>
        <div className="header-top">
          <h1 className="header-title">Shopping <em>Lists</em></h1>
        </div>
      </div>
    </div>
  );
}