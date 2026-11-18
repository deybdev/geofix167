import { useEffect, useMemo, useState, useRef } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { Check, ChevronDown, FileText, Upload, X } from 'lucide-react-native';
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
import { getRegistrationStatus, registerResident, registerWithGoogle, startRegistrationEmail, uploadRegistrationDocument, verifyRegistrationEmail } from '../../services/authService';
import BarangayIdScanner from '../../components/auth/BarangayIdScanner';
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

const GENERIC_REGISTRATION_ERROR = 'We couldn’t complete the registration with the information provided. Please review your details or contact the Barangay Front Desk.';

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
  const discardAllowedRef = useRef(false);

  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [barangayIdFocused, setBarangayIdFocused] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [registrationToken, setRegistrationToken] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [scanMessage, setScanMessage] = useState('');
  const [registrationRequest, setRegistrationRequest] = useState(null);
  const [document, setDocument] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    barangayIdentifier: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });

  const entranceStyle = useEntranceAnimation();
  const { triggerShake } = useShakeAnimation();
  const hasEnteredData = useMemo(() => Object.entries(form).some(([key, value]) => key === 'acceptedTerms' ? value : String(value).trim()), [form]);
  const progressStep = submitted ? 4 : identity ? 3 : emailToken ? 2 : 1;

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (discardAllowedRef.current) {
      discardAllowedRef.current = false;
      return;
    }
    if (submitted || !hasEnteredData) return;
    event.preventDefault();
    if (emailToken) {
      setEmailToken('');
      setOtpCode('');
      return;
    }
    Alert.alert('Discard registration?', 'Your entered registration details will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { discardAllowedRef.current = true; navigation.dispatch(event.data.action); } },
    ]);
  }), [emailToken, hasEnteredData, navigation, submitted]);

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

    const result = registerSchema.safeParse({ ...form, google: Boolean(identity?.google) });

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

      if (!identity) {
        const { data } = await startRegistrationEmail(result.data.email);
        setEmailToken(data.email_token);
        setCooldown(Number(data.retry_after || 60));
        Alert.alert('Verification code sent', data.message || 'Check your email for the six-digit code.');
        return;
      }

      const { data } = await registerResident({
        barangay_identifier: result.data.barangayIdentifier,
        first_name: result.data.firstName,
        middle_name: result.data.middleName,
        last_name: result.data.lastName,
        date_of_birth: result.data.dateOfBirth,
        mobile_number: result.data.phoneNumber,
        email: result.data.email,
        ...(identity?.google ? {} : { password: result.data.password }),
        accepted_terms: result.data.acceptedTerms,
        terms_version: '2026-11-13',
        privacy_version: '2026-11-13',
      }, registrationToken);

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
      try {
        const status = await getRegistrationStatus(registrationToken);
        setRegistrationRequest(status.data.request || { status: 'PENDING' });
        if (document && status.data.request?.status === 'NEEDS_CORRECTION') {
          await uploadRegistrationDocument(document, registrationToken);
          const refreshed = await getRegistrationStatus(registrationToken);
          setRegistrationRequest(refreshed.data.request || { status: 'PENDING' });
          setDocument(null);
        }
      } catch {
        setRegistrationRequest({ status: 'PENDING' });
      }
      setError(
        data.message ??
          'Your registration is pending Front Desk review.',
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (requestError) {
      showError(requestMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const validateField = (field) => {
    const result = registerSchema.safeParse({ ...form, google: Boolean(identity?.google) });
    const message = result.success ? undefined : result.error.flatten().fieldErrors[field]?.[0];
    setErrors(current => ({ ...current, [field]: message }));
  };

  const requestMessage = (requestError) => requestError.request && !requestError.response
    ? 'Could not connect to the server. Your information is still here—check your connection and try again.'
    : GENERIC_REGISTRATION_ERROR;

  const handleVerifyEmail = async () => {
    if (otpCode.length !== 6 || loading) return;
    try {
      setLoading(true);
      const { data } = await verifyRegistrationEmail(emailToken, otpCode);
      setIdentity(data.identity);
      setRegistrationToken(data.registration_token);
      setEmailToken('');
      setOtpCode('');
      Alert.alert('Email verified', 'Complete the remaining details, then submit your registration.');
    } catch (verifyError) {
      showError(verifyError.request && !verifyError.response
        ? 'Could not connect to the server. Check your connection and try again.'
        : 'The code is incorrect or expired. Request a new code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegistration = async () => {
    setError('');
    try {
      setLoading(true);
      const result = await registerWithGoogle();
      if (result.canceled) return;
      if (!result.registration?.registration_token || !result.registration?.identity) {
        showError(GENERIC_REGISTRATION_ERROR);
        return;
      }
      const googleIdentity = result.registration.identity;
      setIdentity(googleIdentity);
      setRegistrationToken(result.registration.registration_token);
      setForm(current => ({
        ...current,
        email: googleIdentity.email || '',
        firstName: googleIdentity.first_name || current.firstName,
        lastName: googleIdentity.last_name || current.lastName,
      }));
    } catch (googleError) {
      showError(googleError.request && !googleError.response
        ? 'Could not connect to the server. Check your connection and try again.'
        : GENERIC_REGISTRATION_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset || !['image/jpeg', 'image/png', 'application/pdf'].includes(asset.mimeType) || !asset.size || asset.size > 5 * 1024 * 1024) {
      showError('Select a JPEG, PNG, or PDF up to 5 MB.');
      setDocument(null);
      return;
    }
    setDocument(asset);
    setError('');
  };

  const uploadDocument = async () => {
    if (!document || uploading) return;
    try {
      setUploading(true);
      await uploadRegistrationDocument(document, registrationToken);
      const status = await getRegistrationStatus(registrationToken);
      setRegistrationRequest(status.data.request || { status: 'PENDING' });
      setDocument(null);
      Alert.alert('Document submitted', 'Your verification document is now awaiting review.');
    } catch (uploadError) {
      showError(uploadError.request && !uploadError.response
        ? 'Could not connect to the server. Your selected document is still here—try again.'
        : 'We couldn’t upload the document. Select a clear JPEG, PNG, or PDF up to 5 MB and try again.');
    } finally {
      setUploading(false);
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
                {identity?.google ? 'Complete your profile' : 'Create Account'}
              </Text>

              <Text style={tw`mt-1 text-sm text-slate-500`}>
                {identity?.google ? 'We only need a few more details to finish setting up your account.' : 'Use Google for a faster setup, or enter your information.'}
              </Text>
              <View style={tw`mt-4 flex-row gap-1.5`} accessibilityLabel={`Registration step ${progressStep} of 4`}>
                {[1, 2, 3, 4].map(item => (
                  <View key={item} style={[tw`h-1.5 flex-1 rounded-full`, { backgroundColor: item <= progressStep ? COLORS.primary : '#E2E8F0' }]} />
                ))}
              </View>
            </View>

            {!submitted && (
              <AnimatedErrorBanner
                message={error}
                style={tw`mt-4`}
                onDismiss={() => setError('')}
              />
            )}

            {submitted && registrationRequest ? (
              <View style={tw`mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4`}>
                {registrationRequest.status === 'APPROVED' ? <>
                  <Text style={tw`font-bold text-green-700`}>Your account is ready</Text>
                  <Text style={tw`mt-1 text-sm leading-5 text-slate-600`}>Your registration was approved. You can now log in.</Text>
                  <PressableScale onPress={() => navigation.navigate('Login')} style={tw`mt-3 h-11 items-center justify-center rounded-lg bg-green-700`}>
                    <Text style={tw`text-sm font-semibold text-white`}>Go to Login</Text>
                  </PressableScale>
                </> : null}

                {registrationRequest.status === 'PENDING' ? <>
                  <Text style={tw`font-bold text-slate-800`}>Verification in progress</Text>
                  <Text style={tw`mt-1 text-sm leading-5 text-slate-600`}>The Barangay Front Desk is reviewing your registration. We’ll send an update to your verified email.</Text>
                </> : null}

                {registrationRequest.status === 'NEEDS_CORRECTION' ? <>
                  <Text style={tw`font-bold text-amber-700`}>Additional verification needed</Text>
                  <Text style={tw`mt-1 text-sm leading-5 text-slate-600`}>Provide a clear Barangay ID or approved identification document.</Text>
                  <Pressable onPress={pickDocument} accessibilityRole="button" style={tw`mt-4 min-h-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-4`}>
                    {document ? <FileText size={24} color={COLORS.primary} /> : <Upload size={24} color={COLORS.primary} />}
                    <Text style={tw`mt-2 text-sm font-semibold text-slate-700`}>{document ? document.name : 'Select verification document'}</Text>
                    <Text style={tw`mt-1 text-center text-xs text-slate-500`}>JPEG, PNG, or PDF up to 5 MB</Text>
                  </Pressable>
                  {document ? <View style={tw`mt-2 flex-row items-center justify-between`}>
                    <Text numberOfLines={1} style={tw`mr-2 flex-1 text-xs text-slate-500`}>{document.name}</Text>
                    <Pressable onPress={() => setDocument(null)} accessibilityLabel="Remove selected document" hitSlop={10}><X size={18} color="#64748B" /></Pressable>
                  </View> : null}
                  <PressableScale onPress={uploadDocument} disabled={!document || uploading} style={[tw`mt-3 h-11 flex-row items-center justify-center rounded-lg`, { backgroundColor: !document || uploading ? '#94A3B8' : COLORS.primary }]}>
                    {uploading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Upload size={17} color="#FFFFFF" />}
                    <Text style={tw`ml-2 text-sm font-semibold text-white`}>{uploading ? 'Uploading securely…' : 'Submit securely'}</Text>
                  </PressableScale>
                  <Text style={tw`mt-2 text-xs leading-4 text-slate-500`}>Your document is available only to authorized reviewers and is used for identity verification.</Text>
                </> : null}
              </View>
            ) : null}

            <View style={tw`mt-5 gap-4`}>
              {!identity ? (
                <PressableScale onPress={handleGoogleRegistration} disabled={loading} style={tw`h-12 items-center justify-center rounded-xl bg-[#2E8B57]`}>
                  <Text style={tw`text-sm font-semibold text-white`}>Continue with Google</Text>
                </PressableScale>
              ) : null}
              {identity?.google ? (
                <View style={tw`flex-row items-center rounded-xl border border-green-100 bg-green-50 px-4 py-3`}>
                  <Check size={16} color={COLORS.primary} />
                  <Text style={tw`ml-2 flex-1 text-sm font-semibold text-green-700`}>Signed in with Google · complete the remaining fields</Text>
                </View>
              ) : null}
              {/* Last Name and First Name */}
              <View style={tw`flex-row gap-3`}>
                <View style={tw`flex-1`}>
                  <NameField
                    label="Last Name"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={updateField('lastName')}
                    error={errors.lastName}
                    inputProps={{ onBlur: () => validateField('lastName') }}
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
                    inputProps={{ onBlur: () => validateField('firstName') }}
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
                inputProps={{ onBlur: () => validateField('middleName') }}
              />

              {/* Barangay ID */}
              <FormField
                label="Barangay ID Number"
                required
                error={errors.barangayIdentifier}
              >
                <View style={tw`flex-row`}>
                <View
                  style={[
                    tw`flex-1 rounded-lg border bg-white`,
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
                    onBlur={() => { setBarangayIdFocused(false); validateField('barangayIdentifier'); }}
                    placeholder="Enter the number below your ID barcode"
                    placeholderTextColor={COLORS.muted}
                    autoCapitalize="none"
                    style={tw`flex-1 px-3 text-sm text-slate-800`}
                  />
                </View>
                <BarangayIdScanner
                  onScan={(value) => { updateField('barangayIdentifier')(value); setScanMessage('Barangay ID scanned successfully.'); }}
                  onError={setScanMessage}
                />
                </View>
                {scanMessage ? <Text accessibilityRole="alert" style={tw`text-xs text-slate-500`}>{scanMessage}</Text> : null}
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
                inputProps={{ onBlur: () => validateField('phoneNumber') }}
                required
              />

              <FormField label="Email Address" required error={errors.email}>
                <TextInput
                  value={form.email}
                  onChangeText={updateField('email')}
                  editable={!identity?.google}
                  accessibilityLabel="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={() => validateField('email')}
                  placeholder="name@example.com"
                  style={[tw`rounded-lg border border-slate-300 px-3 text-sm text-slate-800`, { height: 44, backgroundColor: identity?.google ? '#F1F5F9' : '#FFFFFF' }]}
                />
              </FormField>

              {emailToken && !identity ? (
                <View style={tw`rounded-xl border border-slate-200 bg-slate-50 p-4`}>
                  <Text style={tw`mb-2 text-sm font-semibold text-slate-700`}>Enter the six-digit email code</Text>
                  <TextInput value={otpCode} onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="000000" style={[tw`rounded-lg border border-slate-300 bg-white px-3 text-center text-lg tracking-widest`, { height: 44 }]} />
                  <PressableScale onPress={handleVerifyEmail} disabled={loading || otpCode.length !== 6} style={tw`mt-3 h-11 items-center justify-center rounded-lg bg-green-700`}>
                    <Text style={tw`text-sm font-semibold text-white`}>Verify Email</Text>
                  </PressableScale>
                  <Text style={tw`mt-2 text-center text-xs text-slate-500`}>{cooldown > 0 ? `You can resend the code in ${cooldown}s.` : 'Didn’t receive it? Use the button below to send another code.'}</Text>
                </View>
              ) : null}

              {/* Password */}
              {!identity?.google ? <><PasswordField
                label="Password"
                placeholder="Create a password"
                value={form.password}
                onChange={updateField('password')}
                error={errors.password}
                inputProps={{ onBlur: () => validateField('password') }}
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
                  inputProps={{ onBlur: () => validateField('confirmPassword') }}
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
              </View></> : null}
            </View>

            {/* Password reminder */}
            {!identity?.google ? <Text style={tw`mt-3 text-xs leading-4 text-slate-500`}>
              Choose a password you do not use elsewhere. Use uppercase, lowercase, number, and special character.
            </Text> : null}

            {/* Terms and Privacy */}
            <View style={tw`mt-3`}>
              <Pressable
                onPress={() => updateField('acceptedTerms')(!form.acceptedTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.acceptedTerms }}
                style={tw`flex-row items-start gap-2`}
              >
                <View
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
                </View>

                <View style={tw`flex-1 flex-row flex-wrap`}>
                  <Text style={tw`text-xs leading-5 text-slate-500`}>
                    I agree to the{' '}
                  </Text>

                  <Pressable onPress={(event) => { event.stopPropagation(); openTerms(); }}>
                    <Text style={tw`text-xs leading-5 font-semibold text-green-700 underline`}>
                      Terms of Service
                    </Text>
                  </Pressable>

                  <Text style={tw`text-xs leading-5 text-slate-500`}>
                    {' '}and{' '}
                  </Text>

                  <Pressable onPress={(event) => { event.stopPropagation(); openPrivacy(); }}>
                    <Text style={tw`text-xs leading-5 font-semibold text-green-700 underline`}>
                      Privacy Policy
                    </Text>
                  </Pressable>

                  <Text style={tw`text-xs leading-5 text-slate-500`}>
                    .
                  </Text>
                </View>
              </Pressable>

              <FieldError message={errors.acceptedTerms} />
            </View>

            {/* Submit */}
            <PressableScale
              onPress={handleSubmit}
              disabled={loading || (!identity && Boolean(emailToken) && cooldown > 0)}
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
                  {identity ? 'Submit registration' : emailToken ? (cooldown > 0 ? `Resend in ${cooldown}s` : 'Send code again') : 'Continue and verify email'}
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
