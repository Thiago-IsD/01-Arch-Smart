"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

const FORMATADOR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// O Intl desta ICU separa "R$" do numero com espaco duro (U+00A0), nao com o
// espaco comum que qualquer teste ou copy digitada usaria — normaliza aqui.
function formatar(centavos: number) {
    return FORMATADOR.format(centavos / 100).replace(/ /g, " ")
}

/**
 * Entrada de dinheiro em centavos inteiros.
 *
 * `value` e `onChange` falam centavos, nunca reais em float: 0,1 + 0,2 nao da
 * 0,3 em ponto flutuante, e orcamento e a Acao de Valor do produto. A tela
 * nunca precisa saber formatar moeda — a decisao mora aqui.
 */
type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: number
    onChange: (centavos: number) => void
}

export function CurrencyInput({ value, onChange, ...resto }: Props) {
    const [texto, setTexto] = React.useState(() => formatar(value))

    React.useEffect(() => {
        setTexto(formatar(value))
    }, [value])

    return (
        <Input
            {...resto}
            inputMode="numeric"
            value={texto}
            onChange={(evento) => {
                const digitos = evento.target.value.replace(/\D/g, "")
                const centavos = digitos === "" ? 0 : Number.parseInt(digitos, 10)
                setTexto(formatar(centavos))
                onChange(centavos)
            }}
        />
    )
}
