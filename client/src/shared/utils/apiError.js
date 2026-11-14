export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error?.response) {
    return navigator.onLine
      ? "We couldn’t reach GeoFix. Please try again in a moment."
      : "You appear to be offline. Check your connection and try again.";
  }

  const status = error.response.status;
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return error.response.data?.error || "You don’t have permission to complete this action.";
  if (status === 429) {
    const seconds = Number(error.response.data?.retry_after || error.response.headers?.["retry-after"] || 0);
    return seconds ? `Too many attempts. Try again in ${seconds} seconds.` : "Too many attempts. Please wait before trying again.";
  }
  if (status >= 500) return "GeoFix is temporarily unavailable. Please try again in a moment.";
  return error.response.data?.error || fallback;
}
