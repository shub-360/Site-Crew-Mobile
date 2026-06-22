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

/**
 * Login / Signup screen.
 * Preserves the exact same auth flow as the web app's auth.tsx:
 * - Email + password sign in
 * - Email + password sign up
 * - Supabase auth via the shared client
 */
export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("Success", "Account created. You are now signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      // Auth state change listener in _layout.tsx handles navigation
    } catch (err: any) {
      Alert.alert("Authentication Failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View className="items-center mb-10">
          <View className="w-14 h-14 rounded-2xl bg-primary items-center justify-center mb-4 shadow-sm">
            <HardHat size={28} color="#FFFFFF" />
          </View>
          <Text className="text-2xl font-bold tracking-tight text-foreground">
            SiteCrew
          </Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Workforce & project management for contractors
          </Text>
        </View>

        {/* Card */}
        <View className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          {/* Tab Switcher */}
          <View className="flex-row bg-muted rounded-xl p-1 mb-6">
            <TouchableOpacity
              onPress={() => setMode("signin")}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                mode === "signin" ? "bg-white shadow-sm" : ""
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  mode === "signin"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Sign in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode("signup")}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                mode === "signup" ? "bg-white shadow-sm" : ""
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  mode === "signup"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Create account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="h-12 px-4 rounded-xl border border-input bg-white text-foreground text-base"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className="h-12 px-4 rounded-xl border border-input bg-white text-foreground text-base"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={busy}
              className={`h-12 rounded-xl items-center justify-center mt-2 ${
                busy ? "bg-primary/70" : "bg-primary"
              }`}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-primary-foreground">
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-xs text-muted-foreground text-center mt-8">
          By continuing you agree to manage your workforce data securely.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
