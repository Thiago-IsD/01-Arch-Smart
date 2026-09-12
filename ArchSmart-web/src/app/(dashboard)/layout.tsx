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
    // `TelemetriaDeTela` aparece ANTES do `AppShell`, e isso continua sendo o
    // certo — mas NAO e mais o que segura o mecanismo. O canal agora LATCHA o
    // ultimo report (`features/telemetry/contexto.tsx`) e o reproduz para quem
    // assinar depois, entao um report que chegue antes da assinatura nao se
    // perde mais. Antes disso, a ordem era o unico motivo de a assinatura
    // existir quando a primeira regiao reportava — "acidente de posicao e nao
    // garantia", nas palavras da spec.
    //
    // O motivo que sobra para a ordem: `TelemetriaDeTela` chama `limpar()` no
    // inicio do efeito dele, e `limpar()` zera o latch. Rodando primeiro, ele
    // limpa o resto da tela ANTERIOR antes de as regioes desta reportarem.
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
