import { cloneElement, isValidElement, type ReactElement } from "react"

import { Label } from "@/components/ui/label"

/**
 * Campo de formulario com as decisoes de produto embutidas: rotulo ligado por
 * `htmlFor`, erro inline anunciado por `aria-describedby`, e `data-private`
 * quando o dado e sensivel (para telemetria e session replay nunca capturarem).
 *
 * `sensivel` existe aqui, e nao na tela, porque "este campo e sensivel" e
 * decisao de produto — deixa-la na tela e como ela some.
 */
export function FormField({
    id,
    rotulo,
    erro,
    sensivel = false,
    children,
}: {
    id: string
    rotulo: string
    erro?: string
    sensivel?: boolean
    children: ReactElement
}) {
    const idDoErro = `${id}-erro`
    const campo = isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, {
              "aria-invalid": erro ? true : undefined,
              "aria-describedby": erro ? idDoErro : undefined,
          })
        : children

    return (
        <div className="flex flex-col gap-2" data-private={sensivel ? "true" : undefined}>
            <Label htmlFor={id}>{rotulo}</Label>
            {campo}
            {erro ? (
                <p id={idDoErro} className="text-sm text-destructive">
                    {erro}
                </p>
            ) : null}
        </div>
    )
}
