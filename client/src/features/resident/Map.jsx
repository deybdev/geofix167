import { useEffect, useState } from "react";
import MapPage from "../../shared/components/MapPage";
import IncidentSheet from "./components/IncidentSheet";
import { loadSampleIncidents } from "./sampleIncident";

export default function ResidentMap() {
  const [incidents, setIncidents] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Demo pins, spread out inside the barangay. Swap for real data later.
  useEffect(() => {
    loadSampleIncidents()
      .then(setIncidents)
      .catch((error) => console.error("Sample incidents error:", error));
  }, []);

  return (
    <MapPage
      incidents={incidents}
      selectedLocation={selectedLocation}
      onLocationSelect={(location) => {
        setSelectedIncident(null);
        setSelectedLocation(location);
      }}
      selectedIncident={selectedIncident}
      onIncidentSelect={setSelectedIncident}
    >
      <IncidentSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </MapPage>
  );
}
