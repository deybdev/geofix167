import { createContext, useContext, useMemo, useState } from "react";
import useDispatchAlertAudio from "../../features/admin/incident-reports/hooks/useDispatchAlertAudio";

const DispatchAlertContext = createContext(null);

export function DispatchAlertProvider({ children }) {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const audio = useDispatchAlertAudio(activeAlerts);
  const value = useMemo(() => ({
    ...audio,
    setActiveAlerts,
  }), [audio, activeAlerts]);
  return <DispatchAlertContext.Provider value={value}>{children}</DispatchAlertContext.Provider>;
}

export function useDispatchAlertContext() {
  const context = useContext(DispatchAlertContext);
  if (!context) throw new Error("useDispatchAlertContext must be used within DispatchAlertProvider");
  return context;
}
