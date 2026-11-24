import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Vibration,
  ToastAndroid,
  Platform,
} from "react-native";
import { getNotifications } from "../services/residentService";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  House,
  Map,
  Plus,
  FileText,
  UserRound,
  Bell,
  ChevronLeft,
  ArrowLeft,
  LogOut,
  Siren,
} from "lucide-react-native";
import tw from "twrnc";
import { useAuth } from "../context/AuthContext";

// ───────────────────────── Config ─────────────────────────
const SOS_TAPS = 5;
const SOS_WINDOW_MS = 2000;

const COLORS = {
  ink: "#0B2E22",
  brand: "#1F7A4D",
  mint: "#D9F2E3",
  muted: "#8A9A92",
  surface: "#F4F7F5",
  danger: "#E5322D",
};

// Screens opened from the tab bar vs. pushed on top of it
const TABS = {
  Resident: { label: "Home", icon: House },
  Map: { label: "Map", icon: Map },
  Report: { label: "Report", icon: Plus },
  MyReports: { label: "Reports", icon: FileText },
  Profile: { label: "Profile", icon: UserRound },
};

const LEFT_TABS = ["Resident", "Map"];
const RIGHT_TABS = ["MyReports", "Profile"];

const SUB_PAGE_TITLES = {
  MyReports: "My Reports",
  ReportDetails: "Report Details",
  Notifications: "Notifications",
  Emergency: "Emergency",
  PhotoCapture: "Photo Capture",
  Profile: "Profile",
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("") || "R";

// ───────────────────────── Layout ─────────────────────────
export default function ResidentLayout({ children, routeName }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const [unread, setUnread] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const isMapPage = routeName === "Map";
  const isFullScreenMapPage = isMapPage || routeName === "Track";
  const isReportPage = routeName === "Report";
  const subTitle = SUB_PAGE_TITLES[routeName];
  const isSubPage = Boolean(subTitle);
  const showChrome = !isSubPage && !isFullScreenMapPage;

  const fullName = user?.full_name || "Resident";
  const firstName = useMemo(() => fullName.split(" ")[0], [fullName]);

  useFocusEffect(useCallback(() => {
    if (!showChrome || !user) return;
    const controller = new AbortController();
    getNotifications({ signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setUnread(data.unread_count);
      })
      .catch(() => {}); // Keep the last confirmed badge until the next focus.
    return () => controller.abort();
  }, [showChrome, user]));

  const go = (screen) => {
    if (routeName !== screen) navigation.navigate(screen);
  };

  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate("Resident");

  const confirmSignOut = () =>
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            setLoggingOut(true);
            await signOut();
          } catch (e) {
            console.error("Logout failed:", e);
            const msg = "Unable to sign out. Please try again.";
            if (Platform.OS === "android") {
              ToastAndroid.show(msg, ToastAndroid.SHORT);
            } else {
              Alert.alert("Error", msg);
            }
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);

  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View style={[tw`flex-1`, { backgroundColor: COLORS.surface }]}>
      {/* MAP AND TRACKING SCREENS USE THE FULL VIEWPORT */}
      {isFullScreenMapPage ? (
        <View style={tw`flex-1`}>
          {children}

          {/* Floating back button */}
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              tw`absolute left-4 items-center justify-center rounded-2xl bg-white`,
              {
                top: insets.top + 12,
                width: 46,
                height: 46,
                elevation: 8,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <ArrowLeft size={23} color={COLORS.ink} />
          </Pressable>
        </View>
      ) : isReportPage ? (
        <View style={tw`flex-1`}>{children}</View>
      ) : (
        <>
          {/* HEADER */}
          <View
            style={[
              tw`px-5 pb-5`,
              {
                backgroundColor: "#FFFFFF",
                paddingTop: insets.top + 12,
                borderBottomLeftRadius: 28,
                borderBottomRightRadius: 28,
                zIndex: 10,
                elevation: 8,
                shadowColor: "#0F172A",
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              },
            ]}
          >
            <View style={tw`flex-row items-center`}>
              {isSubPage ? (
                <>
                  <HeaderButton onPress={goBack} label="Go back">
                    <ChevronLeft size={22} color={COLORS.ink} />
                  </HeaderButton>

                  <Text
                    style={[tw`ml-3 flex-1 text-lg font-bold`, { color: COLORS.ink }]}
                    numberOfLines={1}
                  >
                    {subTitle}
                  </Text>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => go("Profile")}
                    accessibilityLabel="Open profile"
                    style={[
                      tw`h-11 w-11 items-center justify-center rounded-2xl`,
                      { backgroundColor: COLORS.mint },
                    ]}
                  >
                    <Text
                      style={[
                        tw`text-base font-extrabold`,
                        { color: COLORS.ink },
                      ]}
                    >
                      {initialsOf(fullName)}
                    </Text>
                  </Pressable>

                  <View style={tw`ml-3 flex-1`}>
                    <Text style={tw`text-xs text-slate-500`}>{greeting()}</Text>

                    <Text
                      style={[tw`text-lg font-bold`, { color: COLORS.ink }]}
                      numberOfLines={1}
                    >
                      {firstName}
                    </Text>
                  </View>
                </>
              )}

              <View style={tw`flex-row gap-2`}>
                {routeName !== "Notifications" && (
                  <HeaderButton
                    onPress={() => go("Notifications")}
                    label="Notifications"
                  >
                    <Bell size={20} color={COLORS.ink} />

                    {unread > 0 && (
                      <View
                        style={[
                          tw`absolute -right-1 -top-1 min-w-4 h-4 items-center justify-center rounded-full px-1`,
                          { backgroundColor: COLORS.danger },
                        ]}
                      >
                        <Text style={tw`text-[9px] font-bold text-white`}>
                          {unread > 9 ? "9+" : unread}
                        </Text>
                      </View>
                    )}
                  </HeaderButton>
                )}

                {showChrome && (
                  <HeaderButton
                    onPress={confirmSignOut}
                    disabled={loggingOut}
                    label="Sign out"
                  >
                    <LogOut size={19} color={COLORS.ink} />
                  </HeaderButton>
                )}
              </View>
            </View>
          </View>

          {/* SCREEN CONTENT */}
          <View style={tw`flex-1`}>{children}</View>

          {/* BOTTOM NAVIGATION */}
          {showChrome && (
            <View
              pointerEvents="box-none"
              style={[tw`absolute left-4 right-4`, { bottom: bottomInset }]}
            >
              <View
                style={[
                  tw`flex-row items-center justify-between rounded-3xl bg-white px-2`,
                  {
                    height: 64,
                    elevation: 12,
                    shadowColor: COLORS.ink,
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                  },
                ]}
              >
                {LEFT_TABS.map((key) => (
                  <TabItem
                    key={key}
                    tab={TABS[key]}
                    active={routeName === key}
                    onPress={() => go(key)}
                  />
                ))}

                <View style={{ width: 72 }} />

                {RIGHT_TABS.map((key) => (
                  <TabItem
                    key={key}
                    tab={TABS[key]}
                    active={routeName === key}
                    onPress={() => go(key)}
                  />
                ))}
              </View>

              <Pressable
                onPress={() => go("Report")}
                accessibilityRole="button"
                accessibilityLabel="Report an issue"
                style={({ pressed }) => [
                  tw`absolute self-center items-center justify-center rounded-full`,
                  {
                    top: -18,
                    width: 62,
                    height: 62,
                    backgroundColor: COLORS.brand,
                    borderWidth: 5,
                    borderColor: COLORS.surface,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                    elevation: 14,
                  },
                ]}
              >
                <Plus size={28} color="#fff" strokeWidth={2.8} />
              </Pressable>
            </View>
          )}

          {/* SOS */}
          {showChrome && (
            <View
              pointerEvents="box-none"
              style={[tw`absolute right-5`, { bottom: bottomInset + 88 }]}
            >
              <SosButton
                onTriggered={() =>
                  navigation.navigate("Report", {
                    reportType: "emergency",
                    sosTriggeredAt: Date.now(),
                  })
                }
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ───────────────────────── Pieces ─────────────────────────
function HeaderButton({ children, onPress, label, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        tw`h-10 w-10 items-center justify-center rounded-2xl`,
        {
          backgroundColor: COLORS.surface,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function TabItem({ tab, active, onPress }) {
  const Icon = tab.icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      style={tw`flex-1 items-center justify-center`}
    >
      <View
        style={[
          tw`h-11 w-11 items-center justify-center rounded-2xl`,
          {
            backgroundColor: active ? COLORS.mint : "transparent",
          },
        ]}
      >
        <Icon
          size={22}
          color={active ? COLORS.brand : COLORS.muted}
          strokeWidth={active ? 2.5 : 2}
        />
      </View>
    </Pressable>
  );
}

function SosButton({ onTriggered }) {
  const taps = useRef([]);
  const timer = useRef(null);
  const [count, setCount] = useState(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const reset = () => {
    taps.current = [];
    setCount(0);
  };

  const handlePress = () => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter(
      (t) => now - t <= SOS_WINDOW_MS,
    );
    clearTimeout(timer.current);

    if (taps.current.length >= SOS_TAPS) {
      reset();
      Vibration.vibrate(200);
      onTriggered();
      return;
    }

    Vibration.vibrate(15);
    setCount(taps.current.length);
    timer.current = setTimeout(reset, SOS_WINDOW_MS);
  };

  return (
    <View style={tw`items-end`}>
      {count > 0 && (
        <View
          style={tw`mb-2 flex-row items-center rounded-full bg-white px-3 py-1.5 shadow`}
        >
          {Array.from({ length: SOS_TAPS }).map((_, i) => (
            <View
              key={i}
              style={[
                tw`mx-0.5 h-1.5 w-4 rounded-full`,
                { backgroundColor: i < count ? COLORS.danger : "#E5E7EB" },
              ]}
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`SOS emergency. Tap ${SOS_TAPS} times quickly to continue.`}
        style={({ pressed }) => [
          tw`h-14 w-14 items-center justify-center rounded-full`,
          {
            backgroundColor: COLORS.danger,
            borderWidth: 3,
            borderColor: "#fff",
            elevation: 10,
            shadowColor: COLORS.danger,
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            transform: [{ scale: pressed ? 0.93 : 1 }],
          },
        ]}
      >
        <Siren size={22} color="#fff" strokeWidth={2.4} />
        <Text style={tw`text-[9px] font-black tracking-widest text-white`}>
          SOS
        </Text>
      </Pressable>
    </View>
  );
}
