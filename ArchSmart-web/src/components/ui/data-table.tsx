"use client"

import * as React from "react"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

/**
 * Tabela com ordenacao e paginacao embutidas.
 *
 * Existe para que nenhuma tela reimplemente "clicar no cabecalho ordena" de um
 * jeito diferente — e para que a ordenacao seja anunciada por `aria-sort`, e
 * nao so por uma seta que leitor de tela nao le.
 */
type Coluna<T> = { chave: keyof T & string; rotulo: string }

export function DataTable<T>({
    colunas,
    linhas,
    chaveDaLinha,
    porPagina = 20,
}: {
    colunas: ReadonlyArray<Coluna<T>>
    linhas: ReadonlyArray<T>
    chaveDaLinha: (linha: T) => string
    porPagina?: number
}) {
    const [ordem, setOrdem] = React.useState<{ chave: keyof T & string; asc: boolean } | null>(null)
    const [pagina, setPagina] = React.useState(0)

    // Filtrar para uma lista menor deixava o usuario FORA do intervalo:
    // "Pagina 3 de 1", tabela vazia, e nenhuma pista do que aconteceu. O
    // indice de pagina e estado desta tabela; a lista e da tela — quando a
    // lista troca, o indice antigo nao quer dizer mais nada.
    //
    // A troca e detectada pelo CONTEUDO (as chaves das linhas), nao pela
    // identidade do array: a tela quase sempre passa `linhas` de um `.filter()`
    // inline, que e um array novo a cada render — comparar identidade zeraria a
    // pagina toda vez e deixaria o botao "Proxima" sem efeito, que e um defeito
    // pior que o que se esta consertando.
    const assinatura = JSON.stringify(linhas.map(chaveDaLinha))
    const [assinaturaAnterior, setAssinaturaAnterior] = React.useState(assinatura)
    if (assinatura !== assinaturaAnterior) {
        setAssinaturaAnterior(assinatura)
        setPagina(0)
    }

    const ordenadas = React.useMemo(() => {
        if (!ordem) return [...linhas]
        return [...linhas].sort((a, b) => {
            const x = a[ordem.chave]
            const y = b[ordem.chave]
            if (x === y) return 0
            return (x > y ? 1 : -1) * (ordem.asc ? 1 : -1)
        })
    }, [linhas, ordem])

    const totalDePaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina))
    const visiveis = ordenadas.slice(pagina * porPagina, (pagina + 1) * porPagina)

    return (
        <div className="flex flex-col gap-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        {colunas.map((coluna) => (
                            <TableHead
                                key={coluna.chave}
                                aria-sort={
                                    ordem?.chave === coluna.chave
                                        ? ordem.asc
                                            ? "ascending"
                                            : "descending"
                                        : "none"
                                }
                            >
                                <button
                                    type="button"
                                    className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                                    onClick={() => {
                                        // Reordenar muda o que esta no topo;
                                        // ficar na pagina 3 do criterio antigo
                                        // nao quer dizer nada.
                                        setPagina(0)
                                        setOrdem((atual) =>
                                            atual?.chave === coluna.chave
                                                ? { chave: coluna.chave, asc: !atual.asc }
                                                : { chave: coluna.chave, asc: true },
                                        )
                                    }}
                                >
                                    {coluna.rotulo}
                                </button>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visiveis.map((linha) => (
                        <TableRow key={chaveDaLinha(linha)}>
                            {colunas.map((coluna) => (
                                <TableCell key={coluna.chave}>{String(linha[coluna.chave])}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                <span>
                    Página {pagina + 1} de {totalDePaginas}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => p - 1)}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina + 1 >= totalDePaginas}
                    onClick={() => setPagina((p) => p + 1)}
                >
                    Próxima
                </Button>
            </div>
        </div>
    )
}
