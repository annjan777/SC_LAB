import { query } from '../config/database.js';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const { userId, type, title, message, relatedEntityType, relatedEntityId, actionUrl } = params;

    await query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, title, message, relatedEntityType || null, relatedEntityId || null, actionUrl || null]
    );
  } catch (err: any) {
    console.error('[NOTIFICATION ERROR] Failed to create notification:', err.message);
  }
}
