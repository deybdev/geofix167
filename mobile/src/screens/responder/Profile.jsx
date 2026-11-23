import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Power,
  ShieldCheck,
  Vibrate,
  X,
} from 'lucide-react-native';
import tw from 'twrnc';

import { useAuth } from '../../context/AuthContext';
import { getResponderDispatches } from '../../services/responderDispatchService';

const GREEN = '#1F7A4D';

const AGENCY_LABELS = {
  police: 'Philippine National Police (PNP)',
  fire: 'Bureau of Fire Protection (BFP)',
  bdrrmo: 'Barangay 167 BDRRMO Command',
  tanod: 'Barangay 167 Public Safety (Tanod)',
};

const ROLE_BADGES = {
  police: 'POLICE RESPONDER',
  fire: 'BFP FIRE RESPONDER',
  bdrrmo: 'BDRRMO COORDINATOR',
  tanod: 'BARANGAY TANOD',
};

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'R';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function ResponderProfile() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();
  const role = String(user?.role || 'responder').toLowerCase();

  const [dispatches, setDispatches] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [vibrationAlerts, setVibrationAlerts] = useState(true);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then((perm) => {
        if (active) setGpsGranted(perm.status === 'granted');
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getResponderDispatches(undefined, user?.role)
        .then((list) => {
          if (active) {
            setDispatches(Array.isArray(list) ? list : []);
          }
        })
        .catch(() => { })
        .finally(() => {
          if (active) setLoadingStats(false);
        });
      return () => {
        active = false;
      };
    }, [user]),
  );

  const stats = useMemo(() => {
    const responded = dispatches.filter((d) => d && d.status !== 'DISPATCHED');
    const completed = responded.filter((d) => d.status === 'COMPLETED').length;
    const active = responded.filter(
      (d) => !['COMPLETED', 'DECLINED'].includes(String(d.status || '').toUpperCase()),
    ).length;
    return {
      total: responded.length,
      completed,
      active,
    };
  }, [dispatches]);

  const handleRequestGps = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      setGpsGranted(perm.status === 'granted');
      if (perm.status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Enable location access in your device settings for live incident navigation.',
        );
      }
    } catch {
      // Ignore permission prompt errors
    }
  };

  const openChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handleSavePassword = () => {
    if (!currentPassword.trim()) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setShowPasswordModal(false);
    Alert.alert('Password Updated', 'Your account password has been changed.');
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of your responder account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            await signOut();
          } catch {
            setLoggingOut(false);
            Alert.alert('Error', 'Unable to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={tw`flex-1 bg-slate-50`}
      contentContainerStyle={tw`px-4 pb-8 pt-3`}
    >
      <Text style={tw`mb-3 text-2xl font-extrabold text-slate-900`}>Profile</Text>

      {/* 1. Responder Identity Card */}
      <View style={tw`rounded-2xl border border-slate-200 bg-white p-4`}>
        <View style={tw`flex-row items-center`}>
          <View style={tw`h-16 w-16 items-center justify-center rounded-full border border-green-200 bg-green-50`}>
            <Text style={tw`text-xl font-bold text-[#1F7A4D]`}>
              {getInitials(user?.full_name)}
            </Text>
          </View>

          <View style={tw`ml-3.5 flex-1`}>
            <Text numberOfLines={1} style={tw`text-lg font-bold text-slate-900`}>
              {user?.full_name || 'Responder'}
            </Text>
            <Text numberOfLines={1} style={tw`mt-0.5 text-xs font-medium text-slate-500`}>
              {AGENCY_LABELS[role] || 'Barangay 167 Emergency Response'}
            </Text>

            <View style={tw`mt-2 flex-row flex-wrap items-center gap-1.5`}>
              <View style={tw`flex-row items-center gap-1 rounded-full bg-green-50 px-2.5 py-1`}>
                <ShieldCheck size={12} color={GREEN} />
                <Text style={tw`pr-0.5 text-[10px] font-bold text-[#1F7A4D]`}>
                  {ROLE_BADGES[role] || String(role).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Response Summary Metrics */}
      <View style={tw`mt-3.5 flex-row items-center rounded-2xl border border-slate-200 bg-white py-3.5`}>
        <View style={tw`flex-1 items-center`}>
          <Text style={tw`text-xl font-bold text-slate-900`}>
            {loadingStats ? '-' : stats.total}
          </Text>
          <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>
            Total Responded
          </Text>
        </View>
        <View style={tw`h-8 w-px bg-slate-200`} />
        <View style={tw`flex-1 items-center`}>
          <Text style={tw`text-xl font-bold text-[#1F7A4D]`}>
            {loadingStats ? '-' : stats.completed}
          </Text>
          <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>
            Completed
          </Text>
        </View>
        <View style={tw`h-8 w-px bg-slate-200`} />
        <View style={tw`flex-1 items-center`}>
          <Text style={tw`text-xl font-bold text-blue-600`}>
            {loadingStats ? '-' : stats.active}
          </Text>
          <Text style={tw`mt-0.5 text-[11px] font-medium text-slate-500`}>
            Ongoing
          </Text>
        </View>
      </View>

      {/* 3. Account & Unit Information */}
      <View style={tw`mt-3.5 gap-3 rounded-2xl border border-slate-200 bg-white p-4`}>
        <Text style={tw`text-xs font-bold uppercase text-slate-400`}>
          Unit & Contact Details
        </Text>

        <View style={tw`flex-row items-center gap-3`}>
          <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
            <Phone size={16} color={GREEN} />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-[11px] font-medium text-slate-400`}>Mobile Number</Text>
            <Text style={tw`text-xs font-bold text-slate-800`}>
              {user?.mobile_number || user?.phone || 'Registered Responder Line'}
            </Text>
          </View>
        </View>

        {user?.email ? (
          <View style={tw`flex-row items-center gap-3 border-t border-slate-100 pt-2.5`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <Mail size={16} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-[11px] font-medium text-slate-400`}>Email Address</Text>
              <Text style={tw`text-xs font-bold text-slate-800`}>{user.email}</Text>
            </View>
          </View>
        ) : null}

        <View style={tw`flex-row items-center gap-3 border-t border-slate-100 pt-2.5`}>
          <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
            <Building2 size={16} color={GREEN} />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-[11px] font-medium text-slate-400`}>Assigned Unit</Text>
            <Text style={tw`text-xs font-bold text-slate-800`}>
              {AGENCY_LABELS[role] || 'Barangay 167 Emergency Unit'}
            </Text>
          </View>
        </View>

        <View style={tw`flex-row items-center gap-3 border-t border-slate-100 pt-2.5`}>
          <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
            <MapPin size={16} color={GREEN} />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-[11px] font-medium text-slate-400`}>Area of Jurisdiction</Text>
            <Text style={tw`text-xs font-bold text-slate-800`}>
              Barangay 167, Caloocan City
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Dispatch & Device Settings */}
      <View style={tw`mt-3.5 gap-2.5 rounded-2xl border border-slate-200 bg-white p-4`}>
        <Text style={tw`text-xs font-bold uppercase text-slate-400`}>
          Dispatch Alerts & GPS
        </Text>

        <View style={tw`flex-row items-center justify-between py-1`}>
          <View style={tw`mr-3 flex-1 flex-row items-center gap-3`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <BellRing size={16} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-bold text-slate-800`}>Emergency Siren Sound</Text>
              <Text style={tw`text-[11px] text-slate-500`}>
                Play audio alarm when a new emergency arrives
              </Text>
            </View>
          </View>
          <Switch
            value={soundAlerts}
            onValueChange={setSoundAlerts}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={soundAlerts ? GREEN : '#F8FAFC'}
          />
        </View>

        <View style={tw`flex-row items-center justify-between border-t border-slate-100 pt-2.5`}>
          <View style={tw`mr-3 flex-1 flex-row items-center gap-3`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <Vibrate size={16} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-bold text-slate-800`}>Vibration Alerts</Text>
              <Text style={tw`text-[11px] text-slate-500`}>
                Vibrate continuously on incoming emergency
              </Text>
            </View>
          </View>
          <Switch
            value={vibrationAlerts}
            onValueChange={setVibrationAlerts}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={vibrationAlerts ? GREEN : '#F8FAFC'}
          />
        </View>

        <Pressable
          onPress={() => void handleRequestGps()}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between border-t border-slate-100 pt-2.5`,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={tw`mr-3 flex-1 flex-row items-center gap-3`}>
            <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
              <MapPin size={16} color={GREEN} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-bold text-slate-800`}>GPS Location Sharing</Text>
              <Text style={tw`text-[11px] text-slate-500`}>
                {gpsGranted
                  ? 'Active for turn-by-turn incident navigation'
                  : 'Tap to grant location access'}
              </Text>
            </View>
          </View>
          <View
            style={tw`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${gpsGranted ? 'bg-green-50' : 'bg-amber-50'
              }`}
          >
            {gpsGranted ? <CheckCircle2 size={12} color={GREEN} /> : null}
            <Text
              style={tw`pr-0.5 text-[10px] font-bold ${gpsGranted ? 'text-[#1F7A4D]' : 'text-amber-700'
                }`}
            >
              {gpsGranted ? 'ENABLED' : 'ENABLE'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* 5. Quick Shortcuts & Security */}
      <View style={tw`mt-3.5 gap-2 rounded-2xl border border-slate-200 bg-white p-4`}>
        <Text style={tw`mb-0.5 text-xs font-bold uppercase text-slate-400`}>
          Account & Quick Actions
        </Text>

        <Pressable
          onPress={openChangePassword}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3`,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={tw`flex-row items-center gap-2.5`}>
            <KeyRound size={16} color={GREEN} />
            <Text style={tw`text-xs font-bold text-slate-800`}>
              Change Password
            </Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('History')}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3`,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={tw`flex-row items-center gap-2.5`}>
            <Clock3 size={16} color={GREEN} />
            <Text style={tw`text-xs font-bold text-slate-800`}>
              View My Response History
            </Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Messages')}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3`,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={tw`flex-row items-center gap-2.5`}>
            <MessageCircle size={16} color={GREEN} />
            <Text style={tw`text-xs font-bold text-slate-800`}>
              Open Incident Messages
            </Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>
      </View>

      {/* 6. Sign Out Button */}
      <Pressable
        onPress={confirmSignOut}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [
          tw`mt-4 flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5`,
          { opacity: pressed || loggingOut ? 0.7 : 1 },
        ]}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : (
          <LogOut size={16} color="#DC2626" />
        )}
        <Text style={tw`px-1 text-xs font-bold text-red-600`}>
          Sign Out of Account
        </Text>
      </Pressable>

      {/* Change Password Modal (Frontend Only) */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={tw`flex-1 justify-end bg-black/45`}>
          <View style={tw`rounded-t-3xl bg-white px-5 pb-7 pt-5`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center gap-2`}>
                <View style={tw`h-9 w-9 items-center justify-center rounded-xl bg-green-50`}>
                  <KeyRound size={17} color={GREEN} />
                </View>
                <Text style={tw`text-lg font-bold text-slate-900`}>
                  Change Password
                </Text>
              </View>
              <Pressable
                onPress={() => setShowPasswordModal(false)}
                hitSlop={8}
                style={tw`h-8 w-8 items-center justify-center rounded-full bg-slate-100`}
              >
                <X size={16} color="#334155" />
              </Pressable>
            </View>

            <Text style={tw`mt-1.5 text-xs text-slate-500`}>
              Enter your current password and choose a new password (at least 8 characters).
            </Text>

            <View style={tw`mt-4 gap-3`}>
              <View>
                <Text style={tw`mb-1 text-xs font-bold text-slate-700`}>
                  Current Password
                </Text>
                <View style={tw`flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5`}>
                  <TextInput
                    value={currentPassword}
                    onChangeText={(val) => {
                      setCurrentPassword(val);
                      if (passwordError) setPasswordError('');
                    }}
                    placeholder="Enter current password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showCurrentPw}
                    autoCapitalize="none"
                    style={tw`h-11 flex-1 text-sm text-slate-900`}
                  />
                  <Pressable
                    onPress={() => setShowCurrentPw((prev) => !prev)}
                    hitSlop={8}
                  >
                    {showCurrentPw ? (
                      <EyeOff size={17} color="#64748B" />
                    ) : (
                      <Eye size={17} color="#64748B" />
                    )}
                  </Pressable>
                </View>
              </View>

              <View>
                <Text style={tw`mb-1 text-xs font-bold text-slate-700`}>
                  New Password
                </Text>
                <View style={tw`flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5`}>
                  <TextInput
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (passwordError) setPasswordError('');
                    }}
                    placeholder="At least 8 characters"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showNewPw}
                    autoCapitalize="none"
                    style={tw`h-11 flex-1 text-sm text-slate-900`}
                  />
                  <Pressable
                    onPress={() => setShowNewPw((prev) => !prev)}
                    hitSlop={8}
                  >
                    {showNewPw ? (
                      <EyeOff size={17} color="#64748B" />
                    ) : (
                      <Eye size={17} color="#64748B" />
                    )}
                  </Pressable>
                </View>
              </View>

              <View>
                <Text style={tw`mb-1 text-xs font-bold text-slate-700`}>
                  Confirm New Password
                </Text>
                <View style={tw`flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5`}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (passwordError) setPasswordError('');
                    }}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showNewPw}
                    autoCapitalize="none"
                    style={tw`h-11 flex-1 text-sm text-slate-900`}
                  />
                </View>
              </View>

              {passwordError ? (
                <View style={tw`rounded-xl bg-red-50 px-3 py-2`}>
                  <Text style={tw`text-xs font-semibold text-red-700`}>
                    {passwordError}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={tw`mt-5 flex-row gap-2.5`}>
              <Pressable
                onPress={() => setShowPasswordModal(false)}
                style={tw`flex-1 items-center rounded-xl bg-slate-100 py-3.5`}
              >
                <Text style={tw`text-xs font-bold text-slate-700`}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSavePassword}
                style={({ pressed }) => [
                  tw`flex-1 items-center rounded-xl bg-[#1F7A4D] py-3.5`,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={tw`px-1 text-xs font-bold text-white`}>
                  Update Password
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
