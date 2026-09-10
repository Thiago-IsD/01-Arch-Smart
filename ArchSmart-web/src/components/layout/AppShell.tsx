"use client";

import React, { useState, useEffect } from "react";

import {
    Sheet,
    SheetContent,
    SheetTitle,
} from "@/components/ui/sheet";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { apiUrl } from "@/lib/api-url";
import { getAccessToken } from "@/lib/api/auth";

import { Header } from "./app-shell/Header";
import { MobileSidebar } from "./app-shell/MobileSidebar";
import { NotificationPanel } from "./app-shell/NotificationPanel";
import { Sidebar } from "./app-shell/Sidebar";
import type { NotificationItem } from "./app-shell/types";

// Reexportado porque `NotificationItem` era exportado daqui antes da quebra
// da Tarefa 9; a definicao mora em ./app-shell/types.
export type { NotificationItem };

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const token = await getAccessToken();

                const headers: HeadersInit = {};
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                }

                const res = await fetch(apiUrl("/api/notifications"), {
                    headers
                });

                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data);
                }
            } catch (error) {
                console.error("Failed to fetch notifications", error);
            }
        };
        fetchNotifications();
    }, []);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const handleMarkAsRead = async (id: string) => {
        try {
            const token = await getAccessToken();

            const headers: HeadersInit = {};
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch(apiUrl(`/api/notifications/${id}/read`), {
                method: "PATCH",
                headers
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <BreadcrumbProvider>
            <div className="flex min-h-screen w-full bg-background">
                {/* Desktop Sidebar */}
                <div className="hidden lg:block">
                    <Sidebar />
                </div>

                <div className="flex-1 flex flex-col">
                    <Header
                        notificationsOpen={notificationsOpen}
                        setNotificationsOpen={setNotificationsOpen}
                        mobileMenuOpen={mobileMenuOpen}
                        setMobileMenuOpen={setMobileMenuOpen}
                        unreadCount={unreadCount}
                    />
                    <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
                </div>

                {/* Mobile Sidebar Sheet */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetContent side="left" className="p-0 w-64">
                        <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
                        <MobileSidebar onNavigate={() => setMobileMenuOpen(false)} />
                    </SheetContent>
                </Sheet>

                {/* Notification Panel */}
                <NotificationPanel
                    isOpen={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                    notifications={notifications}
                    onMarkAsRead={handleMarkAsRead}
                />

                {/* Backdrop */}
                {notificationsOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-[115] transition-opacity"
                        onClick={() => setNotificationsOpen(false)}
                    />
                )}
            </div>
        </BreadcrumbProvider>
    );
}

export default AppShell;
