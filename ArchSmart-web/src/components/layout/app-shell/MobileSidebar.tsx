"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { BRAND_ASSETS } from "@/config/brand";
import { NAV_ITEMS } from "@/config/navigation";

/** Mesma navegacao da Sidebar, dentro do Sheet do mobile. */
export function MobileSidebar({ onNavigate }: { onNavigate: () => void }) {
    const pathname = usePathname();

    return (
        <nav className="h-full bg-card p-2">
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
                    <div>
                        <span className="block text-sm font-semibold text-foreground">
                            Arq Smart
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
