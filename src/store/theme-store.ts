import { create } from "zustand";

const getStoredPreference = (): "light" | "dark" | "system" => {
  try {
    const mmkv = require("react-native-mmkv");
    const storage = new mmkv.MMKV();
    return (storage.getString("theme-preference") as any) || "system";
  } catch {
    return "system";
  }
};

const setStoredPreference = (pref: string) => {
  try {
    const mmkv = require("react-native-mmkv");
    const storage = new mmkv.MMKV();
    storage.set("theme-preference", pref);
  } catch {
    // fallback or no-op
  }
};

interface ThemeState {
  preference: "light" | "dark" | "system";
  setPreference: (pref: "light" | "dark" | "system") => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: getStoredPreference(),
  setPreference: (pref) => {
    setStoredPreference(pref);
    set({ preference: pref });
  },
}));
