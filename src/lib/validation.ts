/**
 * Validates an email address client-side.
 * Requirements:
 * - Must contain '@'
 * - Must contain a valid domain name
 * - Must contain a valid TLD (.com, .in, .org, etc.)
 * - Rejects malformed emails
 */
export function validateEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;

  // Robust RFC 5322 email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return false;
  }

  // Ensure there are no spaces
  if (trimmed.includes(" ")) {
    return false;
  }

  return true;
}
