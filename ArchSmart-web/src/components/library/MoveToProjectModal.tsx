"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAmbientesDoProjeto, useMoveToProject, useProjetosParaMover } from "@/features/library/hooks"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function MoveToProjectModal({
    isOpen,
    onOpenChange,
    product
}: {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    product: { id: string, name: string } | null
}) {
    const { toast } = useToast()

    const [selectedProjectId, setSelectedProjectId] = useState<string>("")
    const [selectedEnvId, setSelectedEnvId] = useState<string>("")
    const [ruleType, setRuleType] = useState<string>("UNIT")

    const { data: projects = [], isLoading: isLoadingProjects } = useProjetosParaMover(isOpen)
    const { data: environments = [], isLoading: isLoadingEnvs } = useAmbientesDoProjeto(
        selectedProjectId || undefined,
    )
    const moverParaProjetoMutation = useMoveToProject()
    const isSubmitting = moverParaProjetoMutation.isPending

    // O ambiente efetivo: o que o usuario escolheu, ou o primeiro da lista como
    // sugestao. Calculado no render, nao guardado em estado — um efeito que so
    // faz `setState` a partir de `environments` reexecuta a cada troca de
    // referencia do array (toda vez que a query refaz fetch) e "puxa de volta"
    // a escolha do usuario para o primeiro item sem ele ter pedido nada.
    const envIdEfetivo = selectedEnvId || environments[0]?.id || ""

    // Reseta a selecao quando o modal fecha.
    useEffect(() => {
        if (!isOpen) {
            setSelectedProjectId("")
            setSelectedEnvId("")
        }
    }, [isOpen])

    const handleProjectChange = (value: string) => {
        setSelectedProjectId(value)
        // O ambiente escolhido pertencia ao projeto anterior.
        setSelectedEnvId("")
    }

    const handleSubmit = async () => {
        if (!product || !selectedProjectId || !envIdEfetivo) return

        try {
            await moverParaProjetoMutation.mutateAsync({
                project_id: selectedProjectId,
                environment_id: envIdEfetivo,
                product_id: product.id,
                rule_type: ruleType,
            })

            toast({
                title: "Sucesso!",
                description: `${product.name} enviado para o orçamento do projeto.`,
            })
            onOpenChange(false)

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: error instanceof Error ? error.message : "Não foi possível vincular o produto.",
            })
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Enviar para Projeto</DialogTitle>
                    <DialogDescription>
                        Qual ambiente irá receber <strong>{product?.name}</strong>?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">1. Escolha o Projeto</label>
                        <Select value={selectedProjectId} onValueChange={handleProjectChange} disabled={isLoadingProjects}>
                            <SelectTrigger>
                                <SelectValue placeholder={isLoadingProjects ? "Carregando projetos..." : "Selecione um projeto"} />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">2. Escolha o Ambiente</label>
                        <Select value={envIdEfetivo} onValueChange={setSelectedEnvId} disabled={!selectedProjectId || isLoadingEnvs || environments.length === 0}>
                            <SelectTrigger>
                                <SelectValue placeholder={
                                    !selectedProjectId ? "Selecione o projeto primeiro" :
                                        isLoadingEnvs ? "Carregando..." :
                                            environments.length === 0 ? "Projeto sem ambientes" : "Selecione o ambiente"
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {environments.map(e => (
                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">3. Regra de Medição</label>
                        <Select value={ruleType} onValueChange={setRuleType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Regra de Medição" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="UNIT">Por Unidade (Ex: Móveis)</SelectItem>
                                <SelectItem value="FLOOR">Área do Piso (M²)</SelectItem>
                                <SelectItem value="WALL">Área das Paredes (M²)</SelectItem>
                                <SelectItem value="CEILING">Área do Teto (M²)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex gap-2 justify-end mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !selectedProjectId || !envIdEfetivo}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enviar Produto
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
