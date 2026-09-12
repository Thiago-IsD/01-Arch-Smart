"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import type { FiltrosDeProduto } from "@/lib/query/keys"

/**
 * O vazio da Biblioteca.
 *
 * A copy e a acao sao as mesmas que estavam inline no `LibraryContent` antes da
 * Secao 8, palavra por palavra: paridade e o primeiro item da definicao de
 * pronto desta tarefa. O que mudou e QUEM decide mostrar isto — antes era um
 * `length > 0` na tela, agora e o `QueryBoundary`, que sabe distinguir "voltou
 * sem itens" de "a requisicao falhou".
 *
 * O `col-span-full` saiu junto com a grade: este bloco nao mora mais DENTRO do
 * grid (o boundary troca um pelo outro), e uma coluna inteira de um grid que
 * nao existe nao centraliza nada.
 */
export function BibliotecaVazia({ filtros }: { filtros: FiltrosDeProduto }) {
    const temFiltroAtivo =
        !!filtros.q ||
        (filtros.categories?.length ?? 0) > 0 ||
        (filtros.origins?.length ?? 0) > 0

    return (
        <div
            data-testid="library-empty"
            className="flex flex-col items-center justify-center py-10 text-muted-foreground"
        >
            <p>Nenhum produto encontrado com os filtros selecionados.</p>
            {temFiltroAtivo && (
                // `Link`, nao `<a>`: com a ancora crua isto era recarga dura da
                // rota inteira — perde o cache do React Query, o estado do
                // cliente e a hidratacao que a Secao 5 pagou para existir. Era
                // paridade verbatim com o codigo anterior, entao nao era
                // regressao; mas este arquivo e o que as outras oito telas
                // copiam como "o estado vazio".
                <Button variant="link" className="mt-2" asChild>
                    <Link href="/library">Limpar filtros</Link>
                </Button>
            )}
        </div>
    )
}
