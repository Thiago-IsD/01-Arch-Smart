"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronsRight } from "lucide-react";

import { BRAND_ASSETS } from "@/config/brand";
import { NAV_ITEMS } from "@/config/navigation";

/** Barra lateral do desktop: marca, NAV_ITEMS e o botao de recolher. */
export function Sidebar() {
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
                            alt="Arq Smart"
                            fill
                            className="object-contain"
                        />
                    </div>
                    {open && (
                        <div className="transition-opacity duration-200">
                            <span className="block text-sm font-semibold text-foreground">
                                Arq Smart
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
