import { cn } from "@/lib/utils";
import Image from "next/image";
import { BRAND_ASSETS } from "@/config/brand";
import Link from "next/link";

export default function Footer() {
    return (
        <footer className="w-full bg-muted/30 border-t border-border mt-auto">
            <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Logo & Slogan */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                    <Image
                        alt="Arch Smart"
                        className="h-8 w-auto object-contain"
                        src={BRAND_ASSETS.horizontal}
                        width={140}
                        height={40}
                        unoptimized
                    />
                    <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                        Feito para arquitetos. Transforme sua gestão com tecnologia e design.
                    </p>
                </div>

                {/* Navigation Links */}
                <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm text-foreground/80 font-medium">
                    <Link href="/produto" className="hover:text-primary hover:underline underline-offset-4 transition-all">Produto</Link>
                    <Link href="/web-clipper" className="hover:text-primary hover:underline underline-offset-4 transition-all">Web Clipper</Link>
                    <Link href="/precos" className="hover:text-primary hover:underline underline-offset-4 transition-all">Preços</Link>
                    <Link href="/sobre" className="hover:text-primary hover:underline underline-offset-4 transition-all">Sobre</Link>
                    <Link href="/beta" className="hover:text-primary hover:underline underline-offset-4 transition-all font-bold text-foreground">Beta</Link>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-border w-full">
                <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
                    <div>
                        Arch Smart © 2026. Todos os direitos reservados.
                    </div>
                    <div className="flex gap-6">
                        <Link href="/legal/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link>
                        <Link href="/legal/privacidade" className="hover:text-foreground transition-colors">Políticas de Privacidade</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};