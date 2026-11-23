import { PATHS } from "./paths.js";

export function openReportDetails(navigate, location, publicId) {
  // Only set this on a PUSH directly from the list. It remains valid across
  // refresh and browser Back/Forward because it belongs to this history entry.
  navigate(`${PATHS.reportDetails}/${encodeURIComponent(publicId)}`, {
    state: { reportReturn: { from: location.pathname, key: location.key } },
  });
}

export function returnToMyReports(navigate, state) {
  const origin = state?.reportReturn;
  if (origin?.from === PATHS.myReports && typeof origin.key === "string") {
    navigate(-1);
  } else {
    navigate(PATHS.myReports, { replace: true });
  }
}

export function withoutPendingUploads(state) {
  const remaining = { ...state };
  delete remaining.pendingUploads;
  return remaining;
}
