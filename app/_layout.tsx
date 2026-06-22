import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/lib/queryClient";
import { useSession } from "@/hooks/use-session";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import "../global.css";

// Keep the splash screen visible until we know the auth state
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthGate />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

/**
 * Auth gate that redirects to login or main tabs based on session state.
 * Mirrors the web app's _authenticated/route.tsx guard.
 */
function AuthGate() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Not signed in → redirect to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Signed in but on auth screen → redirect to dashboard
      router.replace("/(tabs)");
    }

    // Hide splash screen now that we know auth state
    SplashScreen.hideAsync();
  }, [session, loading, segments]);

  return <Slot />;
}
