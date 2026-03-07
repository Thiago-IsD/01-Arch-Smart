import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Apresentação | Arch Smart",
    description: "Visualização interativa da sua apresentação de projeto.",
}

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Layout isolado — sem AppShell, sidebar ou cabeçalho do sistema
    // html/body são gerenciados pelo root layout do Next.js
    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            {children}
        </div>
    )
}
