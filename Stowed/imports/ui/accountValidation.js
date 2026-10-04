// Shared validation for the account forms (self-registration and owner-created accounts).

// Server errors that belong to a specific field are shown inline under it.
export const SERVER_ERROR_FIELDS = {
  "org-required": "orgCode",
  "invalid-org-code": "orgCode",
  "org-exists": "orgCode",
  "org-name-required": "orgName",
  "email-taken": "email",
  "username-taken": "username",
  "invalid-password": "password",
};

// returns an error message for one account field, or "" when it is valid
export const validateAccountField = (field, values) => {
  switch (field) {
    case "username":
      return values.username.trim() ? "" : "Username is required.";
    case "email":
      if (!values.email.trim()) return "Email is required.";
      return /^.+@.+\..+$/.test(values.email) ? "" : "Enter a valid email, e.g. name@example.com.";
    case "password":
      return values.password.length < 6 ? "Password must be at least 6 characters." : "";
    case "confirmPassword":
      return values.password !== values.confirmPassword ? "Passwords do not match." : "";
    default:
      return "";
  }
};
