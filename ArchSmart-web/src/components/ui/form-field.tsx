import { cloneElement, isValidElement, type ReactElement } from "react"

import { Label } from "@/components/ui/label"

/**
 * Campo de formulario com as decisoes de produto embutidas: rotulo ligado por
 * `htmlFor` (com o `id` injetado no campo, para o chamador nao repeti-lo), erro
 * inline anunciado por `aria-describedby`, e `data-private` quando o dado e
 * sensivel (para telemetria e session replay nunca capturarem).
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
              // O `id` tambem e injetado: sem isto o chamador tinha que
              // repeti-lo no filho, e esquecer produzia rotulo ORFAO em
              // silencio — no componente que existe exatamente para ligar
              // rotulo e campo. Um `id` que o chamador tenha passado ganha:
              // ele pode estar ligado a outra coisa (aria-controls, form
              // externo), e ai a divergencia com o `htmlFor` fica visivel em
              // vez de ser "consertada" por baixo.
              id: children.props.id ?? id,
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
