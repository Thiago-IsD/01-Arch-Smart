/** Formata em BRL. Movido de dashboard/page.tsx na quebra da Tarefa 9. */
export const formatCurrency = (val: number) => {
        return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    }
