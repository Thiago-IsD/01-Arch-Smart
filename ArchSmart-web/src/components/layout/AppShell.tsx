"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Book,
    Folder,
    Monitor,
    DollarSign,
    Calendar,
    ChevronsRight,
    ChevronDown,
    User,
    Settings,
    CreditCard,
    LogOut,
    Bell,
    Sun,
    Moon,
    X,
    Menu,
} from "lucide-react";
import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "next-themes";

interface AppShellProps {
    children: React.ReactNode;
}

import { NAV_ITEMS, PROFILE_MENU_ITEMS } from "@/config/navigation";
import { BreadcrumbProvider, useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { apiUrl } from "@/lib/api-url";

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

import { createClient } from "@/utils/supabase/client";

export function AppShell({ children }: AppShellProps) {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const supabase = createClient();
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData?.session?.access_token;

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
            const supabase = createClient();
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

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
                    <main className="flex-1 p-6 pr-8 md:pr-16 lg:pr-24 xl:pr-32 overflow-auto">{children}</main>
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

function Sidebar() {
    const [open, setOpen] = useState(true);
    const pathname = usePathname();

    // Persist sidebar state
    useEffect(() => {
        const saved = localStorage.getItem("sidebar-open");
        if (saved !== null) {
            setOpen(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("sidebar-open", JSON.stringify(open));
    }, [open]);

    return (
        <nav
            className={`sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out ${open ? "w-64" : "w-16"
                } border-border bg-card p-2 shadow-sm`}
        >
            {/* Logo Section */}
            <div className="mb-6 border-b border-border pb-4">
                <div className="flex items-center gap-3 p-2">
                    <div className="relative w-10 h-10 shrink-0">
                        <Image
                            src={BRAND_ASSETS.icon}
                            alt="Arch Smart"
                            fill
                            className="object-contain"
                        />
                    </div>
                    {open && (
                        <div className="transition-opacity duration-200">
                            <span className="block text-sm font-semibold text-foreground">
                                Arch Smart
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Items */}
            <div className="space-y-1 mb-8">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${isActive
                                ? "bg-primary/10 text-primary shadow-sm border-l-2 border-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                }`}
                        >
                            <div className="grid h-full w-12 place-content-center">
                                <item.icon className="h-4 w-4" />
                            </div>
                            {open && (
                                <span className="text-sm font-medium transition-opacity duration-200">
                                    {item.title}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setOpen(!open)}
                className="absolute bottom-0 left-0 right-0 border-t border-border transition-colors hover:bg-accent"
            >
                <div className="flex items-center p-3">
                    <div className="grid size-10 place-content-center">
                        <ChevronsRight
                            className={`h-4 w-4 transition-transform duration-300 text-muted-foreground ${open ? "rotate-180" : ""
                                }`}
                        />
                    </div>
                    {open && (
                        <span className="text-sm font-medium text-muted-foreground transition-opacity duration-200">
                            Ocultar
                        </span>
                    )}
                </div>
            </button>
        </nav>
    );
}

function MobileSidebar({ onNavigate }: { onNavigate: () => void }) {
    const pathname = usePathname();

    return (
        <nav className="h-full bg-card p-2">
            {/* Logo Section */}
            <div className="mb-6 border-b border-border pb-4">
                <div className="flex items-center gap-3 p-2">
                    <div className="relative w-10 h-10 shrink-0">
                        <Image
                            src={BRAND_ASSETS.icon}
                            alt="Arch Smart"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <div>
                        <span className="block text-sm font-semibold text-foreground">
                            Arch Smart
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${isActive
                                ? "bg-primary/10 text-primary shadow-sm border-l-2 border-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                }`}
                        >
                            <div className="grid h-full w-12 place-content-center">
                                <item.icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium">
                                {item.title}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

interface HeaderProps {
    notificationsOpen: boolean;
    setNotificationsOpen: (open: boolean) => void;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    unreadCount: number;
}

function Header({ notificationsOpen, setNotificationsOpen, mobileMenuOpen, setMobileMenuOpen, unreadCount }: HeaderProps) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch for date rendering
    useEffect(() => {
        setMounted(true);
    }, []);


    const handleLogout = async () => {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth/login");
    };

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6 pr-8 md:pr-16 lg:pr-24 xl:pr-32">
                {/* Left Side: Mobile Menu + Breadcrumb */}
                <div className="flex items-center gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden h-9 w-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                        aria-label="Menu"
                    >
                        <Menu className="h-5 w-5 text-foreground" />
                    </button>

                    {/* Title + Date */}
                    <div className="flex flex-col">
                        <span className="font-semibold text-foreground text-sm leading-tight">
                            Bem-vindo à Arch Smart
                        </span>
                        <span className="text-xs text-muted-foreground mt-0.5">
                            {mounted
                                ? new Date().toLocaleDateString("pt-BR", {
                                    weekday: "long",
                                    day: "2-digit",
                                    month: "long",
                                    year: "numeric",
                                })
                                : "..."}
                        </span>
                    </div>
                </div>

                {/* Right Side: Theme Toggle + Notifications + User Avatar */}
                <div className="flex items-center gap-2">
                    {/* Theme Toggle */}
                    {mounted && (
                        <button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                            aria-label="Toggle theme"
                        >
                            {theme === "dark" ? (
                                <Sun className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Moon className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    )}

                    {/* Notifications Button */}
                    <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="relative h-9 w-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                        aria-label="Notificações"
                    >
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        {/* Notification badge */}
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
                        )}
                    </button>

                    {/* User Avatar Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button suppressHydrationWarning className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent transition-colors">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-4 w-4 text-primary" />
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {PROFILE_MENU_ITEMS.map((item) => (
                                <DropdownMenuItem key={item.href} asChild>
                                    <Link href={item.href} className="cursor-pointer">
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.title}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                Sair
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onMarkAsRead: (id: string) => void;
}

function NotificationPanel({ isOpen, onClose, notifications, onMarkAsRead }: NotificationPanelProps) {
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

export default AppShell;
