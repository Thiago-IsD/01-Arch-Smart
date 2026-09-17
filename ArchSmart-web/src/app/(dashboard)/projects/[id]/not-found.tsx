import Link from "next/link"
import { FolderX } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * No App Router, este arquivo e o boundary de `notFound()` para o segmento
 * `projects/[id]` E para todo descendente que nao tenha o seu proprio
 * `not-found.tsx` — nao so para o `notFound()` de `ProjetoData.tsx`. Por
 * estar dentro do grupo `(dashboard)`, o shell (barra lateral e cabecalho)
 * continua renderizado — diferente do 404 embutido do Next, que substituiria
 * o shell inteiro.
 *
 * Hoje sao 6 chamadas de `notFound()` sob `projects/[id]/`, em 5 arquivos —
 * 5 casos, porque o construtor de apresentacao chama duas vezes (sem token de
 * sessao, e sem apresentacao):
 *
 *   grep -rn "notFound()" "src/app/(dashboard)/projects/[id]" --include=*.tsx
 *
 * detalhe (`components/ProjetoData.tsx`), apresentacao
 * (`presentation/page.tsx`), orcamento (`budget/page.tsx`, quando o orcamento
 * ainda nao existe — o projeto continua vivo), impressao (`print/page.tsx`) e
 * o construtor de apresentacao (`presentation/[presentation_id]/builder/page.tsx`).
 * Por isso a copy abaixo e generica: uma frase que so fizesse sentido para
 * "projeto excluido" mentiria nos outros quatro casos.
 *
 * A frase tambem nao afirma qual motivo e o real: o backend responde 404
 * tanto para "nao existe" quanto para "existe, mas nao pertence a esta
 * conta" (`ScopedRepository.obter`, nunca 403), de proposito — confirmar a
 * segunda hipotese para quem pergunta seria vazar a existencia do recurso de
 * outra conta.
 */
export default function ProjetoNaoEncontrado() {
    return (
        <div
            data-testid="projeto-nao-encontrado"
            className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center"
        >
            <FolderX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">Não encontrado</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
                Isto pode não existir, ainda não ter sido criado, ou não pertencer a esta conta.
            </p>
            <Button variant="outline" asChild>
                <Link href="/projects">Voltar para Projetos</Link>
            </Button>
        </div>
    )
}
