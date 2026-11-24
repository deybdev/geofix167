
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  FileText,
  Plus,
  ChevronRight,
  RefreshCw,
} from "lucide-react-native";
import tw from "twrnc";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { getReports } from "../../services/residentService";

const STATUS_LABELS = {
  submitted: {
    label: "Submitted",
    background: "#F1F5F9",
    color: "#334155",
  },
  under_review: {
    label: "Under Review",
    background: "#DBEAFE",
    color: "#1D4ED8",
  },
  assigned: {
    label: "Assigned",
    background: "#F3E8FF",
    color: "#7E22CE",
  },
  in_progress: {
    label: "In Progress",
    background: "#FEF3C7",
    color: "#B45309",
  },
  resolved: {
    label: "Resolved",
    background: "#DCFCE7",
    color: "#15803D",
  },
  rejected: {
    label: "Rejected",
    background: "#FEE2E2",
    color: "#B91C1C",
  },
  linked_duplicate: {
    label: "Linked Duplicate",
    background: "#F1F5F9",
    color: "#334155",
  },
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Closed" },
  { value: "rejected", label: "Rejected" },
  { value: "linked_duplicate", label: "Duplicate" },
];

const CATEGORY_LABELS = {
  fire: "Fire",
  medical: "Medical",
  crime: "Crime or Threat",
  accident: "Road Accident",
  flood: "Flood or Storm",
  road: "Road Damage",
  streetlight: "Streetlight",
  drainage: "Drainage",
  garbage: "Garbage",
  utilities: "Water / Electricity",
  other: "Other",
};

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function MyReports() {
  const navigation = useNavigation();
  const route = useRoute();

  const [activeFilter, setActiveFilter] = useState(
    route.params?.status ?? ""
  );
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);

  const fetchReports = useCallback(
    async (signal) => {
      try {
        setError(null);

        const { data } = await getReports({
          status: activeFilter,
          signal,
        });

        if (!signal.aborted) {
          setReports(
            Array.isArray(data?.reports) ? data.reports : []
          );
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load reports."
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeFilter]
  );

  const loadReports = useCallback(() => {
    requestRef.current?.abort();
    setRefreshing(true);
    const controller = new AbortController();
    requestRef.current = controller;
    fetchReports(controller.signal);
  }, [fetchReports]);

  useFocusEffect(useCallback(() => {
    loadReports();
    return () => requestRef.current?.abort();
  }, [loadReports]));

  const onRefresh = () => {
    setRefreshing(true);

    loadReports();
  };

  const retry = () => {
    setLoading(true);
    setError(null);

    loadReports();
  };

  const isOngoingEmergency = (report) =>
    report?.report_type === "emergency" && !report?.is_terminal;

  const openReport = (report) => {
    if (isOngoingEmergency(report)) {
      const priority =
        {
          Critical: 1,
          High: 2,
          Moderate: 3,
          Low: 4,
        }[report.urgency] ?? null;
      const location =
        Number.isFinite(report.latitude) && Number.isFinite(report.longitude)
          ? { lat: report.latitude, lng: report.longitude }
          : null;

      navigation.navigate("Track", {
        reportId: report.public_id,
        location,
        priority,
      });
      return;
    }

    navigation.navigate("ReportDetails", {
      publicId: report.public_id,
    });
  };

  const openNewReport = () => {
    navigation.navigate("Report");
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-4 pt-4 pb-28`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1F7A4D"]}
            tintColor="#1F7A4D"
          />
        }
      >
        {/* NEW REPORT BUTTON */}
        <View style={tw`mb-4 flex-row justify-end`}>
          <Pressable
            onPress={openNewReport}
            accessibilityRole="button"
            accessibilityLabel="Create new report"
            style={({ pressed }) => [
              tw`flex-row items-center gap-1.5 rounded-xl bg-green-700 px-3 py-2`,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={tw`text-xs font-bold text-white`}>
              New Report
            </Text>
          </Pressable>
        </View>

        {/* STATUS FILTERS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={tw`mb-4`}
          contentContainerStyle={tw`gap-2`}
        >
          {FILTERS.map(({ value, label }) => {
            const active = activeFilter === value;

            return (
              <Pressable
                key={value}
                onPress={() => {
                  if (value !== activeFilter) {
                    setLoading(true);
                    setError(null);
                    setActiveFilter(value);
                  }
                }}
                style={({ pressed }) => [
                  tw`rounded-full px-4 py-2`,
                  {
                    backgroundColor: active ? "#1F7A4D" : "#E2E8F0",
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    tw`text-xs font-semibold`,
                    { color: active ? "#FFFFFF" : "#475569" },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* LOADING */}
        {loading && (
          <View style={tw`gap-3`}>
            {[1, 2, 3].map((item) => (
              <View
                key={item}
                style={tw`h-28 rounded-2xl bg-slate-200`}
              />
            ))}
            <ActivityIndicator
              size="small"
              color="#1F7A4D"
              style={tw`mt-2`}
            />
          </View>
        )}

        {/* ERROR */}
        {!loading && error && (
          <View
            style={tw`rounded-2xl border border-red-100 bg-red-50 p-4`}
          >
            <Text style={tw`text-sm font-semibold text-red-700`}>
              Unable to load reports
            </Text>

            <Text style={tw`mt-1 text-xs text-red-600`}>
              {error}
            </Text>

            <Pressable
              onPress={retry}
              style={tw`mt-3 flex-row items-center gap-2`}
            >
              <RefreshCw size={14} color="#B91C1C" />
              <Text style={tw`text-xs font-bold text-red-700`}>
                Try again
              </Text>
            </Pressable>
          </View>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && reports.length === 0 && (
          <View style={tw`items-center px-6 py-16`}>
            <View
              style={tw`mb-4 h-16 w-16 items-center justify-center rounded-full bg-slate-200`}
            >
              <FileText size={30} color="#94A3B8" />
            </View>

            <Text style={tw`text-base font-bold text-slate-700`}>
              No reports found
            </Text>

            <Text style={tw`mt-2 text-center text-xs leading-5 text-slate-500`}>
              {activeFilter
                ? "No reports with this status."
                : "You haven't submitted any reports yet."}
            </Text>

            <Pressable
              onPress={openNewReport}
              style={tw`mt-5 rounded-xl bg-green-700 px-5 py-3`}
            >
              <Text style={tw`text-xs font-bold text-white`}>
                Submit a Report
              </Text>
            </Pressable>
          </View>
        )}

        {/* REPORT LIST */}
        {!loading && !error && reports.length > 0 && (
          <View style={tw`gap-3`}>
            {reports.map((report) => {
              const status = STATUS_LABELS[report.status] || {
                label: report.status || "Unknown",
                background: "#F1F5F9",
                color: "#334155",
              };

              const category =
                CATEGORY_LABELS[report.category] ||
                report.category ||
                "Other";

              return (
                <Pressable
                  key={report.public_id}
                  onPress={() => openReport(report)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isOngoingEmergency(report)
                      ? `Track ongoing emergency report ${report.public_id}`
                      : `View report ${report.public_id}`
                  }
                  style={({ pressed }) => [
                    tw`flex-row items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4`,
                    {
                      elevation: pressed ? 1 : 2,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {/* REPORT PHOTO */}
                  {report.photo_url ? (
                    <Image
                      source={{ uri: report.photo_url }}
                      style={tw`h-16 w-16 rounded-xl bg-slate-100`}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={tw`h-16 w-16 items-center justify-center rounded-xl bg-slate-100`}
                    >
                      <FileText size={24} color="#94A3B8" />
                    </View>
                  )}

                  {/* REPORT DETAILS */}
                  <View style={tw`min-w-0 flex-1`}>
                    <View style={tw`flex-row items-center justify-between gap-2`}>
                      <Text
                        numberOfLines={1}
                        style={tw`flex-1 text-[10px] font-bold uppercase text-slate-400`}
                      >
                        #{String(report.public_id || "").slice(-8).toUpperCase()}
                      </Text>

                      <View
                        style={[
                          tw`rounded-full px-2 py-1`,
                          { backgroundColor: status.background },
                        ]}
                      >
                        <Text
                          style={[
                            tw`text-[9px] font-bold`,
                            { color: status.color },
                          ]}
                        >
                          {report.status_label || status.label}
                        </Text>
                      </View>
                    </View>

                    <Text
                      numberOfLines={1}
                      style={tw`mt-1 text-sm font-bold text-slate-800`}
                    >
                      {report.title || category}
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={tw`mt-1 text-xs leading-4 text-slate-500`}
                    >
                      {report.description || "No description provided."}
                    </Text>

                    <View style={tw`mt-2 flex-row items-center`}>
                      <Text
                        numberOfLines={1}
                        style={tw`flex-1 text-[10px] text-slate-400`}
                      >
                        {report.address || "—"} · {formatDate(report.created_at)}
                      </Text>

                      <ChevronRight size={16} color="#CBD5E1" />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
