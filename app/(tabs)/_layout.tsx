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

const ICON_SIZE = 20;

/**
 * Bottom tab navigator styled as an Apple-inspired capsule floating navigation bar.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();

  const activeColor = isDark ? "#B8CAD9" : "#173B6C"; // Steel Blue in dark, Deep Navy in light
  const inactiveColor = isDark ? "#64748B" : "#94A3B8";

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
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.92)" : "rgba(255, 255, 255, 0.92)",
          borderWidth: 1,
          borderColor: isDark ? "#334155" : "#E2E8F0",
          bottom: insets.bottom > 0 ? insets.bottom : 12,
          left: 16,
          right: 16,
          borderRadius: 32,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.25 : 0.08,
          shadowRadius: 16,
          elevation: 6,
        },
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
          tabBarIcon: ({ color }) => (
            <LayoutDashboard size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color }) => (
            <HardHat size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color }) => (
            <CalendarCheck size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workers"
        options={{
          title: "Workers",
          tabBarIcon: ({ color }) => (
            <Users size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color }) => (
            <FileSpreadsheet size={ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
