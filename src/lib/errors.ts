import { Alert } from "react-native";

/**
 * Parses Postgres / Supabase errors and returns a user-friendly message.
 * Logs the full error trace to the console for tracking/debugging.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return "An unexpected error occurred.";

  const msg = error.message || String(error);
  console.error("[Database/API Error Details]:", error);

  if (msg.includes("violates unique constraint")) {
    if (msg.includes("workers_mobile_key") || msg.includes("mobile")) {
      return "A worker with this mobile number already exists.";
    }
    return "A record with this identifier already exists.";
  }

  if (msg.includes("violates foreign key constraint")) {
    return "This item is linked to other records and cannot be deleted or modified.";
  }

  if (msg.includes("Not authenticated") || msg.includes("JWT expired")) {
    return "Your session has expired. Please log in again.";
  }

  if (msg.includes("storage/quota-exceeded") || msg.includes("Payload Too Large")) {
    return "Storage quota exceeded. Please upload smaller files.";
  }

  if (msg.includes("Network request failed")) {
    return "Network error. Please check your internet connection and try again.";
  }

  return msg;
}

/**
 * Logs database errors and presents a localized error alert dialog.
 */
export function handleApiError(error: any, fallbackTitle = "Error") {
  const friendly = getFriendlyErrorMessage(error);
  Alert.alert(fallbackTitle, friendly);
}
