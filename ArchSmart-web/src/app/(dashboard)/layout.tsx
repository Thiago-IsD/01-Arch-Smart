import { AppShell } from "@/components/layout/AppShell";
import { GlobalChatWidget } from "@/components/layout/GlobalChatWidget";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela";
import { ProntidaoDaTelaProvider } from "@/features/telemetry/contexto";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // A ordem importa duas vezes: `TelemetriaDeTela` precisa ficar dentro do
    // `ProntidaoDaTelaProvider` (senao `useProntidao` volta null, a telemetria
    // nao assina canal nenhum e NENHUM evento sai) e o provider precisa
    // embrulhar o `AppShell` tambem, senao os `QueryBoundary` das telas ficam
    // fora dele e nada anuncia nem reporta.
    //
    // `TelemetriaDeTela` aparece ANTES do `AppShell` de proposito: assim o
    // efeito dele roda antes do efeito de todo `QueryBoundary` da tela, e a
    // assinatura do canal existe quando a primeira regiao reporta.
    return (
        <QueryProvider>
            <ProntidaoDaTelaProvider>
                <TelemetriaDeTela />
                <AppShell>{children}</AppShell>
                <GlobalChatWidget />
            </ProntidaoDaTelaProvider>
        </QueryProvider>
    );
}
