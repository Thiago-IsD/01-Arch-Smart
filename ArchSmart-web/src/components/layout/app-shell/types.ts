/** Notificacao como o AppShell a recebe de GET /api/notifications. */
export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}
