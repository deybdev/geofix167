import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  BadgeCheck,
  ChevronRight,
  ClipboardList,
  LogOut,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';

const ACTIVE_STATUSES = ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE'];

function ProfileRow({ icon: Icon, label, value }) {
  return (
    <View style={tw`flex-row items-center gap-3 border-b border-slate-100 py-4`}>
      <View style={tw`h-10 w-10 items-center justify-center rounded-xl bg-slate-50`}>
        <Icon size={18} color="#17633F" />
      </View>
      <View style={tw`flex-1`}>
        <Text style={tw`text-xs font-semibold text-slate-500`}>{label}</Text>
        <Text style={tw`mt-1 text-base font-semibold text-slate-900`}>{value}</Text>
      </View>
    </View>
  );
}

export default function TanodProfile() {
  const { user, signOut } = useAuth();
  const [activeCount, setActiveCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadDutyState = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const dispatches = await getResponderDispatches();
      setActiveCount(dispatches.filter((item) => ACTIVE_STATUSES.includes(item.status)).length);
    } catch {
      setActiveCount(0);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDutyState(); }, [loadDutyState]));

  const confirmSignOut = () => {
    const message = activeCount
      ? `You have ${activeCount} active field task${activeCount === 1 ? '' : 's'}. Sign out only after BDRRMO has been informed.`
      : 'You will need to sign in again to access your assignments.';
    Alert.alert('Sign out of GeoFix?', message, [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await signOut();
          } catch {
            setLoggingOut(false);
            Alert.alert('Unable to sign out', 'Please check your connection and try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={tw`flex-1 bg-slate-50`}
      contentContainerStyle={tw`px-4 pb-10 pt-6`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDutyState(true)} colors={['#17633F']} tintColor="#17633F" />}
    >
      <Text style={tw`text-[28px] font-extrabold leading-9 text-slate-950`}>Profile</Text>
      <Text style={tw`mt-2 text-base leading-6 text-slate-600`}>Your GeoFix Tanod account and current duty status.</Text>

      <View style={tw`mt-6 overflow-hidden rounded-3xl bg-[#0B2E22] p-6`}>
        <View style={tw`h-16 w-16 items-center justify-center rounded-2xl bg-white/10`}>
          <UserRound size={31} color="#DCFCE7" />
        </View>
        <Text style={tw`mt-5 text-2xl font-bold text-white`}>{user?.full_name || 'Tanod Officer'}</Text>
        <View style={tw`mt-3 self-start flex-row items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5`}>
          <ShieldCheck size={15} color="#17633F" />
          <Text style={tw`text-xs font-extrabold uppercase tracking-wide text-[#17633F]`}>Tanod account</Text>
        </View>
      </View>

      <View style={tw`mt-5 rounded-3xl border border-slate-200 bg-white px-4`}>
        <ProfileRow icon={UserRound} label="Full name" value={user?.full_name || 'Not available'} />
        <ProfileRow icon={Phone} label="Mobile number" value={user?.mobile_number || 'Not available'} />
        <ProfileRow icon={BadgeCheck} label="Account role" value="Barangay Tanod" />
      </View>

      <View style={tw`mt-5 rounded-3xl border border-slate-200 bg-white p-5`}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`h-11 w-11 items-center justify-center rounded-xl bg-emerald-50`}>
              <ClipboardList size={20} color="#17633F" />
            </View>
            <View>
              <Text style={tw`text-base font-bold text-slate-950`}>Duty status</Text>
              <Text style={tw`mt-1 text-sm text-slate-500`}>Synced with your current assignments</Text>
            </View>
          </View>
          <View style={tw`rounded-full px-3 py-1.5 ${activeCount ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <Text style={tw`text-xs font-bold ${activeCount ? 'text-amber-800' : 'text-emerald-800'}`}>
              {activeCount ? `${activeCount} active` : 'Available'}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out of GeoFix"
        onPress={confirmSignOut}
        disabled={loggingOut}
        style={({ pressed }) => [tw`mt-7 min-h-13 flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4`, { opacity: pressed || loggingOut ? 0.6 : 1 }]}
      >
        <LogOut size={18} color="#B42318" />
        <Text style={tw`text-base font-bold text-red-700`}>{loggingOut ? 'Signing out…' : 'Sign out'}</Text>
        <ChevronRight size={17} color="#B42318" />
      </Pressable>
    </ScrollView>
  );
}
