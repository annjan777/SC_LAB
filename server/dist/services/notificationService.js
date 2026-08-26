import { query } from '../config/database.js';
export async function createNotification(params) {
    try {
        const { userId, type, title, message, relatedEntityType, relatedEntityId, actionUrl } = params;
        await query(`INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [userId, type, title, message, relatedEntityType || null, relatedEntityId || null, actionUrl || null]);
    }
    catch (err) {
        console.error('[NOTIFICATION ERROR] Failed to create notification:', err.message);
    }
}
