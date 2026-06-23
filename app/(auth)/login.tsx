import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { HardHat } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail } from "@/lib/validation";
import { useIsDark } from "@/hooks/use-is-dark";
import { PressableScale } from "@/components/PressableScale";

/**
 * Login / Signup screen.
 * Preserves the exact same auth flow as the web app's auth.tsx:
 * - Email + password sign in
 * - Email + password sign up
 * - Supabase auth via the shared client
 */
export default function LoginScreen() {
  const isDark = useIsDark();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function handleModeChange(newMode: "signin" | "signup") {
    setMode(newMode);
    setFullName("");
  }

  async function handleSubmit() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }

    if (!validateEmail(cleanEmail)) {
      Alert.alert(
        "Invalid Email",
        "Please enter a valid email address with a domain and TLD (e.g. shubham@company.com)."
      );
      return;
    }

    if (mode === "signup") {
      if (!fullName.trim()) {
        Alert.alert("Error", "Please enter your full name.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const cleanName = fullName.trim();
        const { data: { user }, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName,
              display_name: cleanName,
            }
          }
        });
        if (error) throw error;
        if (!user) throw new Error("Account creation failed. Please try again.");

        // Automatically create user profile
        const { error: profileError } = await supabase.from("profiles").insert({
          id: user.id,
          full_name: cleanName,
          email: cleanEmail,
        });

        if (profileError) {
          console.error("Profile creation error during signup:", profileError);
        }

        Alert.alert("Success", "Account created successfully!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      Alert.alert("Authentication Failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className={`flex-1 ${isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]"}`}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        className="px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View className="items-center mb-10">
          <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-4 border ${
            isDark ? "bg-slate-800 border-slate-700" : "bg-[#173B6C] border-[#173B6C]"
          }`}>
            <HardHat size={28} color={isDark ? "#B8CAD9" : "#FFFFFF"} />
          </View>
          <Text className={`text-2xl font-bold tracking-tight ${isDark ? "text-slate-100" : "text-[#173B6C]"}`}>
            SiteCrew
          </Text>
          <Text className={`text-sm mt-1 text-center px-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Workforce & project management for contractors
          </Text>
        </View>

        {/* Card */}
        <View
          style={
            isDark
              ? null
              : {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }
          }
          className={`border p-6 rounded-[16px] ${
            isDark ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          {/* Tab Switcher */}
          <View className={`flex-row rounded-[12px] p-1 mb-6 ${
            isDark ? "bg-slate-800" : "bg-slate-100"
          }`}>
            <TouchableOpacity
              onPress={() => handleModeChange("signin")}
              style={
                mode === "signin" && !isDark
                  ? {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                      elevation: 2,
                    }
                  : null
              }
              className={`flex-1 py-2.5 rounded-lg items-center ${
                mode === "signin" ? (isDark ? "bg-slate-700" : "bg-white") : ""
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  mode === "signin"
                    ? isDark ? "text-slate-100" : "text-slate-800"
                    : "text-slate-500"
                }`}
              >
                Sign in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleModeChange("signup")}
              style={
                mode === "signup" && !isDark
                  ? {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                      elevation: 2,
                    }
                  : null
              }
              className={`flex-1 py-2.5 rounded-lg items-center ${
                mode === "signup" ? (isDark ? "bg-slate-700" : "bg-white") : ""
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  mode === "signup"
                    ? isDark ? "text-slate-100" : "text-slate-800"
                    : "text-slate-500"
                }`}
              >
                Create account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View className="gap-4">
            {mode === "signup" && (
              <View className="gap-1.5">
                <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Full Name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Shubham Sharma"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  autoComplete="name"
                  className={`h-12 px-4 border rounded-[14px] text-base ${
                    isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-850"
                  }`}
                />
              </View>
            )}

            <View className="gap-1.5">
              <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className={`h-12 px-4 border rounded-[14px] text-base ${
                  isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-850"
                }`}
              />
            </View>

            <View className="gap-1.5">
              <Text className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                secureTextEntry
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className={`h-12 px-4 border rounded-[14px] text-base ${
                  isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-850"
                }`}
              />
            </View>

            <PressableScale
              onPress={handleSubmit}
              disabled={busy}
              style={busy ? { opacity: 0.5 } : null}
              className={`h-12 rounded-[14px] items-center justify-center mt-2 ${
                isDark ? "bg-[#B8CAD9]" : "bg-[#173B6C] active:bg-[#122c52]"
              }`}
            >
              {busy ? (
                <ActivityIndicator color={isDark ? "#0F172A" : "#FFFFFF"} />
              ) : (
                <Text className={`text-base font-semibold ${isDark ? "text-slate-900" : "text-white"}`}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Text>
              )}
            </PressableScale>
          </View>
        </View>

        <Text className={`text-xs text-center mt-8 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          By continuing you agree to manage your workforce data securely.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
