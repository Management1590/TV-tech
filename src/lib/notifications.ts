// ============================================================
// RD-8: Notification Infrastructure Stub
// ============================================================
// Low-overhead server utility for queuing notifications.
// Future Phase: Wire up real-time SSE / Supabase Realtime / WebPush.

export interface NotificationPayload {
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function notify(
  userId: string,
  type: 'LOW_STOCK' | 'OOS_ALERT' | 'PURCHASE_LIST_UPDATE' | 'SYSTEM_ALERT',
  payload: NotificationPayload
): Promise<void> {
  console.log(`[NOTIFICATION STUB] [${type}] to user ${userId}:`, payload);
  // Future: Insert into notifications table or dispatch via Supabase Realtime channel
}
