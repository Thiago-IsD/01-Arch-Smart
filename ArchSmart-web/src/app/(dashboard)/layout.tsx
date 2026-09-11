import { AppShell } from "@/components/layout/AppShell";
import { GlobalChatWidget } from "@/components/layout/GlobalChatWidget";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela";
import { VazioDaTelaProvider } from "@/features/telemetry/contexto";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // A ordem importa duas vezes: `TelemetriaDeTela` precisa ficar dentro do
    // `QueryProvider` (senao `useQueryClient` estoura) e dentro do
    // `VazioDaTelaProvider` (senao `useVazioDaTela` volta null e o `is_empty`
    // e sempre nulo). E o `VazioDaTelaProvider` embrulha o `AppShell` tambem,
    // senao os `QueryBoundary` das telas ficam fora dele e nada reporta vazio.
    return (
        <QueryProvider>
            <VazioDaTelaProvider>
                <TelemetriaDeTela />
                <AppShell>{children}</AppShell>
                <GlobalChatWidget />
            </VazioDaTelaProvider>
        </QueryProvider>
    );
}
