import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PATHS } from "../router/paths";
import AnnouncementsPage from "./AnnouncementsPage";

export default function AnnouncementDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const closeAnnouncement = useCallback(() => navigate(PATHS.announcements, { replace: true }), [navigate]);

  return <AnnouncementsPage initialSelectedId={id || ""} onCloseAnnouncement={closeAnnouncement} />;
}
