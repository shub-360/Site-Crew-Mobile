import { useColorScheme as useDeviceColorScheme } from "react-native";
import { useThemeStore } from "@/store/theme-store";

/**
 * Custom hook to check if the current active color scheme is Dark.
 * Automatically resolves "system" preferences using the device's color scheme.
 */
export function useIsDark(): boolean {
  const preference = useThemeStore((state) => state.preference);
  const deviceScheme = useDeviceColorScheme();

  if (preference === "system") {
    return deviceScheme === "dark";
  }
  return preference === "dark";
}
