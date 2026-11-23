
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import tw from "twrnc";

import { useAuth } from "../../context/AuthContext";
import { getReportStats } from "../../services/residentService";

const COLORS = {
  primary: "#1F7A4D",
  ink: "#0B2E22",
  muted: "#94A3B8",
  danger: "#DC2626",
  surface: "#F8FAFC",
};

const ACCOUNT_SETTINGS = [
  {
    icon: UserRound,
    label: "Edit Profile",
    description: "Update your name and profile details",
  },
  {
    icon: KeyRound,
    label: "Change Password",
    description: "Set a new account password",
  },
  {
    icon: Bell,
    label: "Notification Preferences",
    description: "Choose what alerts you receive",
  },
  {
    icon: ShieldCheck,
    label: "Privacy and Security",
    description: "Manage your account's safety",
  },
];

export default function Profile() {
  const { user, signOut } = useAuth();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch resident report statistics
  const fetchStats = useCallback(async (signal) => {
    try {
      const { data } = await getReportStats();

      if (!signal.aborted) {
        setStats(data?.stats ?? null);
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error(
          "Unable to load report statistics:",
          error.response?.data || error.message
        );
        setStats(null);
      }
    } finally {
      if (!signal.aborted) {
        setStatsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchStats(controller.signal);

    return () => controller.abort();
  }, [fetchStats]);

  // Generate user initials
  const initials = (user?.full_name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  // Handle account settings
  const handleSettingClick = (label) => {
    Alert.alert(
      label,
      "This setting is coming soon.",
      [{ text: "OK" }]
    );
  };

  // Handle logout
  const handleSignOut = () => {
    Alert.alert(
      "Log out?",
      "Are you sure you want to sign out of GeoFix 167?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              setLoggingOut(true);
              await signOut();
            } catch (error) {
              console.error("Logout failed:", error);

              Alert.alert(
                "Logout failed",
                error.message || "Please try again."
              );
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-4  pb-28`}
      >
        {/* PROFILE HEADER */}
        <View
          style={tw`mb-5 items-center rounded-2xl bg-green-50 px-4 py-8`}
        >
          <View
            style={tw`mb-3 h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-green-100`}
          >
            {initials ? (
              <Text style={tw`text-xl font-extrabold text-green-800`}>
                {initials}
              </Text>
            ) : (
              <UserRound size={40} color={COLORS.primary} />
            )}
          </View>

          <Text
            numberOfLines={1}
            style={tw`text-lg font-extrabold text-slate-900`}
          >
            {user?.full_name || "Resident"}
          </Text>

          <Text style={tw`mt-1 text-xs text-slate-500`}>
            Resident Account
          </Text>

          <View
            style={tw`mt-3 flex-row items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1`}
          >
            <BadgeCheck size={13} color="#059669" />
            <Text style={tw`text-[11px] font-bold text-emerald-600`}>
              Verified Account
            </Text>
          </View>
        </View>

        {/* ACCOUNT OVERVIEW */}
        <SectionTitle title="Account overview" />

        <View style={tw`mb-5 flex-row gap-3`}>
          <StatCard
            label="Total Reports"
            value={statsLoading ? null : stats?.total}
            color={COLORS.primary}
            loading={statsLoading}
          />

          <StatCard
            label="Resolved Reports"
            value={statsLoading ? null : stats?.resolved}
            color="#059669"
            loading={statsLoading}
          />
        </View>

        {/* PERSONAL INFORMATION */}
        <SectionTitle title="Personal information" />

        <View style={tw`mb-5 rounded-2xl border border-slate-100 bg-white px-3`}>
          <InfoRow
            icon={UserRound}
            label="Full name"
            value={user?.full_name || "—"}
          />

          <InfoRow
            icon={Mail}
            label="Email address"
            value={user?.email || "Not provided"}
          />

          <InfoRow
            icon={Phone}
            label="Mobile number"
            value={user?.mobile_number || "—"}
          />

          <InfoRow
            icon={MapPin}
            label="Residential address"
            value="Barangay 167, Caloocan City"
            last
          />
        </View>

        {/* ACCOUNT SETTINGS */}
        <SectionTitle title="Account settings" />

        <View style={tw`mb-5 rounded-2xl border border-slate-100 bg-white px-2`}>
          {ACCOUNT_SETTINGS.map(({ icon: Icon, label, description }, index) => (
            <Pressable
              key={label}
              onPress={() => handleSettingClick(label)}
              accessibilityRole="button"
              style={({ pressed }) => [
                tw`flex-row items-center gap-3 rounded-xl px-2 py-4`,
                {
                  backgroundColor: pressed ? "#F8FAFC" : "transparent",
                  borderBottomWidth:
                    index === ACCOUNT_SETTINGS.length - 1 ? 0 : 1,
                  borderBottomColor: "#F1F5F9",
                },
              ]}
            >
              <View
                style={tw`h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50`}
              >
                <Icon size={18} color={COLORS.primary} />
              </View>

              <View style={tw`min-w-0 flex-1`}>
                <Text style={tw`text-sm font-bold text-slate-800`}>
                  {label}
                </Text>

                <Text
                  numberOfLines={1}
                  style={tw`mt-0.5 text-[11px] text-slate-400`}
                >
                  {description}
                </Text>
              </View>

              <ChevronRight size={17} color="#CBD5E1" />
            </Pressable>
          ))}
        </View>

        {/* LOG OUT */}
        <Pressable
          onPress={handleSignOut}
          disabled={loggingOut}
          accessibilityRole="button"
          style={({ pressed }) => [
            tw`flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-4`,
            {
              opacity: pressed || loggingOut ? 0.65 : 1,
            },
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <LogOut size={17} color={COLORS.danger} />
          )}

          <Text style={tw`text-sm font-bold text-red-600`}>
            {loggingOut ? "Logging out..." : "Log Out"}
          </Text>
        </Pressable>

        <Text style={tw`mt-5 text-center text-[10px] text-slate-400`}>
          GeoFix 167 · Barangay 167 Resident Portal
        </Text>
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Components ─────────────────────────

function SectionTitle({ title }) {
  return (
    <Text style={tw`mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400`}>
      {title}
    </Text>
  );
}

function StatCard({ label, value, color, loading }) {
  return (
    <View
      style={tw`flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-white p-4`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[tw`text-2xl font-extrabold`, { color }]}>
          {value ?? "—"}
        </Text>
      )}

      <Text style={tw`mt-1 text-center text-[11px] font-medium text-slate-500`}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ icon: Icon, label, value, last = false }) {
  return (
    <View
      style={[
        tw`flex-row items-center gap-3 py-4`,
        !last && {
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        },
      ]}
    >
      <View
        style={tw`h-10 w-10 items-center justify-center rounded-full bg-slate-50`}
      >
        <Icon size={17} color="#94A3B8" />
      </View>

      <View style={tw`min-w-0 flex-1`}>
        <Text style={tw`text-[10px] font-semibold uppercase tracking-wide text-slate-400`}>
          {label}
        </Text>

        <Text
          numberOfLines={2}
          style={tw`mt-0.5 text-sm font-semibold text-slate-800`}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
