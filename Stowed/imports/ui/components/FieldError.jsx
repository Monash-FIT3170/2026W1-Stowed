/**
 * Inline validation message shown under a form field. Renders nothing when
 * there is no message, so it can be dropped under any input unconditionally.
 */
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <span id={id} className="warning-text field-error" role="alert">
      {message}
    </span>
  );
}

/**
 * Footer summary explaining why a form can't be submitted yet.
 */
export function FormErrorSummary({ show, count }) {
  if (!show) return null;
  return (
    <span className="warning-text form-error-summary" role="status">
      {count} issue{count !== 1 ? "s" : ""} to fix before saving — see the highlighted fields.
    </span>
  );
}
