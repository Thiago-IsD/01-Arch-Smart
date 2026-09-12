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
    // `ProntidaoDaTelaProvider`, e o provider precisa embrulhar o `AppShell`
    // tambem, senao os `QueryBoundary` das telas ficam fora dele e nada
    // anuncia nem reporta.
    //
    // Sem o provider os eventos continuam saindo — `pagehide` e o desmonte nao
    // dependem do canal —, mas `anunciadas()` devolve 0 e `assinar` devolve
    // `undefined`, entao nenhuma regiao reporta e TODO evento sai
    // `medido_ate: "pintura"`. O risco nao e ficar sem dado: e ficar com dado
    // que mente, que e exatamente o que esta secao existe para consertar.
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
