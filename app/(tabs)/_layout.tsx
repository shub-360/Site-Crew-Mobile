import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsDark } from "@/hooks/use-is-dark";
import {
  LayoutDashboard,
  HardHat,
  CalendarCheck,
  Users,
  FileSpreadsheet,
} from "lucide-react-native";
import { BlurView } from "expo-blur";
import { StyleSheet, View, Platform, Animated } from "react-native";
import { useEffect, useRef } from "react";

const ICON_SIZE = 20;

function TabBarIcon({
  IconComponent,
  color,
  focused,
  isDark,
}: {
  IconComponent: any;
  color: any;
  focused: boolean;
  isDark: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.08 : 1.0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.08 : 1.0,
      friction: 9,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
      }}
    >
      {focused && (
        <View
          style={{
            position: "absolute",
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isDark
              ? "rgba(184, 202, 217, 0.12)"
              : "rgba(23, 59, 108, 0.08)",
            shadowColor: isDark ? "#B8CAD9" : "#173B6C",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.25 : 0.15,
            shadowRadius: 6,
            elevation: 2,
          }}
        />
      )}
      <IconComponent size={ICON_SIZE} color={color} />
    </Animated.View>
  );
}

/**
 * Bottom tab navigator styled as an Apple-inspired capsule floating navigation bar.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();

  const activeColor = isDark ? "#B8CAD9" : "#173B6C"; // Steel Blue in dark, Deep Navy in light
  const inactiveColor = isDark ? "#94A3B8" : "#64748B"; // Slate-400 in dark, Slate-500 in light (brighter gray for better contrast)

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
        headerTitleStyle: { fontWeight: "700", fontSize: 18, color: isDark ? "#F8FAFC" : "#0F172A" },
        headerShadowVisible: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderWidth: 0,
          bottom: insets.bottom > 0 ? insets.bottom : 12,
          left: 16,
          right: 16,
          borderRadius: 36,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: isDark ? "#000000" : "#1E293B",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 20,
          elevation: 8,
        },
        tabBarBackground: () => (
          <View
            style={{
              flex: 1,
              borderRadius: 36,
              overflow: "hidden",
              borderWidth: 0.5,
              borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.08)",
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.65)",
            }}
          >
            <BlurView
              intensity={isDark ? 70 : 80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={LayoutDashboard} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={HardHat} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={CalendarCheck} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="workers"
        options={{
          title: "Workers",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={Users} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={FileSpreadsheet} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
    </Tabs>
  );
}
