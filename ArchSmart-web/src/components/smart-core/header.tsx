'use client';

import Image from "next/image";
import { BRAND_ASSETS } from "@/config/brand";
import { Button } from "@/components/ui/button";

export function Header() {
    return (
        <header className="w-full border-b bg-background px-6 py-4">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                {/* LOGO USAGE */}
                <div className="flex items-center gap-2">
                    <Image
                        src={BRAND_ASSETS.horizontal}
                        alt="Arch Smart Logo"
                        width={150}
                        height={40}
                        className="h-10 w-auto object-contain"
                        priority
                        unoptimized // Supabase storage images usually work better with unoptimized if domain not allowed in next.config
                    />
                </div>

                <nav className="flex items-center gap-4">
                    {/* Navigation Items */}
                    <Button variant="ghost">Entrar</Button>
                    <Button>Teste Grátis</Button>
                </nav>
            </div>
        </header>
    );
}
