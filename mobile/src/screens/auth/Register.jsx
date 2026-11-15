import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, ChevronDown } from 'lucide-react-native';
import tw from 'twrnc';
import { useNavigation } from '@react-navigation/native';

import {
  FormField,
  NameField,
  PasswordField,
  PhoneNumberField,
  FieldError,
} from '../../components/forms/FormField';

import { registerSchema } from '../../schema/register.schema';
import { registerResident } from '../../services/authService';
import AuthLayout from '../../layouts/AuthLayout';
import PressableScale from '../../components/shared/PressableScale';
import AnimatedErrorBanner from '../../components/shared/ErrorBanner';
import { useEntranceAnimation, useShakeAnimation, Animated } from '../../hooks/useAnimation';

const COLORS = {
  primary: '#2E8B57',
  danger: '#DC2626',
  text: '#334155',
  muted: '#94A3B8',
  border: '#CBD5E1',
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value) {
  if (!value) return 'Select your date of birth';

  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
}

export default function Register() {
  const navigation = useNavigation();
  const scrollRef = useRef(null);

  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [barangayIdFocused, setBarangayIdFocused] = useState(false);

  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    barangayIdentifier: '',
    dateOfBirth: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });

  const entranceStyle = useEntranceAnimation();
  const { triggerShake } = useShakeAnimation();

  const showError = (message) => {
    setError(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const updateField = (field) => (value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'password'
        ? { confirmPassword: undefined }
        : {}),
    }));

    setError('');
    setSubmitted(false);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    updateField('dateOfBirth')(formatDate(selectedDate));
  };

  const handleSubmit = async () => {
    if (loading) return;

    setError('');
    setSubmitted(false);
    setErrors({});

    const result = registerSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;

      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([field, messages]) => [
            field,
            messages?.[0],
          ]),
        ),
      );

      triggerShake();
      return;
    }

    try {
      setLoading(true);

      const { data } = await registerResident({
        barangay_identifier: result.data.barangayIdentifier,
        first_name: result.data.firstName,
        middle_name: result.data.middleName,
        last_name: result.data.lastName,
        date_of_birth: result.data.dateOfBirth,
        mobile_number: result.data.phoneNumber,
        password: result.data.password,
      });

      if (data.status === 'OTP_SENT') {
        Alert.alert(
          'Registration submitted',
          'A verification code was sent to your mobile number.',
          [
            {
              text: 'Continue',
              onPress: () => {
                navigation.navigate('Verify', {
                  mobileNumber: result.data.phoneNumber,
                  purpose: 'registration',
                });
              },
            },
          ],
        );

        return;
      }

      setSubmitted(true);
      setError(
        data.message ??
          'Your registration is pending Front Desk review.',
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (requestError) {
      showError(
        requestError.response?.data?.error ??
          'We could not submit your registration. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const openTerms = () => navigation.navigate('TermsOfService');
  const openPrivacy = () => navigation.navigate('PrivacyPolicy');

  const openHelp = () => {
    Linking.openURL(
      'mailto:frontdesk@barangay167.example?subject=GeoFix%20resident%20registration%20help',
    ).catch(() => {
      Alert.alert('Unable to open email', 'Please try again later.');
    });
  };

  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  return (
    <AuthLayout>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={tw`pb-10`}
        >
          <Animated.View style={entranceStyle}>
            <View style={tw`mt-1`}>
              <Text style={tw`text-xl font-bold leading-7 text-slate-800`}>
                Create Account
              </Text>

              <Text style={tw`mt-1 text-sm text-slate-500`}>
                Enter your information to register as a resident.
              </Text>
            </View>

            {!submitted && (
              <AnimatedErrorBanner
                message={error}
                style={tw`mt-4`}
                onDismiss={() => setError('')}
              />
            )}

            {submitted ? (
              <View style={tw`mt-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3`}>
                <Text style={tw`text-sm leading-5 text-green-700`}>
                  Your registration is pending Front Desk review. Use Need
                  Help if you need an update.
                </Text>
              </View>
            ) : null}

            <View style={tw`mt-5 gap-4`}>
              {/* Last Name and First Name */}
              <View style={tw`flex-row gap-3`}>
                <View style={tw`flex-1`}>
                  <NameField
                    label="Last Name"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={updateField('lastName')}
                    error={errors.lastName}
                    required
                  />
                </View>

                <View style={tw`flex-1`}>
                  <NameField
                    label="First Name"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={updateField('firstName')}
                    error={errors.firstName}
                    required
                  />
                </View>
              </View>

              {/* Middle Name */}
              <NameField
                label="Middle Name"
                placeholder="Middle name"
                value={form.middleName}
                onChange={updateField('middleName')}
                error={errors.middleName}
              />

              {/* Barangay ID */}
              <FormField
                label="Barangay ID Number"
                required
                error={errors.barangayIdentifier}
              >
                <View
                  style={[
                    tw`rounded-lg border bg-white`,
                    {
                      minHeight: 44,
                      borderWidth: barangayIdFocused ? 1.5 : 1,
                      borderColor: errors.barangayIdentifier
                        ? COLORS.danger
                        : barangayIdFocused
                          ? COLORS.primary
                          : COLORS.border,
                    },
                  ]}
                >
                  <TextInput
                    value={form.barangayIdentifier}
                    onChangeText={updateField('barangayIdentifier')}
                    onFocus={() => setBarangayIdFocused(true)}
                    onBlur={() => setBarangayIdFocused(false)}
                    placeholder="Enter the number below your ID barcode"
                    placeholderTextColor={COLORS.muted}
                    autoCapitalize="none"
                    style={tw`flex-1 px-3 text-sm text-slate-800`}
                  />
                </View>
              </FormField>

              {/* Date of Birth */}
              <FormField
                label="Date of Birth"
                required
                error={errors.dateOfBirth}
              >
                <Pressable
                  onPress={() => setShowDatePicker((open) => !open)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    tw`flex-row items-center justify-between rounded-lg border px-3`,
                    {
                      height: 44,
                      backgroundColor: pressed ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: showDatePicker ? 1.5 : 1,
                      borderColor: errors.dateOfBirth
                        ? COLORS.danger
                        : showDatePicker
                          ? COLORS.primary
                          : COLORS.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      tw`text-sm`,
                      {
                        color: form.dateOfBirth
                          ? COLORS.text
                          : COLORS.muted,
                      },
                    ]}
                  >
                    {formatDateDisplay(form.dateOfBirth)}
                  </Text>

                  <ChevronDown
                    size={18}
                    color={showDatePicker ? COLORS.primary : COLORS.muted}
                    style={{
                      transform: [{ rotate: showDatePicker ? '180deg' : '0deg' }],
                    }}
                  />
                </Pressable>

                {showDatePicker && (
                  <View>
                    <DateTimePicker
                      value={
                        form.dateOfBirth
                          ? new Date(`${form.dateOfBirth}T12:00:00`)
                          : new Date()
                      }
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={handleDateChange}
                    />

                    {Platform.OS === 'ios' && (
                      <Pressable
                        onPress={() => setShowDatePicker(false)}
                        style={tw`self-end py-2`}
                      >
                        <Text style={tw`font-semibold text-green-700`}>
                          Done
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </FormField>

              {/* Mobile Number */}
              <PhoneNumberField
                value={form.phoneNumber}
                onChange={updateField('phoneNumber')}
                error={errors.phoneNumber}
                required
              />

              {/* Password */}
              <PasswordField
                label="Password"
                placeholder="Create a password"
                value={form.password}
                onChange={updateField('password')}
                error={errors.password}
                required
              />

              {/* Confirm Password */}
              <View>
                <PasswordField
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  error={errors.confirmPassword}
                  required
                />
                {passwordsMatch && !errors.confirmPassword ? (
                  <View style={tw`mt-1.5 flex-row items-center`}>
                    <Check size={14} color={COLORS.primary} strokeWidth={3} />
                    <Text style={tw`ml-1 text-xs text-green-700`}>
                      Passwords match
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Password reminder */}
            <Text style={tw`mt-3 text-xs leading-4 text-slate-500`}>
              Choose a password you do not use elsewhere.
            </Text>

            {/* Terms and Privacy */}
            <View style={tw`mt-3`}>
              <View style={tw`flex-row items-start gap-2`}>
                <Pressable
                  onPress={() =>
                    updateField('acceptedTerms')(!form.acceptedTerms)
                  }
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: form.acceptedTerms }}
                  style={[
                    tw`mt-0.5 h-5 w-5 items-center justify-center rounded border`,
                    {
                      borderColor: errors.acceptedTerms
                        ? COLORS.danger
                        : form.acceptedTerms
                          ? COLORS.primary
                          : COLORS.border,
                      backgroundColor: form.acceptedTerms
                        ? COLORS.primary
                        : '#FFFFFF',
                    },
                  ]}
                >
                  {form.acceptedTerms && (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  )}
                </Pressable>

                <View style={tw`flex-1 flex-row flex-wrap`}>
                  <Text style={tw`text-xs leading-5 text-slate-500`}>
                    I agree to the{' '}
                  </Text>

                  <Pressable onPress={openTerms}>
                    <Text style={tw`text-xs leading-5 font-semibold text-green-700 underline`}>
                      Terms of Service
                    </Text>
                  </Pressable>

                  <Text style={tw`text-xs leading-5 text-slate-500`}>
                    {' '}and{' '}
                  </Text>

                  <Pressable onPress={openPrivacy}>
                    <Text style={tw`text-xs leading-5 font-semibold text-green-700 underline`}>
                      Privacy Policy
                    </Text>
                  </Pressable>

                  <Text style={tw`text-xs leading-5 text-slate-500`}>
                    .
                  </Text>
                </View>
              </View>

              <FieldError message={errors.acceptedTerms} />
            </View>

            {/* Submit */}
            <PressableScale
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              style={[
                tw`mt-5 h-12 flex-row items-center justify-center rounded-xl`,
                {
                  backgroundColor: loading ? '#6FA98A' : COLORS.primary,
                },
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={tw`ml-2 text-sm font-semibold text-white`}>
                    Creating account...
                  </Text>
                </>
              ) : (
                <Text style={tw`text-sm font-semibold text-white`}>
                  Create Account
                </Text>
              )}
            </PressableScale>

            {/* Login link */}
            <View style={tw`mt-5 flex-row justify-center`}>
              <Text style={tw`text-xs leading-5 text-slate-500`}>
                Already have an account?{' '}
              </Text>

              <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
                {({ pressed }) => (
                  <Text
                    style={tw.style(
                      'text-xs font-semibold text-green-700',
                      pressed && 'opacity-60'
                    )}
                  >
                    Login
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Help */}
            <Pressable onPress={openHelp} hitSlop={8} style={tw`mt-3 items-center`}>
              {({ pressed }) => (
                <Text
                  style={tw.style(
                    'text-xs font-semibold text-green-700',
                    pressed && 'opacity-60'
                  )}
                >
                  Need Help?
                </Text>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
    </AuthLayout>
  );
}