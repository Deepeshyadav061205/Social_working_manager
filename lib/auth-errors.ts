/** Map Supabase auth errors to clear, human messages (FR-6). */
export function friendlyAuthError(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email address first — check your inbox for the link.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try logging in instead.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Can't reach the server. Check your internet connection and try again.";
  if (m.includes("signup") && m.includes("disabled")) return "New sign-ups are currently disabled.";
  return message || "Something went wrong. Please try again.";
}
