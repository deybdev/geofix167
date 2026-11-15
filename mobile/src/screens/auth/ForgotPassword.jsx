import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Animated } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { Check } from 'lucide-react-native';
import tw from 'twrnc';

import AuthLayout from '../../layouts/AuthLayout';
import { PhoneNumberField } from '../../components/forms/FormField';
import PressableScale from '../../components/shared/PressableScale';
import AnimatedErrorBanner from '../../components/shared/ErrorBanner';
import { useEntranceAnimation } from '../../hooks/useAnimation';

export default function ForgotPassword() {
  const navigation = useNavigation();

  const [form, setForm] = useState({ phoneNumber: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const entranceStyle = useEntranceAnimation();

  const updateField = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setServerError('');
  };

  const handleSubmit = async () => {
    if (loading) return;

    setServerError('');
    setErrors({});

    if (!/^09\d{9}$/.test(form.phoneNumber)) {
      setErrors({ phoneNumber: 'Please enter a valid 11-digit mobile number.' });
      return;
    }

    setLoading(true);

    try {
      // Temporary placeholder until backend integration
      setServerError('Forgot password API is not connected yet.');
    } catch (error) {
      setServerError(
        error.response?.data?.error ?? 'Unable to send the reset code. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`pb-4`}
      >
        <Animated.View style={entranceStyle}>

          <View style={tw`mt-7 items-center gap-1.5`}>
            <Text style={tw`text-[22px] font-bold leading-7 text-[#2E8B57]`}>
              Forgot Password
            </Text>

            <Text style={tw`max-w-[320px] text-center text-[13px] leading-5 text-slate-500`}>
              Enter the mobile number you used to register your GeoFix 167 account.
            </Text>
          </View>

          <View style={tw`mt-9 gap-3`}>
            <AnimatedErrorBanner
              message={serverError}
              onDismiss={() => setServerError('')}
            />

            <PhoneNumberField
              value={form.phoneNumber}
              onChange={updateField('phoneNumber')}
              error={errors.phoneNumber}
              inputProps={{
                autoComplete: 'tel',
                returnKeyType: 'done',
                onSubmitEditing: handleSubmit,
              }}
            />

            <Text style={tw`text-sm text-slate-500`}>
              Enter your mobile number to receive an SMS.
            </Text>

            <View style={tw`mt-2 flex-row items-start gap-2 rounded-lg bg-[#2E8B57]/10 px-3 py-2.5`}>
              <Check size={18} strokeWidth={3} color="#2E8B57" />
              <Text style={tw`flex-1 text-[13px] leading-5 text-[#2E8B57]`}>
                If this number is registered, we'll send a six-digit reset code via SMS. Never share your code with anyone.
              </Text>
            </View>
          </View>

          <PressableScale
            onPress={handleSubmit}
            disabled={!form.phoneNumber || loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: !form.phoneNumber || loading, busy: loading }}
            style={tw.style(
              'mt-5 h-12 flex-row items-center justify-center rounded-xl bg-[#2E8B57]',
              (!form.phoneNumber || loading) && 'opacity-80',
            )}
          >
            {loading && <ActivityIndicator size="small" color="#FFFFFF" style={tw`mr-2`} />}
            <Text style={tw`text-sm font-semibold text-white`}>
              {loading ? 'Sending...' : 'Send Code'}
            </Text>
          </PressableScale>

          <View style={tw`mt-6 flex-row justify-center`}>
            <Text style={tw`text-[13px] text-gray-500`}>Remember your password? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              {({ pressed }) => (
                <Text style={tw.style('text-[13px] font-semibold text-[#2E8B57]', pressed && 'opacity-60')}>
                  Login
                </Text>
              )}
            </Pressable>
          </View>

        </Animated.View>
      </ScrollView>
    </AuthLayout>
  );
}
