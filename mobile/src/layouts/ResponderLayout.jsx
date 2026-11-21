import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import {
  ClipboardList,
  Clock3,
  House,
  LogOut,
  Map,
  MessageCircle,
  UserRound,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';

import { useAuth } from '../context/AuthContext';

const COLORS = {
  brandDark: '#0B2E22',
  brand: '#1F7A4D',
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
};

const ROLE_LABELS = {
  bdrrmo: 'BDRRMO',
  police: 'Police',
  fire: 'BFP',
};


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
          tw`h-8 w-14 items-center justify-center rounded-full`,
          isActive ? tw`bg-green-100` : null,
        ]}
      >
        <Icon size={21} color={isActive ? COLORS.brand : COLORS.inactive} strokeWidth={isActive ? 2.4 : 2} />
      </View>
      <Text
        numberOfLines={1}
        style={tw`mt-1 text-center text-[10px] ${isActive ? 'font-bold text-[#1F7A4D]' : 'font-medium text-slate-400'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ResponderLayout({ children }) {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const { name: currentRoute } = useRoute();
  const [loggingOut, setLoggingOut] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
  const role = String(user?.role || '').toLowerCase();
  const navItems = NAV_ITEMS_BY_ROLE[role] || NAV_ITEMS;


  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await signOut();
          } catch (error) {
            setLoggingOut(false);
            console.error('Responder logout failed:', error);
            Alert.alert('Error', 'Unable to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-slate-50`} edges={['top', 'bottom']}>
      {currentRoute !== 'Map' ? (
        <>
          {/* Header */}
          <View
            style={tw`flex-row items-center bg-[#0B2E22] px-4 pb-4 pt-3 rounded-b-3xl`}
          >
            <View style={tw`h-11 w-11 items-center justify-center rounded-full bg-green-400/20`}>
              <Text style={tw`text-sm font-extrabold text-green-100`}>
                {getInitials(user?.full_name)}
              </Text>
            </View>

            <View style={tw`ml-3 flex-1`}>
              <Text numberOfLines={1} style={tw`mt-0.5 text-base font-bold text-white`}>
                {user?.full_name || 'Responder'}
              </Text>
              <Text style={tw`mt-0.5 text-xs font-medium text-green-200`}>
                {ROLE_LABELS[role] || 'Responder'}
              </Text>
            </View>

            <Pressable
              onPress={() => setOnDuty((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={onDuty ? 'Set responder off duty' : 'Set responder on duty'}
              accessibilityState={{ selected: onDuty }}
              style={({ pressed }) => [
                tw`mr-2 flex-row items-center rounded-full border px-2.5 py-2`,
                {
                  backgroundColor: onDuty ? 'rgba(74, 222, 128, 0.18)' : 'rgba(148, 163, 184, 0.18)',
                  borderColor: onDuty ? 'rgba(74, 222, 128, 0.55)' : 'rgba(148, 163, 184, 0.45)',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  tw`mr-1.5 h-2 w-2 rounded-full`,
                  { backgroundColor: onDuty ? '#4ADE80' : '#94A3B8' },
                ]}
              />
              <Text style={tw`text-[10px] font-extrabold text-white`}>
                {onDuty ? 'ON DUTY' : 'OFF DUTY'}
              </Text>
            </Pressable>

            <Pressable
              onPress={confirmSignOut}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              hitSlop={8}
              style={({ pressed }) => [
                tw`h-11 w-11 items-center justify-center rounded-full bg-white/10`,
                { opacity: pressed || loggingOut ? 0.6 : 1 },
              ]}
            >
              {loggingOut ? <ActivityIndicator size="small" color="#fff" /> : <LogOut size={19} color="#fff" />}
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Content */}
      <View style={tw`flex-1`}>
        <View style={tw`flex-1`}>{children}</View>
      </View>

      {/* Bottom navigation */}
      <View
        style={[
          tw`flex-row rounded-t-3xl bg-white px-2 pb-1 pt-2`,
          {
            shadowColor: '#0F172A',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -3 },
            elevation: 12,
          },
        ]}
      >
        {navItems.map((item) => (
          <NavTab
            key={item.route}
            item={item}
            isActive={currentRoute === item.route}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}