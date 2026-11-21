// One request coordinator per account/provider. Refresh callers never receive a
// network rejection (in particular, notification failure cannot fail submission).
export function createNotificationRequests({ get, read, onPage, onRead, onLoading, onWriting, onError, onWriteError }) {
  let active = true;
  let fetchController = null;
  let writeController = null;
  let pendingRefresh = false;
  let scheduled = false;

  function drain() {
    if (!active || scheduled || fetchController || writeController || !pendingRefresh) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!active || fetchController || writeController || !pendingRefresh) return;
      pendingRefresh = false;
      void fetchPage(null);
    });
  }
  async function fetchPage(cursor) {
    const controller = new AbortController();
    fetchController = controller;
    onLoading(true);
    onError("");
    try {
      const { data } = await get({ cursor, signal: controller.signal });
      if (active && !controller.signal.aborted) onPage(data, Boolean(cursor));
    } catch (error) {
      if (active && !controller.signal.aborted && error.name !== "AbortError") onError(error.message);
    } finally {
      if (fetchController === controller) {
        fetchController = null;
        if (active) { onLoading(false); drain(); }
      }
    }
  }
  function refresh(cursor = null) {
    if (!active) return;
    if (cursor && !fetchController && !writeController && !pendingRefresh) void fetchPage(cursor);
    else { pendingRefresh = true; drain(); }
  }
  async function markRead(id = null) {
    if (!active || writeController) return false;
    fetchController?.abort();
    fetchController = null;
    onLoading(false);
    const controller = new AbortController();
    writeController = controller;
    onWriting(true);
    onWriteError("");
    try {
      await read(id, { signal: controller.signal });
      if (!active || controller.signal.aborted) return false;
      onRead(id);
      return true;
    } catch (error) {
      if (active && !controller.signal.aborted && error.name !== "AbortError") onWriteError(error.message);
      return false;
    } finally {
      if (writeController === controller) {
        writeController = null;
        if (active) { onWriting(false); refresh(); }
      }
    }
  }
  return { refresh, markRead,
    activate() { active = true; },
    dispose() {
      active = false;
      pendingRefresh = false;
      fetchController?.abort();
      fetchController = null;
      writeController?.abort();
      writeController = null;
    },
  };
}
