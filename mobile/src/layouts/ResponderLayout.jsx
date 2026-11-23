import { Pressable, Text, View } from 'react-native';
import {
  ClipboardList,
  Clock3,
  House,
  Map,
  MessageCircle,
  UserRound,
} from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';

import { useAuth } from '../context/AuthContext';

const COLORS = {
  brandDark: '#0B2E22',
  brand: '#1F7A4D',
  active: '#1F7A4D',
  inactive: '#94A3B8',
};

const NAV_ITEMS = [
  { route: 'Home', label: 'Dashboard', Icon: House },
  { route: 'History', label: 'History', Icon: Clock3 },
  { route: 'Map', label: 'Map', Icon: Map },
  { route: 'Profile', label: 'Profile', Icon: UserRound },
];

const MESSAGES_ITEM = {
  route: 'Messages',
  label: 'Messages',
  Icon: MessageCircle,
};

const NAV_ITEMS_BY_ROLE = {
  bdrrmo: [
    { route: 'Home', label: 'Home', Icon: House },
    { route: 'Dispatch', label: 'Dispatch', Icon: ClipboardList },
    { route: 'Map', label: 'Map', Icon: Map },
    MESSAGES_ITEM,
    { route: 'Profile', label: 'Profile', Icon: UserRound },
  ],

  police: [
    NAV_ITEMS[0], // Dashboard
    MESSAGES_ITEM,
    NAV_ITEMS[2], // Map
    NAV_ITEMS[1], // History
    NAV_ITEMS[3], // Profile
  ],

  fire: [
    NAV_ITEMS[0], // Dashboard
    MESSAGES_ITEM,
    NAV_ITEMS[2], // Map
    NAV_ITEMS[1], // History
    NAV_ITEMS[3], // Profile
  ],

  tanod: [
    NAV_ITEMS[0], // Dashboard
    MESSAGES_ITEM,
    NAV_ITEMS[2], // Map
    NAV_ITEMS[1], // History
    NAV_ITEMS[3], // Profile
  ],
};

const ROLE_LABELS = {
  bdrrmo: 'BDRRMO',
  police: 'Police',
  fire: 'BFP',
  tanod: 'Tanod',
};

const HIDDEN_NAV_ROUTES = new Set([
  'Messages',
  'Call',
  'IncidentDetails',
  'HistoryDetails',
  'Map',
  'Navigation',
]);

export function ResponderNavBar({ currentRoute, onNavigate }) {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const navItems = NAV_ITEMS_BY_ROLE[role] || NAV_ITEMS;

  if (HIDDEN_NAV_ROUTES.has(currentRoute)) return null;

  return (
    <SafeAreaView edges={['bottom']} style={tw`bg-slate-50 px-3 pb-2 pt-1`}>
      <View
        style={[
          tw`flex-row rounded-3xl border border-slate-200 bg-white px-1.5 py-1.5`,
          {
            shadowColor: '#0F172A',
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
        ]}
      >
        {navItems.map((item) => (
          <NavTab
            key={item.route}
            item={item}
            isActive={currentRoute === item.route}
            onPress={() => {
              if (currentRoute !== item.route) onNavigate(item.route);
            }}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}


function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'R';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function NavTab({ item, isActive, onPress }) {
  const { label, Icon } = item;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} tab`}
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [tw`flex-1 items-center justify-center py-1`, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          tw`h-8 w-12 items-center justify-center rounded-full`,
          isActive ? tw`bg-green-50` : null,
        ]}
      >
        <Icon
          size={20}
          color={isActive ? COLORS.active : COLORS.inactive}
          strokeWidth={isActive ? 2.4 : 2}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          tw`mt-0.5 text-center text-[10px]`,
          isActive ? tw`font-bold text-[#1F7A4D]` : [tw`font-medium`, { color: COLORS.inactive }],
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ResponderLayout({ children }) {
  const { user, onDuty, toggleDuty, dutyBusy, dutyError, retryDuty } = useAuth();
  const { name: currentRoute } = useRoute();
  const role = String(user?.role || '').toLowerCase();

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top']}>
      {currentRoute !== 'Map' && currentRoute !== 'Navigation' && currentRoute !== 'IncidentDetails' && currentRoute !== 'HistoryDetails' && currentRoute !== 'Messages' && currentRoute !== 'Call' && currentRoute !== 'History' && currentRoute !== 'Profile' ? (
        <>
          {/* Header */}
          <View
            style={tw`flex-row items-center rounded-b-3xl border-b border-slate-200 bg-white px-4 pb-3.5 pt-3`}
          >
            <View style={tw`h-11 w-11 items-center justify-center rounded-full border border-green-200 bg-green-50`}>
              <Text style={tw`text-sm font-extrabold text-[#1F7A4D]`}>
                {getInitials(user?.full_name)}
              </Text>
            </View>

            <View style={tw`ml-3 flex-1`}>
              <Text numberOfLines={1} style={tw`mt-0.5 text-base font-bold text-slate-900`}>
                {user?.full_name || 'Responder'}
              </Text>
              <Text style={tw`mt-0.5 text-xs font-semibold text-[#1F7A4D]`}>
                {ROLE_LABELS[role] || 'Responder'}
              </Text>
            </View>

            <Pressable
              disabled={dutyBusy || onDuty === null}
              onPress={() => void toggleDuty()}
              accessibilityRole="button"
              accessibilityLabel={onDuty ? 'Set responder off duty' : 'Set responder on duty'}
              accessibilityState={{ selected: onDuty === true }}
              style={({ pressed }) => [
                tw`flex-row items-center rounded-full border px-2.5 py-2 ${onDuty ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-100'
                  }`,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  tw`mr-1.5 h-2 w-2 rounded-full`,
                  { backgroundColor: onDuty ? COLORS.brand : '#94A3B8' },
                ]}
              />
              <Text
                style={tw`pr-0.5 text-[10px] font-bold ${onDuty ? 'text-[#1F7A4D]' : 'text-slate-500'
                  }`}
              >
                {onDuty === null ? 'Duty unconfirmed' : onDuty ? 'ON DUTY' : 'OFF DUTY'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {dutyError && <View style={tw`bg-red-50 px-4 py-2`}>
        <Text accessibilityRole="alert">{dutyError}</Text>
        <Pressable accessibilityRole="button" disabled={dutyBusy} onPress={retryDuty}>
          <Text style={tw`py-2 font-bold text-green-700`}>Retry duty status</Text>
        </Pressable>
      </View>}
      {/* Content */}
      <View style={tw`flex-1`}>
        <View style={tw`flex-1`}>{children}</View>
      </View>
    </SafeAreaView>
  );
}