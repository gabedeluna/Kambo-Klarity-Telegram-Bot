/**
 * @file public/form-handler/validation.js
 * @description Form validation functions
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate form fields
 * @returns {boolean} True if form is valid
 */
function validateForm() {
  let isValid = true;
  const errorMessage = document.getElementById("errorMessage");
  const errorDisplay = document.getElementById("errorDisplay");

  // Clear previous errors
  if (errorDisplay) {
    errorDisplay.classList.add("hidden");
  }
  if (errorMessage) {
    errorMessage.textContent = "";
  }

  document.querySelectorAll(".error-outline").forEach((el) => {
    el.classList.remove("error-outline");
  });
  document.querySelectorAll(".error-message.visible").forEach((el) => {
    el.classList.remove("visible");
  });

  // Get all required fields
  const requiredFields =
    document.querySelectorAll(
      "#waiverForm [required], #genericForm [required]",
    ) || [];

  // Check each required field
  for (const field of requiredFields) {
    const errorElement = document.getElementById(`${field.id}-error`);
    let fieldValid = true;
    let errorMsg = "";

    if (field.type === "checkbox") {
      if (!field.checked) {
        fieldValid = false;
        errorMsg = "This field is required";
      }
    } else if (field.type === "email") {
      if (!field.value.trim()) {
        fieldValid = false;
        errorMsg = "Email is required";
      } else if (!validateEmail(field.value)) {
        fieldValid = false;
        errorMsg = "Please enter a valid email address";
      }
    } else if (field.type === "hidden" && field.id === "signature") {
      if (!field.value) {
        fieldValid = false;
        errorMsg = "Please provide your digital signature";
      }
    } else {
      if (!field.value.trim()) {
        fieldValid = false;
        errorMsg = "This field is required";
      }
    }

    if (!fieldValid) {
      isValid = false;
      field.classList.add("error-outline");
      if (errorElement) {
        errorElement.textContent = errorMsg;
        errorElement.classList.add("visible");
      }

      // Show general error message
      if (errorMessage) {
        if (
          field.type === "email" &&
          field.value.trim() &&
          !validateEmail(field.value)
        ) {
          errorMessage.textContent = "Please enter a valid email address";
        } else if (field.type === "hidden" && field.id === "signature") {
          errorMessage.textContent = "Please provide your digital signature";
        } else {
          errorMessage.textContent = "Please fill in all required fields";
        }
      }
      if (errorDisplay) {
        errorDisplay.classList.remove("hidden");
      }

      // Focus on first invalid field
      if (field.focus) {
        field.focus();
      }
      break; // Stop at first error for cleaner UX
    }
  }

  return isValid;
}

// Export functions for testing and other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    validateEmail,
    validateForm,
  };
} else {
  window.formHandlerValidation = {
    validateEmail,
    validateForm,
  };
}
