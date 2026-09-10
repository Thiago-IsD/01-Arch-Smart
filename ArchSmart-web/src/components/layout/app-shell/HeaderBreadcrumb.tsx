"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useBreadcrumb } from "@/contexts/BreadcrumbContext";

// Rótulos legíveis para os segmentos de rota conhecidos.
const SEGMENT_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    library: "Biblioteca",
    projects: "Projetos",
    presentations: "Apresentações",
    presentation: "Apresentação",
    builder: "Editor",
    finance: "Financeiro",
    calendar: "Agenda",
    environments: "Ambientes",
    budget: "Orçamento",
    print: "Caderno de Obra",
    profile: "Meu Perfil",
    settings: "Configurações",
    billing: "Faturamento",
    new: "Novo",
};

const UUID_OR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^\d+$/i;

export function HeaderBreadcrumb() {
    const pathname = usePathname();
    const { customLabels } = useBreadcrumb();

    const segments = pathname.split("/").filter(Boolean);

    const resolveLabel = (segment: string): string => {
        if (customLabels[segment]) return customLabels[segment];
        if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
        if (UUID_OR_ID.test(segment)) return "Detalhes";
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    };

    const crumbs = segments.map((segment, index) => ({
        label: resolveLabel(segment),
        href: "/" + segments.slice(0, index + 1).join("/"),
        isLast: index === segments.length - 1,
    }));

    if (crumbs.length === 0) {
        return (
            <span className="font-semibold text-foreground text-sm leading-tight">
                Bem-vindo à Arq Smart
            </span>
        );
    }

    return (
        <nav aria-label="Navegação estrutural" className="min-w-0">
            <ol className="flex items-center gap-1 text-sm leading-tight overflow-hidden">
                {crumbs.map((crumb) => (
                    <li key={crumb.href} className="flex items-center gap-1 min-w-0">
                        {crumb.isLast ? (
                            <span
                                className="font-semibold text-foreground truncate"
                                aria-current="page"
                            >
                                {crumb.label}
                            </span>
                        ) : (
                            <>
                                <Link
                                    href={crumb.href}
                                    className="text-muted-foreground hover:text-foreground transition-colors truncate"
                                >
                                    {crumb.label}
                                </Link>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                            </>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
