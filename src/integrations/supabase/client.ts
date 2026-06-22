import { createClient } from "@supabase/supabase-js";
import { MMKV } from "react-native-mmkv";
import { Paths, File } from "expo-file-system";
import type { Database } from "./types";

const sessionFile = new File(Paths.document, "supabase-session.json");

// Persistent storage adapter (synchronous MMKV for standalone, async FileSystem for Expo Go)
let storage: {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

try {
  const mmkvInstance = new MMKV({ id: "supabase-auth" });
  storage = {
    getItem: (key: string) => mmkvInstance.getString(key) ?? null,
    setItem: (key: string, value: string) => mmkvInstance.set(key, value),
    removeItem: (key: string) => mmkvInstance.delete(key),
  };
} catch (e) {
  console.warn(
    "[Supabase] react-native-mmkv failed to initialize (this is expected in standard Expo Go). Falling back to persistent file-based session storage."
  );
  storage = {
    getItem: async (key: string): Promise<string | null> => {
      try {
        if (!sessionFile.exists) return null;
        const content = await sessionFile.text();
        const data = JSON.parse(content);
        return data[key] ?? null;
      } catch (err) {
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        let data: Record<string, string> = {};
        if (sessionFile.exists) {
          const content = await sessionFile.text();
          data = JSON.parse(content);
        }
        data[key] = value;
        sessionFile.write(JSON.stringify(data));
      } catch (err) {
        // ignore
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        if (sessionFile.exists) {
          const content = await sessionFile.text();
          const data = JSON.parse(content);
          delete data[key];
          sessionFile.write(JSON.stringify(data));
        }
      } catch (err) {
        // ignore
      }
    },
  };
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const missing = [
    ...(!SUPABASE_URL ? ["EXPO_PUBLIC_SUPABASE_URL"] : []),
    ...(!SUPABASE_ANON_KEY ? ["EXPO_PUBLIC_SUPABASE_ANON_KEY"] : []),
  ];
  console.error(
    `[Supabase] Missing environment variable(s): ${missing.join(", ")}`
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Not needed for React Native
  },
});

