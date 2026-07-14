"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
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

    const [projects, setProjects] = useState<any[]>([])
    const [environments, setEnvironments] = useState<any[]>([])

    const [selectedProjectId, setSelectedProjectId] = useState<string>("")
    const [selectedEnvId, setSelectedEnvId] = useState<string>("")
    const [ruleType, setRuleType] = useState<string>("UNIT")

    const [isLoadingProjects, setIsLoadingProjects] = useState(false)
    const [isLoadingEnvs, setIsLoadingEnvs] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // 1. Fetch Projects on mount
    useEffect(() => {
        if (!isOpen) {
            setSelectedProjectId("")
            setSelectedEnvId("")
            return
        }

        const fetchProjects = async () => {
            setIsLoadingProjects(true)
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token || ""

                const res = await fetch(apiUrl("/api/projects"), {
                    headers: { "Authorization": `Bearer ${token}` }
                })

                if (res.ok) {
                    const data = await res.json()
                    setProjects(data.items || [])
                }
            } catch (e) {
                console.error("Failed to fetch projects", e)
            } finally {
                setIsLoadingProjects(false)
            }
        }
        fetchProjects()

    }, [isOpen])

    // 2. Fetch Environments when Project changes
    useEffect(() => {
        if (!selectedProjectId) {
            setEnvironments([])
            setSelectedEnvId("")
            return
        }

        const fetchEnvs = async () => {
            setIsLoadingEnvs(true)
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token || ""

                const res = await fetch(apiUrl(`/api/projects/${selectedProjectId}/environments`), {
                    headers: { "Authorization": `Bearer ${token}` }
                })

                if (res.ok) {
                    const data = await res.json()
                    setEnvironments(data)
                    // Auto-select first environment if available
                    if (data.length > 0) setSelectedEnvId(data[0].id)
                    else setSelectedEnvId("")
                }
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoadingEnvs(false)
            }
        }
        fetchEnvs()
    }, [selectedProjectId])

    const handleSubmit = async () => {
        if (!product || !selectedProjectId || !selectedEnvId) return

        setIsSubmitting(true)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""
            const payload = {
                project_id: selectedProjectId,
                environment_id: selectedEnvId,
                product_id: product.id,
                rule_type: ruleType
            }

            const res = await fetch(apiUrl("/api/budgets/items"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error("Failed to move to project")

            toast({
                title: "Sucesso!",
                description: `${product.name} enviado para o orçamento do projeto.`,
            })
            onOpenChange(false)

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível vincular o produto.",
            })
        } finally {
            setIsSubmitting(false)
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
                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={isLoadingProjects}>
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
                        <Select value={selectedEnvId} onValueChange={setSelectedEnvId} disabled={!selectedProjectId || isLoadingEnvs || environments.length === 0}>
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
                    <Button onClick={handleSubmit} disabled={isSubmitting || !selectedProjectId || !selectedEnvId}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enviar Produto
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
