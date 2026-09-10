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
                                    onClick={() =>
                                        setOrdem((atual) =>
                                            atual?.chave === coluna.chave
                                                ? { chave: coluna.chave, asc: !atual.asc }
                                                : { chave: coluna.chave, asc: true },
                                        )
                                    }
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
                    Pagina {pagina + 1} de {totalDePaginas}
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
                    Proxima
                </Button>
            </div>
        </div>
    )
}
