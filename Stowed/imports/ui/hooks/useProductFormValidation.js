import { useState } from "react";
import { validateProductFields, isDeferredError } from "/imports/api/products/validation";

/**
 * Wraps validateProductFields with the UI state the create/edit product forms
 * need: which fields have been touched, whether a submit was attempted, and
 * the props that mark an input as invalid for assistive tech.
 */
export function useProductFormValidation(fields) {
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { errors, isValid, count } = validateProductFields(fields);

  const reveal = (key, message) => {
    if (!message) return "";
    if (isDeferredError(message) && !touched[key] && !submitAttempted) return "";
    return message;
  };

  const fieldError = (field) => reveal(field, errors[field]);
  const rowError = (index) => reveal(`row-${index}`, errors.assignmentRows?.[index]);

  const markTouched = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  // Props for an input: flags it invalid and links it to its message.
  const inputProps = (key, message) => ({
    onBlur: () => markTouched(key),
    "aria-invalid": message ? "true" : undefined,
    "aria-describedby": message ? `${key}-error` : undefined,
    className: message ? "form-input input-error" : "form-input",
  });

  // Call when the user presses Create/Save. Returns true when the form is valid;
  // otherwise reveals every error and moves focus to the first invalid field.
  const attemptSubmit = () => {
    if (isValid) return true;
    setSubmitAttempted(true);
    requestAnimationFrame(() => {
      const firstInvalid = document.querySelector('[aria-invalid="true"]');
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid?.focus({ preventScroll: true });
    });
    return false;
  };

  return {
    errors,
    isValid,
    count,
    submitAttempted,
    fieldError,
    rowError,
    inputProps,
    attemptSubmit,
  };
}
