import { currency, sortByCategory } from "../../imports/ui/pages/shoppingListHelpers";

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

// Builds a self-contained HTML email body for a shopping list, grouped by category.
export function buildShoppingListEmailHtml(list) {
  const items = sortByCategory(list.items || []);
  const total = items.reduce((sum, item) => sum + item.quantityWanted * item.unitCost, 0);

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(item.productName)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(item.category || "Uncategorized")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${item.quantityWanted}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${escapeHtml(currency(item.unitCost))}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${escapeHtml(currency(item.quantityWanted * item.unitCost))}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">${escapeHtml(list.name)}</h2>
      <p style="color:#666;margin-top:0;">Shopping list shared with you.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;border-bottom:2px solid #333;">
            <th style="padding:6px 8px;">Product</th>
            <th style="padding:6px 8px;">Category</th>
            <th style="padding:6px 8px;text-align:right;">Qty</th>
            <th style="padding:6px 8px;text-align:right;">Unit cost</th>
            <th style="padding:6px 8px;text-align:right;">Line total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:8px;text-align:right;font-weight:bold;">Total</td>
            <td style="padding:8px;text-align:right;font-weight:bold;">${escapeHtml(currency(total))}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}
