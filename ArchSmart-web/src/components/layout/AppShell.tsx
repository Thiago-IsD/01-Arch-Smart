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

// Navigation items with Dashboard as first item
const NAV_ITEMS = [
    { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
    { icon: Book, title: "Biblioteca", href: "/library" },
    { icon: Folder, title: "Projetos", href: "/projects" },
    { icon: Monitor, title: "Apresentações", href: "/presentations" },
    { icon: DollarSign, title: "Financeiro", href: "/finance" },
    { icon: Calendar, title: "Agenda", href: "/calendar" },
];

export function AppShell({ children }: AppShellProps) {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
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
            />

            {/* Backdrop */}
            {notificationsOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={() => setNotificationsOpen(false)}
                />
            )}
        </div>
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
}

function Header({ notificationsOpen, setNotificationsOpen, mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Generate breadcrumb from pathname
    const generateBreadcrumb = () => {
        const segments = pathname.split("/").filter(Boolean);
        const breadcrumbMap: Record<string, string> = {
            dashboard: "Dashboard",
            library: "Biblioteca",
            projects: "Projetos",
            presentations: "Apresentações",
            finance: "Financeiro",
            calendar: "Agenda",
            profile: "Perfil",
            billing: "Planos e Pagamentos",
            settings: "Configurações",
        };

        return segments.map((segment) => breadcrumbMap[segment] || segment);
    };

    const breadcrumbs = generateBreadcrumb();

    const handleLogout = async () => {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth/login");
    };

    return (
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm">
                        {breadcrumbs.length > 0 ? (
                            breadcrumbs.map((crumb, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && <span className="text-muted-foreground">/</span>}
                                    <span
                                        className={
                                            index === breadcrumbs.length - 1
                                                ? "font-medium text-foreground"
                                                : "text-muted-foreground"
                                        }
                                    >
                                        {crumb}
                                    </span>
                                </React.Fragment>
                            ))
                        ) : (
                            <span className="font-medium text-foreground">Dashboard</span>
                        )}
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
                        <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
                    </button>

                    {/* User Avatar Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent transition-colors">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-4 w-4 text-primary" />
                                </div>
                                <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/profile" className="cursor-pointer">
                                    <User className="mr-2 h-4 w-4" />
                                    Perfil
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/settings" className="cursor-pointer">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Configurações
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/billing" className="cursor-pointer">
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Plano & Billing
                                </Link>
                            </DropdownMenuItem>
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
}

function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
    // Mock notifications
    const notifications = [
        {
            id: 1,
            title: "Bem-vindo ao Arch Smart!",
            message: "Explore todas as funcionalidades da plataforma.",
            time: "Agora",
            unread: true,
        },
        {
            id: 2,
            title: "Novo projeto criado",
            message: "O projeto 'Casa Moderna' foi criado com sucesso.",
            time: "2h atrás",
            unread: true,
        },
        {
            id: 3,
            title: "Atualização de sistema",
            message: "Nova versão disponível com melhorias de performance.",
            time: "1 dia atrás",
            unread: false,
        },
    ];

    return (
        <div
            className={`fixed top-0 right-0 h-full w-96 bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Notificações</h2>
                <button
                    onClick={onClose}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto h-[calc(100%-4rem)]">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`p-4 border-b border-border hover:bg-accent/50 transition-colors cursor-pointer ${notification.unread ? "bg-primary/5" : ""
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-1 h-2 w-2 rounded-full ${notification.unread ? "bg-primary" : "bg-transparent"}`} />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-foreground mb-1">
                                    {notification.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                    {notification.message}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                    {notification.time}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AppShell;
