export interface CreateNotificationParams {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    actionUrl?: string;
}
export declare function createNotification(params: CreateNotificationParams): Promise<void>;
