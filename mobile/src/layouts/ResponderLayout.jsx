import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  ClipboardList,
  Clock3,
  House,
  LogOut,
  Map,
  MessageCircle,
  UserRound,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';

import { useAuth } from '../context/AuthContext';
import { getMapLocationPermissionParams } from '../services/locationPermissionService';
import { getResponderDispatches } from '../services/responderDispatchService';

const NAV_ITEMS = [
  { route: 'Home', label: 'Home', Icon: House },
  { route: 'Assignments', label: 'Assignments', Icon: ClipboardList },
  { route: 'Map', label: 'Map', Icon: Map },
  { route: 'History', label: 'History', Icon: Clock3 },
  { route: 'Profile', label: 'Profile', Icon: UserRound },
];

const NAV_ITEMS_BY_ROLE = {
  bdrrmo: [
    { route: 'Home', label: 'Home', Icon: House },
    { route: 'Dispatch', label: 'Dispatch', Icon: ClipboardList },
    { route: 'Map', label: 'Map', Icon: Map },
    { route: 'Messages', label: 'Messages', Icon: MessageCircle },
    { route: 'Profile', label: 'Profile', Icon: UserRound },
  ],
  police: [...NAV_ITEMS.slice(0, 3), { route: 'Messages', label: 'Messages', Icon: MessageCircle }, ...NAV_ITEMS.slice(3)],
  fire: [...NAV_ITEMS.slice(0, 3), { route: 'Messages', label: 'Messages', Icon: MessageCircle }, ...NAV_ITEMS.slice(3)],
};

const ROLE_LABELS = {
  bdrrmo: 'BDRRMO',
  police: 'Police',
  fire: 'BFP',
};

export default function ResponderLayout({ children }) {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const { name: currentRoute } = useRoute();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const role = String(user?.role || '').toLowerCase();
  const navItems = NAV_ITEMS_BY_ROLE[role] || NAV_ITEMS;

  async function openActiveAssignmentMap() {
    if (!activeAssignment) return;
    const locationParams = await getMapLocationPermissionParams();
    navigation.navigate('Map', { assignment: activeAssignment, ...locationParams });
  }

  useFocusEffect(useCallback(() => {
    if (currentRoute === 'Map') return undefined;
    let active = true;
    getResponderDispatches()
      .then((dispatches) => {
        if (!active) return;
        setActiveAssignment(dispatches.find((assignment) =>
          ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'].includes(assignment.status)) ?? null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [currentRoute]));

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
      <View style={tw`flex-row items-center justify-between bg-[#0B2E22] px-5 py-4`}>
        <View>
          <Text style={tw`text-xs font-bold uppercase tracking-widest text-green-200`}>
            GeoFix 167
          </Text>
          <Text style={tw`mt-1 text-lg font-bold text-white`}>
            {ROLE_LABELS[role] || 'Responder'}
          </Text>
          <Text style={tw`mt-0.5 text-xs text-green-100`}>
            {user?.full_name || 'Responder'}
          </Text>
        </View>
        <Pressable
          onPress={confirmSignOut}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            tw`h-11 w-11 items-center justify-center rounded-xl bg-white/10`,
            { opacity: pressed || loggingOut ? 0.6 : 1 },
          ]}
        >
          <LogOut size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={tw`flex-1`}>
        {currentRoute !== 'Map' && activeAssignment ? (
          <Pressable
            onPress={() => void openActiveAssignmentMap()}
            accessibilityRole="button"
            accessibilityLabel="View active response in map"
            style={({ pressed }) => [
              tw`mx-3 mt-2 flex-row items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2.5`,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={tw`flex-1 pr-3`}>
              <Text style={tw`text-[10px] font-extrabold uppercase tracking-wider text-green-800`}>Active response</Text>
              <Text numberOfLines={1} style={tw`mt-0.5 text-xs font-semibold text-slate-800`}>
                {activeAssignment.incident_title || activeAssignment.incident_category || 'Incident assignment'}
              </Text>
            </View>
            <View style={tw`flex-row items-center gap-1`}>
              <Map size={14} color="#1F7A4D" />
              <Text style={tw`text-xs font-bold text-green-800`}>View in map</Text>
            </View>
          </Pressable>
        ) : null}
        <View style={tw`flex-1`}>{children}</View>
      </View>
      <View style={tw`flex-row border-t border-slate-200 bg-white px-1 pt-2`}>
        {navItems.map(({ route, label, Icon }) => {
          const isActive = currentRoute === route;

          return (
            <Pressable
              key={route}
              onPress={() => navigation.navigate(route)}
              accessibilityRole="button"
              accessibilityLabel={`${label} tab`}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                tw`flex-1 items-center justify-center rounded-xl py-2`,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Icon size={20} color={isActive ? '#1F7A4D' : '#64748B'} />
              <Text
                numberOfLines={1}
                style={
                  isActive
                    ? tw`mt-1 text-center text-[10px] font-bold text-[#1F7A4D]`
                    : tw`mt-1 text-center text-[10px] font-medium text-slate-500`
                }
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
