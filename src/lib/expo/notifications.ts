import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { database } from '../../database';
import { recurringItems } from '../../database/schema';
import { eq } from 'drizzle-orm';
import type { RecurringItem } from '../../database/schema';
import { formatCOP } from '../../domain/money';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================
//
// Handles scheduling and managing local notifications for recurring items.
// Uses Expo Notifications for local push notifications.
//
// Notifications are scheduled based on the nextDueDate of recurring items.
// The notification ID is stored in the recurringItem for cancellation/rescheduling.
// =============================================================================

/**
 * Requests notification permissions from the user.
 * Must be called before scheduling any notifications.
 *
 * @returns true if permission granted, false otherwise
 */
export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  if (existingStatus === 'denied') {
    // On iOS, we can't request again if denied
    // User must enable in Settings
    return false;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Gets the notification identifier for a recurring item.
 * Falls back to generating one deterministically from the item ID.
 */
function getNotificationIdentifier(item: RecurringItem): string {
  // Use item ID as the identifier for easy lookup
  return `recurring_${item.id}`;
}

/**
 * Schedules a local notification for a recurring item.
 * The notification will fire on the nextDueDate.
 *
 * For INCOME items: asks if the payment was received
 * For EXPENSE items: asks if the payment was made
 */
export async function scheduleRecurringNotification(
  item: RecurringItem
): Promise<string | null> {
  try {
    // Check permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('[Notifications] Permission not granted');
      return null;
    }

    // Cancel any existing notification for this item
    await cancelNotification(item.id);

    // Don't schedule if already executed or inactive
    if (item.status !== 'ACTIVE') {
      return null;
    }

    // NULL = "sin fecha": no hay cuándo avisar.
    if (item.nextDueDate === null) {
      return null;
    }

    const nextDue = new Date(item.nextDueDate);
    const now = new Date();

    // Don't schedule if the due date is in the past
    if (nextDue < now) {
      return null;
    }

    // Format the notification text based on type.
    // name y amountMinor son NULL en cuotas de deuda (salen de la deuda).
    const label = item.name ?? 'tu cuota';
    const amountText = item.amountMinor === null ? '' : ` de ${formatCOP(item.amountMinor)}`;

    let title: string;
    let body: string;

    if (item.type === 'INCOME') {
      title = 'Recordatorio de ingreso';
      body = `¿Te llegó tu pago de ${label}${amountText}?`;
    } else {
      title = 'Recordatorio de pago';
      body = `¿Ya pagaste ${label}${amountText}?`;
    }

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: getNotificationIdentifier(item),
      content: {
        title,
        body,
        data: {
          type: 'RECURRING_ITEM',
          recurringItemId: item.id,
          itemType: item.type,
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextDue,
      },
    });

    console.log(`[Notifications] Scheduled for ${item.name} at ${nextDue.toISOString()}, ID: ${notificationId}`);

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancels a specific notification by its identifier.
 * The identifier is the recurring item ID.
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`recurring_${notificationId}`);
    console.log(`[Notifications] Cancelled notification for ${notificationId}`);
  } catch (error) {
    // Notification might not exist, which is fine
    console.log(`[Notifications] No existing notification to cancel for ${notificationId}`);
  }
}

/**
 * Cancels all scheduled notifications.
 * Useful when user disables notifications entirely.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Cancelled all notifications');
  } catch (error) {
    console.error('[Notifications] Error cancelling all notifications:', error);
  }
}

/**
 * Reschedules all notifications for a user's recurring items.
 * First cancels all existing notifications, then creates new ones.
 *
 * This should be called:
 * - On app startup
 * - After editing recurring items
 * - After confirming/postponing an item
 */
export async function rescheduleAll(userId: string): Promise<void> {
  try {
    console.log(`[Notifications] Rescheduling all notifications for user ${userId}`);

    // Cancel all existing notifications first
    await cancelAllNotifications();

    // Get all active recurring items for the user
    const activeItems = await database.query.recurringItems.findMany({
      where: eq(recurringItems.userId, userId),
    });

    // Filter to only ACTIVE items with future due dates
    const now = new Date();
    const itemsToSchedule = activeItems.filter((item) => {
      if (item.status !== 'ACTIVE' || item.nextDueDate === null) return false;
      const nextDue = new Date(item.nextDueDate);
      return nextDue >= now;
    });

    // Schedule notifications for each item
    const results = await Promise.allSettled(
      itemsToSchedule.map((item) => scheduleRecurringNotification(item))
    );

    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;
    console.log(`[Notifications] Rescheduled ${successCount} of ${itemsToSchedule.length} notifications`);

    return;
  } catch (error) {
    console.error('[Notifications] Error rescheduling notifications:', error);
  }
}

/**
 * Gets all currently scheduled notifications.
 * Useful for debugging.
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}
