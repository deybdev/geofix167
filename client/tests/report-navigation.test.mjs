import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRouter } from "react-router-dom";
import { PATHS } from "../src/router/paths.js";
import { openReportDetails, returnToMyReports, withoutPendingUploads } from "../src/router/reportNavigation.js";

function routerAt(initialEntries) {
  return createMemoryRouter([{ path: "*", element: null }], { initialEntries });
}

test("repeated list/detail returns reuse the filtered list and preserve Back/Forward", async () => {
  const router = routerAt([PATHS.resident]);
  try {
    await router.navigate(PATHS.myReports, { state: { status: "submitted" } });
    // Filter changes replace the list, including a filter entered from Home.
    await router.navigate(PATHS.myReports, { replace: true, state: { status: "resolved" } });
    const listKey = router.state.location.key;
    for (const id of ["first", "second", "third"]) {
      openReportDetails(router.navigate, router.state.location, id);
      const detail = router.state.location;
      returnToMyReports(router.navigate, detail.state);
      assert.equal(router.state.location.key, listKey);
      assert.equal(router.state.location.state.status, "resolved");
      await router.navigate(1);
      assert.equal(router.state.location.pathname, `${PATHS.reportDetails}/${id}`);
      await router.navigate(-1);
      assert.equal(router.state.location.key, listKey);
    }
    await router.navigate(-1);
    assert.equal(router.state.location.pathname, PATHS.resident);
  } finally { router.dispose(); }
});

test("restored Details state still returns to its preceding list", () => {
  const router = routerAt([
    PATHS.resident,
    { pathname: PATHS.myReports, key: "list", state: { status: "in_progress" } },
    { pathname: `${PATHS.reportDetails}/one`, state: { reportReturn: { from: PATHS.myReports, key: "list" } } },
  ]);
  try {
    returnToMyReports(router.navigate, router.state.location.state);
    assert.equal(router.state.location.key, "list");
    assert.equal(router.state.location.state.status, "in_progress");
  } finally { router.dispose(); }
});

test("direct and submitted Details replace safely; My Reports header can reach Home", async () => {
  for (const entries of [
    [`${PATHS.reportDetails}/one`],
    [PATHS.report, `${PATHS.reportDetails}/one`],
  ]) {
    const router = routerAt(entries);
    try {
      returnToMyReports(router.navigate, router.state.location.state);
      assert.equal(router.state.location.pathname, PATHS.myReports);
      await router.navigate(PATHS.resident);
      assert.equal(router.state.location.pathname, PATHS.resident);
      await router.navigate(-1);
      assert.equal(router.state.location.pathname, PATHS.myReports);
    } finally { router.dispose(); }
  }
});

test("upload consumption preserves navigation state and URL without resurrecting Files", async () => {
  const pendingUploads = { reportId: "one", items: [{ file: new File(["photo"], "photo.jpg") }] };
  const state = { pendingUploads, reportReturn: { from: PATHS.myReports, key: "list" }, other: "keep" };
  const router = routerAt([
    { pathname: PATHS.myReports, key: "list" },
    { pathname: `${PATHS.reportDetails}/one`, search: "?source=test", hash: "#media", state },
  ]);
  try {
    const { pathname, search, hash } = router.state.location;
    await router.navigate({ pathname, search, hash }, { replace: true, state: withoutPendingUploads(state) });
    assert.equal(state.pendingUploads, pendingUploads);
    assert.equal(router.state.location.state.other, "keep");
    returnToMyReports(router.navigate, router.state.location.state);
    assert.equal(router.state.location.key, "list");
    await router.navigate(1);
    assert.equal(router.state.location.search, search);
    assert.equal(router.state.location.hash, hash);
    assert.equal(router.state.location.state.pendingUploads, undefined);
    assert.deepEqual(router.state.location.state.reportReturn, state.reportReturn);
  } finally { router.dispose(); }
});
