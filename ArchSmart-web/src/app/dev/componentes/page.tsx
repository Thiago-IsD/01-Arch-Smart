import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Galeria } from "./galeria"

export const metadata: Metadata = {
    title: "Componentes | Arq Smart",
    robots: { index: false, follow: false },
}

/**
 * Galeria de componentes. Nao existe em producao — e ferramenta de
 * desenvolvimento, e uma rota publica listando a interface inteira e superficie
 * que nao precisamos oferecer.
 */
export default function Page() {
    if (process.env.NODE_ENV === "production") notFound()
    return <Galeria />
}
