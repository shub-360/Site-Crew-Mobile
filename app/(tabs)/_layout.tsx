import { Tabs } from "expo-router";
import {
  LayoutDashboard,
  HardHat,
  CalendarCheck,
  Users,
  FileSpreadsheet,
} from "lucide-react-native";

const ICON_SIZE = 22;
const ACTIVE_COLOR = "#1E3A5F";
const INACTIVE_COLOR = "#94A3B8";

/**
 * Bottom tab navigator matching the web app's sidebar navigation.
 * Maps the same 5 main routes:
 *   Dashboard → Projects → Attendance → Workers → Reports
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTitleStyle: { fontWeight: "700", fontSize: 18, color: "#0F172A" },
        headerShadowVisible: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E2E8F0",
          borderTopWidth: 1,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
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
