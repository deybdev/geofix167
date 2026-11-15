import { useState } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import tw from "twrnc";
import GoogleIcon from "../../../assets/google-icon.png";
import { UserRound } from "lucide-react-native";

import { useAuth } from "../../context/AuthContext";
import { loginSchema } from "../../schema/login.schema";
import AuthLayout from "../../layouts/AuthLayout";
import {
  PhoneNumberField,
  PasswordField,
} from "../../components/forms/FormField";
import PressableScale from "../../components/shared/PressableScale";
import AnimatedErrorBanner from "../../components/shared/ErrorBanner";
import {
  useEntranceAnimation,
  useShakeAnimation,
  Animated,
} from "../../hooks/useAnimation";

export default function Login() {
  const navigation = useNavigation();
  const { signIn, signOut } = useAuth();

  const [serverError, setServerError] = useState("");

  const entranceStyle = useEntranceAnimation();
  const { triggerShake } = useShakeAnimation();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { phoneNumber: "", password: "" },
  });

  const handleLogin = async (values) => {
    setServerError("");

    const result = await signIn(values.phoneNumber, values.password);
    const user = result.user;

    if (user?.role === "admin") {
      await signOut();
      setServerError("Invalid mobile number or password.");
      triggerShake();
      return;
    }

    if (!result.success || !user) {
      setServerError(result.message ?? "Login failed. Please try again.");
      triggerShake();
      return;
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
          <Text style={tw`text-2xl font-bold text-gray-800`}>Welcome back</Text>
          <Text style={tw`mb-6 mt-1 text-sm text-gray-500`}>
            Sign in to report and respond in your barangay.
          </Text>

          <View style={tw`gap-4`}>
            <AnimatedErrorBanner
              message={serverError}
              onDismiss={() => setServerError("")}
            />

            <Controller
              control={control}
              name="phoneNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <PhoneNumberField
                  value={value}
                  onChange={(v) => {
                    if (serverError) setServerError("");
                    onChange(v);
                  }}
                  error={errors.phoneNumber?.message}
                  inputProps={{
                    onBlur,
                    autoComplete: "tel",
                    returnKeyType: "next",
                  }}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordField
                  value={value}
                  onChange={(v) => {
                    if (serverError) setServerError("");
                    onChange(v);
                  }}
                  error={errors.password?.message}
                  inputProps={{
                    onBlur,
                    autoComplete: "current-password",
                    returnKeyType: "done",
                    onSubmitEditing: handleSubmit(handleLogin),
                  }}
                />
              )}
            />
          </View>

          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            hitSlop={8}
            style={tw`mt-3 self-end`}
          >
            {({ pressed }) => (
              <Text
                style={tw.style(
                  "text-xs font-semibold text-[#2E8B57]",
                  pressed && "opacity-60",
                )}
              >
                Forgot Password?
              </Text>
            )}
          </Pressable>

          <PressableScale
            onPress={handleSubmit(handleLogin)}
            disabled={isSubmitting}
            accessibilityRole="button"
            style={tw.style(
              "mt-5 h-12 items-center justify-center rounded-xl bg-[#2E8B57]",
              isSubmitting && "opacity-80",
            )}
          >
            <Text style={tw`text-sm font-semibold text-white`}>
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Text>
          </PressableScale>

          <View style={tw`my-5 flex-row items-center`}>
            <View style={tw`h-px flex-1 bg-gray-200`} />
            <Text style={tw`mx-3 text-xs text-gray-400`}>or continue with</Text>
            <View style={tw`h-px flex-1 bg-gray-200`} />
          </View>

          <PressableScale
            onPress={() => {}}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            style={tw`h-12 flex-row items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white`}
          >
            <Image
              source={GoogleIcon}
              style={{ width: 20, height: 20 }}
              resizeMode="contain"
            />

            <Text style={tw`text-sm font-semibold text-gray-700`}>
              Sign in with Google
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => navigation.navigate("Guest")}
            style={tw`flex-row items-center justify-center rounded-xl border border-gray-200 bg-white mt-1.5 py-3.5`}
          >
            <UserRound size={18} color="#4B5563" style={tw`mr-2`} />
            <Text style={tw`text-sm font-semibold text-gray-700`}>
              Continue as Guest
            </Text>
          </PressableScale>

          <View style={tw`mt-6 flex-row justify-center`}>
            <Text style={tw`text-[13px] text-gray-500`}>
              Don&apos;t have an account?{" "}
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Register")}
              hitSlop={8}
            >
              {({ pressed }) => (
                <Text
                  style={tw.style(
                    "text-[13px] font-semibold text-[#2E8B57]",
                    pressed && "opacity-60",
                  )}
                >
                  Create Account
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </AuthLayout>
  );
}
