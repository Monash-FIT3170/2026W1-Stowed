// Client-side validation for the create/edit product forms. Values are the raw
// strings held in form state. Returns per-field messages so the forms can show
// them inline, rather than just disabling the submit button.

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

// "" when valid, otherwise a message. Optional fields accept blank.
function validateWholeNumber(value, label, { required = false } = {}) {
  if (isBlank(value)) return required ? `${label} is required.` : "";
  const number = Number(value);
  if (Number.isNaN(number)) return `${label} must be a number.`;
  if (number < 0) return `${label} can't be negative.`;
  if (!Number.isInteger(number)) return `${label} must be a whole number.`;
  return "";
}

function validatePrice(value, label) {
  if (isBlank(value)) return "";
  const number = Number(value);
  if (Number.isNaN(number)) return `${label} must be a number.`;
  if (number < 0) return `${label} can't be negative.`;
  return "";
}

// "Missing value" errors wait until the field is touched (or a submit is
// attempted); format errors such as negatives are shown as soon as they're typed.
export function isDeferredError(message) {
  return (
    typeof message === "string" &&
    (message.endsWith("is required.") ||
      message.startsWith("Choose a location") ||
      message.startsWith("Enter a quantity"))
  );
}

export function validateProductFields({
  name = "",
  totalQuantity = "",
  reorderAt = "",
  unitCost = "",
  purchaseCost = "",
  assignments = [],
  isDuplicate = false,
} = {}) {
  const errors = {};

  if (!name.trim()) errors.name = "Product name is required.";
  else if (name.trim().length > 100) errors.name = "Product name must be 100 characters or fewer.";
  else if (isDuplicate) errors.name = "A product with this name already exists.";

  const totalError = validateWholeNumber(totalQuantity, "Stock", { required: true });
  if (totalError) errors.totalQuantity = totalError;

  const reorderError = validateWholeNumber(reorderAt, "Reorder level");
  if (reorderError) errors.reorderAt = reorderError;

  const unitCostError = validatePrice(unitCost, "Sell price");
  if (unitCostError) errors.unitCost = unitCostError;

  const purchaseCostError = validatePrice(purchaseCost, "Purchase price");
  if (purchaseCostError) errors.purchaseCost = purchaseCostError;

  const assignmentRows = {};
  assignments.forEach((a, index) => {
    const quantityError = validateWholeNumber(a.quantity, "Quantity");
    if (quantityError) assignmentRows[index] = quantityError;
    else if (!a.locationId && !isBlank(a.quantity)) {
      assignmentRows[index] = "Choose a location for this quantity.";
    } else if (a.locationId && isBlank(a.quantity)) {
      assignmentRows[index] = "Enter a quantity for this location.";
    }
  });
  if (Object.keys(assignmentRows).length > 0) errors.assignmentRows = assignmentRows;

  // Only check the balance once the total and every row are individually valid,
  // otherwise the numbers being compared are meaningless.
  if (!errors.totalQuantity && !errors.assignmentRows) {
    const total = Number(totalQuantity);
    const assigned = assignments
      .filter((a) => a.locationId && !isBlank(a.quantity))
      .reduce((sum, a) => sum + Number(a.quantity), 0);
    const remaining = total - assigned;
    if (remaining > 0) {
      errors.assignments = `${remaining} of ${total} unit${total !== 1 ? "s" : ""} still need a location.`;
    } else if (remaining < 0) {
      const over = Math.abs(remaining);
      errors.assignments = `Over-assigned by ${over} unit${over !== 1 ? "s" : ""} — location quantities must add up to ${total}.`;
    }
  }

  const count =
    ["name", "totalQuantity", "reorderAt", "unitCost", "purchaseCost", "assignments"].filter(
      (key) => errors[key],
    ).length + Object.keys(errors.assignmentRows ?? {}).length;

  return { errors, isValid: count === 0, count };
}
