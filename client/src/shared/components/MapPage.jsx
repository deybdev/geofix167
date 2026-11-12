import { useLocation } from "react-router-dom";
import MapViewer from "./MapViewer";

// Reusable full-page map — the same experience as the resident map page.
// Renders as a fixed overlay covering the app shell. Pages can embed it in
// their router and pass props directly, or navigate here and send the
// incidents (and heatmap state) via location state. Extras like incident
// sheets can be layered on top via `children`.
export default function MapPage({ backPath, children, ...viewerProps }) {
  const { state } = useLocation();
  const incidents = viewerProps.incidents ?? state?.incidents ?? [];
  const heatmap = viewerProps.heatmap ?? state?.heatmap ?? false;
  const routes = viewerProps.routes ?? state?.routes ?? [];
  const trackers = viewerProps.trackers ?? state?.trackers ?? [];
  const dropOffs = viewerProps.dropOffs ?? state?.dropOffs ?? [];
  const selectedIncident = viewerProps.selectedIncident ?? state?.selectedIncident ?? null;

  return (
    <section className="fixed inset-0 z-[1200] overflow-hidden bg-white">
      <MapViewer
        backPath={backPath}
        {...viewerProps}
        incidents={incidents}
        heatmap={heatmap}
        routes={routes}
        trackers={trackers}
        dropOffs={dropOffs}
        selectedIncident={selectedIncident}
      />
      {children}
    </section>
  );
}
