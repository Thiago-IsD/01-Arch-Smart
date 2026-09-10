"use client";

import { Bell, X } from "lucide-react";

import type { NotificationItem } from "./types";

export interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onMarkAsRead: (id: string) => void;
}

export function NotificationPanel({ isOpen, onClose, notifications, onMarkAsRead }: NotificationPanelProps) {
    return (
        <div
            className={`fixed top-0 right-0 h-full w-96 bg-card border-l border-border shadow-2xl z-[120] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Notificações</h2>
                <div className="flex items-center gap-2">
                    {/* Optional: mark all as read button here */}
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center space-y-4">
                        <Bell className="w-8 h-8 opacity-20" />
                        <p className="text-sm">Nenhuma notificação por enquanto.</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => {
                                if (!notification.is_read) onMarkAsRead(notification.id);
                            }}
                            className={`p-4 border-b border-border hover:bg-accent/50 transition-colors cursor-pointer ${!notification.is_read ? "bg-primary/5" : ""
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${!notification.is_read ? "bg-primary" : "bg-transparent"}`} />
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-foreground mb-1 leading-tight">
                                        {notification.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-2 leading-snug">
                                        {notification.message}
                                    </p>
                                    <span className="text-[11px] font-medium text-muted-foreground/80">
                                        {new Date(notification.created_at).toLocaleString("pt-BR", {
                                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
