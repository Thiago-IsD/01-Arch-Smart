"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

const FORMATADOR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/**
 * Entrada de dinheiro em centavos inteiros.
 *
 * `value` e `onChange` falam centavos, nunca reais em float: 0,1 + 0,2 nao da
 * 0,3 em ponto flutuante, e orcamento e a Acao de Valor do produto. A tela
 * nunca precisa saber formatar moeda — a decisao mora aqui.
 *
 * O `Intl` separa "R$" do numero com espaco NAO separavel (U+00A0), nao com
 * espaco comum — e isso e o formato correto em pt-BR, nao um defeito: evita
 * que o simbolo e o valor quebrem em linhas diferentes. `dashboard/page.tsx`
 * ja exibe esse mesmo caractere hoje via `toLocaleString`; normalizar aqui
 * criaria uma divergencia tipografica nova dentro do proprio produto. O
 * `Intl` e a fonte de verdade — nao mexe no que ele emite.
 */
type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: number
    onChange: (centavos: number) => void
}

export function CurrencyInput({ value, onChange, ...resto }: Props) {
    const [texto, setTexto] = React.useState(() => FORMATADOR.format(value / 100))
    const primeiraRenderizacao = React.useRef(true)

    React.useEffect(() => {
        // O useState acima ja formata `value` no mount; sem este guard o
        // efeito formataria de novo, a toa, na primeira renderizacao.
        if (primeiraRenderizacao.current) {
            primeiraRenderizacao.current = false
            return
        }
        setTexto(FORMATADOR.format(value / 100))
    }, [value])

    return (
        <Input
            {...resto}
            inputMode="numeric"
            value={texto}
            onChange={(evento) => {
                const digitos = evento.target.value.replace(/\D/g, "")
                const centavos = digitos === "" ? 0 : Number.parseInt(digitos, 10)
                setTexto(FORMATADOR.format(centavos / 100))
                onChange(centavos)
            }}
        />
    )
}
