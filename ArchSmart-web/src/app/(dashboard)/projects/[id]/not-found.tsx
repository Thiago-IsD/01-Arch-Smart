import Link from "next/link"
import { FolderX } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * `notFound()` de `ProjetoData.tsx` cai aqui. Por estar dentro do grupo
 * `(dashboard)`, o shell (barra lateral e cabecalho) continua renderizado —
 * diferente do 404 embutido do Next, que substituiria o shell inteiro.
 *
 * A frase nao afirma qual dos dois motivos e o real: o backend responde 404
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
            <h1 className="text-xl font-semibold text-foreground">Projeto não encontrado</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
                Ele pode ter sido excluído ou não pertencer a esta conta.
            </p>
            <Button variant="outline" asChild>
                <Link href="/projects">Voltar para Projetos</Link>
            </Button>
        </div>
    )
}
