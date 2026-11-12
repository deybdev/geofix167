import { useEffect, useState } from "react";

import MapViewer from "../../shared/components/MapViewer";
import IncidentSheet from "../resident/components/IncidentSheet";
import { loadSampleIncidents } from "../resident/sampleIncident";

export default function GuestMap() {
  const [incidents, setIncidents] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  useEffect(() => {
    loadSampleIncidents()
      .then(setIncidents)
      .catch((error) => console.error("Sample incidents error:", error));
  }, []);

  return (
    <section className="relative h-screen overflow-hidden">
      <MapViewer
        backPath="/guest"
        incidents={incidents}
        selectedLocation={selectedLocation}
        onLocationSelect={(location) => {
          setSelectedIncident(null);
          setSelectedLocation(location);
        }}
        selectedIncident={selectedIncident}
        onIncidentSelect={setSelectedIncident}
      />

      <IncidentSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </section>
  );
}
