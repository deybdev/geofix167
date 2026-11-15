
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
} from 'react-native';

import {
  Eye,
  EyeOff,
  LockKeyhole,
  Smartphone,
  UserRound,
} from 'lucide-react-native';

import tw from 'twrnc';

const COLORS = {
  text: '#334155',
  muted: '#94A3B8',
  border: '#CBD5E1',
  danger: '#DC2626',
};

// Required indicator
export function RequiredMark() {
  return (
    <Text style={tw`text-red-500`}>*</Text>
  );
}

// Validation error
export function FieldError({ message }) {
  if (!message) return null;

  return (
    <Text
      accessibilityRole="alert"
      style={tw`text-xs font-normal leading-4 text-red-600`}
    >
      {message}
    </Text>
  );
}

// Reusable field wrapper
export function FormField({
  label,
  required = false,
  error,
  gap = 6,
  children,
}) {
  return (
    <View style={{ gap }}>
      <Text style={tw`text-sm font-semibold leading-5 text-slate-700`}>
        {label}
        {required && <RequiredMark />}
      </Text>

      {children}

      <FieldError message={error} />
    </View>
  );
}

// Reusable input container
function InputContainer({
  icon,
  error,
  children,
}) {
  return (
    <View
      style={[
        tw`flex-row items-center rounded-lg border bg-white`,
        {
          minHeight: 44,
          borderColor: error ? COLORS.danger : COLORS.border,
        },
      ]}
    >
      {icon && (
        <View style={tw`pl-3`}>
          {icon}
        </View>
      )}

      {children}
    </View>
  );
}

// Name input
export function NameField({
  label,
  placeholder,
  value,
  onChange,
  error,
  required = false,
  inputProps = {},
}) {
  return (
    <FormField
      label={label}
      required={required}
      error={error}
    >
      <InputContainer
        error={error}
        icon={
          <UserRound
            size={16}
            color={COLORS.muted}
          />
        }
      >
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          autoCapitalize="words"
          style={[
            tw`flex-1 px-3 text-sm text-slate-800`,
            { minHeight: 44 },
          ]}
        />
      </InputContainer>
    </FormField>
  );
}

// Password input
export function PasswordField({
  label = 'Password',
  placeholder = 'Enter your password',
  value,
  onChange,
  inputProps = {},
  error,
  showLockIcon = true,
  required = false,
  gap = 6,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      gap={gap}
    >
      <InputContainer
        error={error}
        icon={
          showLockIcon ? (
            <LockKeyhole
              size={16}
              color={COLORS.muted}
            />
          ) : null
        }
      >
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            tw`flex-1 px-3 text-sm text-slate-800`,
            { minHeight: 44 },
          ]}
        />

        <Pressable
          onPress={() => setVisible(current => !current)}
          accessibilityRole="button"
          accessibilityLabel={
            visible ? 'Hide password' : 'Show password'
          }
          hitSlop={10}
          style={tw`px-3 py-2`}
        >
          {visible ? (
            <EyeOff size={17} color={COLORS.muted} />
          ) : (
            <Eye size={17} color={COLORS.muted} />
          )}
        </Pressable>
      </InputContainer>
    </FormField>
  );
}

// Normalize +63 or 63 prefix to 09
function toPhoneDigits(value) {
  let digits = String(value ?? '').replace(/\D/g, '');

  if (digits.startsWith('63')) {
    digits = `0${digits.slice(2)}`;
  }

  return digits.slice(0, 11);
}

// Format phone number as 0912 345 6789
function formatPhoneDisplay(value) {
  const digits = toPhoneDigits(value);

  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 7),
    digits.slice(7, 11),
  ];

  return parts.filter(Boolean).join(' ');
}

// Phone number input
export function PhoneNumberField({
  value,
  onChange,
  inputProps = {},
  error,
  placeholder = '09XX XXX XXXX',
  showIcon = true,
  required = false,
  gap = 6,
}) {
  const handleChange = (text) => {
    if (!onChange) return;

    onChange(toPhoneDigits(text));
  };

  return (
    <FormField
      label="Mobile Number"
      required={required}
      error={error}
      gap={gap}
    >
      <InputContainer
        error={error}
        icon={
          showIcon ? (
            <Smartphone
              size={16}
              color={COLORS.muted}
            />
          ) : null
        }
      >
        <TextInput
          {...inputProps}
          value={formatPhoneDisplay(value)}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          keyboardType="phone-pad"
          maxLength={13}
          style={[
            tw`flex-1 px-3 text-sm text-slate-800`,
            { minHeight: 44 },
          ]}
        />
      </InputContainer>
    </FormField>
  );
}
