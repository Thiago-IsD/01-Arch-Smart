"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ChevronDown,
    User,
    LogOut,
    Bell,
    Sun,
    Moon,
    Menu,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROFILE_MENU_ITEMS } from "@/config/navigation";

import { HeaderBreadcrumb } from "./HeaderBreadcrumb";

export interface HeaderProps {
    notificationsOpen: boolean;
    setNotificationsOpen: (open: boolean) => void;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    unreadCount: number;
}

export function Header({ notificationsOpen, setNotificationsOpen, mobileMenuOpen, setMobileMenuOpen, unreadCount }: HeaderProps) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch for date rendering
    useEffect(() => {
        setMounted(true);
    }, []);


    const handleLogout = async () => {
        const { signOut } = await import("@/lib/api/auth");
        await signOut();
        router.push("/auth/login");
    };

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6 md:px-8">
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

                    {/* Breadcrumb dinâmico + Data */}
                    <div className="flex flex-col min-w-0">
                        <HeaderBreadcrumb />
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
