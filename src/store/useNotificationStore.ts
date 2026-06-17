import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// NOTIFICATION STORE
// =============================================================================
//
// Persisted store for tracking scheduled notifications.
// This is persisted because:
// - Notification IDs are needed to cancel/reschedule on app restart
// - Loss of notification tracking would leave "orphan" notifications
// - Small data, safe to persist
// =============================================================================

export type NotificationType =
  | 'RECURRING_INCOME'
  | 'RECURRING_EXPENSE'
  | 'DEBT_PAYMENT'
  | 'BUDGET_WARNING'
  | 'GENERAL_REMINDER';

export interface ScheduledNotification {
  id: string; // Expo notification ID
  type: NotificationType;
  title: string;
  body: string;
  scheduledFor: Date;
  recurringItemId?: string; // Link to recurring item if applicable
  debtId?: string; // Link to debt if applicable
  data?: Record<string, string>; // Additional payload data
}

interface NotificationState {
  // Scheduled notifications (keyed by notification ID)
  scheduledNotifications: Record<string, ScheduledNotification>;

  // Actions
  addNotification: (notification: ScheduledNotification) => void;
  removeNotification: (id: string) => void;
  updateNotification: (id: string, updates: Partial<ScheduledNotification>) => void;
  clearAllNotifications: () => void;
  getNotificationsByType: (type: NotificationType) => ScheduledNotification[];
  getNotificationsForRecurringItem: (
    recurringItemId: string
  ) => ScheduledNotification[];
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      scheduledNotifications: {},

      addNotification: (notification) =>
        set((state) => ({
          scheduledNotifications: {
            ...state.scheduledNotifications,
            [notification.id]: notification,
          },
        })),

      removeNotification: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.scheduledNotifications;
          return { scheduledNotifications: rest };
        }),

      updateNotification: (id, updates) =>
        set((state) => ({
          scheduledNotifications: {
            ...state.scheduledNotifications,
            [id]: {
              ...state.scheduledNotifications[id],
              ...updates,
            },
          },
        })),

      clearAllNotifications: () => set({ scheduledNotifications: {} }),

      getNotificationsByType: (type) => {
        const { scheduledNotifications } = get();
        return Object.values(scheduledNotifications).filter(
          (n) => n.type === type
        );
      },

      getNotificationsForRecurringItem: (recurringItemId) => {
        const { scheduledNotifications } = get();
        return Object.values(scheduledNotifications).filter(
          (n) => n.recurringItemId === recurringItemId
        );
      },
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scheduledNotifications: state.scheduledNotifications,
      }),
    }
  )
);

// Selector helpers
export const useScheduledNotificationIds = () =>
  useNotificationStore((s) => Object.keys(s.scheduledNotifications));
export const useNotificationCount = () =>
  useNotificationStore((s) => Object.keys(s.scheduledNotifications).length);
