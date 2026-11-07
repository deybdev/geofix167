import { useState } from "react";
import LandingHeader from "../features/landing/components/LandingHeader";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import LandingMapViewer from "../features/landing/components/LandingMapViewer";
import ResidentReportingCard from "../features/landing/components/ResidentReportingCard";
import BarangayAnnouncementsCard from "../features/landing/components/BarangayAnnouncementsCard";
import GetInvolvedSection from "../features/landing/components/GetInvolvedSection";
import AboutSection from "../features/landing/components/AboutSection";
import ServicesSection from "../features/landing/components/ServicesSection";
import AccomplishmentsSection from "../features/landing/components/AccomplishmentsSection";
import LandingFooter from "../features/landing/components/LandingFooter";
import QuickReportModal from "../features/landing/components/QuickReportModal";

import {
  INITIAL_REPORTS,
  INITIAL_BDRRMO_UNITS,
} from "../features/landing/data/landingData";

export default function HomePage() {
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [bdrrmoUnits] = useState(INITIAL_BDRRMO_UNITS);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);

  // Handle adding new report
  const handleAddNewReport = (newReport) => {
    setReports((prev) => [newReport, ...prev]);
    setSelectedReport(newReport);
    setSelectedCoordinates(null);
  };

  // Handle selecting a pin or list item
  const handleSelectReport = (report) => {
    setSelectedReport(report);
  };

  // Handle clicking on map to choose location
  const handleLocationSelect = (coords) => {
    setSelectedCoordinates(coords);
    if (isPickingLocation) {
      setActiveTab("submit");
    }
  };

  // Scroll to accomplishments
  const handleScrollToAccomplishments = () => {
    const el = document.getElementById("accomplishments");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Trigger quick report
  const handleTriggerReport = () => {
    setIsQuickReportOpen(true);
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50/50 text-slate-900 font-sans antialiased selection:bg-[#2E8B57]/20 selection:text-[#2E8B57]">
      
      {/* 1. Official Header */}
      <LandingHeader onReportClick={handleTriggerReport} />

      {/* 2. Barangay Online Status Bar */}
      <BarangayStatusBanner />

      {/* 3. Main Live Dashboard Section (Map + Cards Matching Screenshot) */}
      <section id="map-section" className="py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Interactive Map of Barangay 167 (~62% width on desktop) */}
            <div className="relative z-0 isolate lg:col-span-7 xl:col-span-8 h-[480px] sm:h-[540px] lg:h-[620px] flex flex-col">
              <LandingMapViewer
                reports={reports}
                bdrrmoUnits={bdrrmoUnits}
                selectedReport={selectedReport}
                onSelectReport={handleSelectReport}
                selectedCoordinates={selectedCoordinates}
                onLocationSelect={handleLocationSelect}
                isPickingLocation={isPickingLocation}
              />
            </div>

            {/* Right Column: Resident Dashboard & Announcements (~38% width on desktop) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
              
              {/* Resident Reporting Dashboard Card */}
              <ResidentReportingCard
                reports={reports}
                selectedReport={selectedReport}
                onSelectReport={handleSelectReport}
                onSubmitNewReport={handleAddNewReport}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectedCoordinates={selectedCoordinates}
                isPickingLocation={isPickingLocation}
                setIsPickingLocation={setIsPickingLocation}
              />

              {/* Barangay Announcements Card */}
              <BarangayAnnouncementsCard />

            </div>

          </div>

        </div>
      </section>

      {/* 4. "Get Involved" 3 Action Buttons */}
      <GetInvolvedSection
        onQuickReportClick={handleTriggerReport}
        onAccomplishmentClick={handleScrollToAccomplishments}
      />

      {/* 5. Core Services */}
      <ServicesSection />

      {/* 6. About Barangay 167 & Capstone System */}
      <AboutSection />

      {/* 7. Public Accomplishment Log & Transparency Metrics */}
      <AccomplishmentsSection />

      {/* 8. Footer */}
      <LandingFooter />

      {/* Mobile Floating Emergency Button (always within thumb reach on phone/tablet) */}
      <div className="fixed bottom-5 right-4 z-30 md:hidden">
        <button
          type="button"
          onClick={handleTriggerReport}
          aria-label="Report emergency incident"
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ea580c] to-[#dc2626] px-4 py-3 text-xs font-black tracking-wider text-white shadow-xl shadow-red-700/40 active:scale-95 transition-all ring-2 ring-white/90"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white"></span>
          </span>
          <span>REPORT INCIDENT</span>
        </button>
      </div>

      {/* Quick Report Modal */}
      <QuickReportModal
        isOpen={isQuickReportOpen}
        onClose={() => setIsQuickReportOpen(false)}
        onSubmitNewReport={handleAddNewReport}
        defaultCoordinates={selectedCoordinates}
      />

    </div>
  );
}
