import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// USER STORE
// =============================================================================
//
// Persisted store for user settings and preferences.
// This is appropriate for persistence because:
// - Settings are small JSON objects
// - Loss of data is not critical (user can re-configure)
// - Doesn't require ACID guarantees like financial data
// =============================================================================

export type ThemeMode = 'dark' | 'light' | 'system';

interface UserSettings {
  theme: ThemeMode;
  currency: string;
  notificationsEnabled: boolean;
  reminderDaysBefore: number;
  onboardingCompleted: boolean;
}

interface UserState {
  // User ID (set after first launch)
  userId: string;

  // Settings
  settings: UserSettings;

  // Actions
  setUserId: (userId: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setCurrency: (currency: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderDaysBefore: (days: number) => void;
  completeOnboarding: () => void;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  currency: 'COP',
  notificationsEnabled: true,
  reminderDaysBefore: 1,
  onboardingCompleted: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: 'default-user', // Will be replaced with real UUID in production
      settings: defaultSettings,

      setUserId: (userId) => set({ userId }),

      setTheme: (theme) =>
        set((state) => ({
          settings: { ...state.settings, theme },
        })),

      setCurrency: (currency) =>
        set((state) => ({
          settings: { ...state.settings, currency },
        })),

      setNotificationsEnabled: (notificationsEnabled) =>
        set((state) => ({
          settings: { ...state.settings, notificationsEnabled },
        })),

      setReminderDaysBefore: (reminderDaysBefore) =>
        set((state) => ({
          settings: { ...state.settings, reminderDaysBefore },
        })),

      completeOnboarding: () =>
        set((state) => ({
          settings: { ...state.settings, onboardingCompleted: true },
        })),

      resetSettings: () =>
        set({ settings: defaultSettings }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userId: state.userId,
        settings: state.settings,
      }),
    }
  )
);

// Selector helpers for common patterns
export const useTheme = () => useUserStore((s) => s.settings.theme);
export const useUserId = () => useUserStore((s) => s.userId);
export const useOnboardingCompleted = () =>
  useUserStore((s) => s.settings.onboardingCompleted);
