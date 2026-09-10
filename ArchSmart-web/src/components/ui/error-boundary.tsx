"use client"

import * as React from "react"

/**
 * Fronteira de erro de render, com ponto de extensao para telemetria.
 *
 * O plugue nasce vazio DE PROPOSITO: telemetria e a Secao 7. Quando ela
 * chegar, chama `registrarReportadorDeErro` uma vez no shell e todo
 * ErrorBoundary da aplicacao passa a reportar — sem tocar em nenhuma tela.
 */
export type ReportadorDeErro = (erro: Error, info: React.ErrorInfo) => void

let reportar: ReportadorDeErro = () => {}

export function registrarReportadorDeErro(fn: ReportadorDeErro) {
    reportar = fn
}

type Props = {
    fallback: (erro: Error, tentarDeNovo: () => void) => React.ReactNode
    children: React.ReactNode
}

export class ErrorBoundary extends React.Component<Props, { erro: Error | null }> {
    state: { erro: Error | null } = { erro: null }

    static getDerivedStateFromError(erro: Error) {
        return { erro }
    }

    componentDidCatch(erro: Error, info: React.ErrorInfo) {
        reportar(erro, info)
    }

    render() {
        if (this.state.erro) {
            return this.props.fallback(this.state.erro, () => this.setState({ erro: null }))
        }
        return this.props.children
    }
}
