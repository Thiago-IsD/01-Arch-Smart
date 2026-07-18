"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Project {
    id: string;
    name: string;
}

interface CreatePresentationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    defaultProjectId?: string;
    onSuccess?: (presentationId: string, projectId: string) => void;
}

export function CreatePresentationDialog({
    isOpen,
    onClose,
    defaultProjectId,
    onSuccess,
}: CreatePresentationDialogProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [projectId, setProjectId] = useState(defaultProjectId || "");
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(false);

    useEffect(() => {
        if (isOpen && !defaultProjectId) {
            async function loadProjects() {
                setLoadingProjects(true);
                try {
                    const supabase = createClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token || "";

                    // Utilizando o endpoint de listagem de projetos
                    const res = await fetch(apiUrl("/api/projects?page=1&size=100"), {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setProjects(data.items || data);
                    }
                } catch (error) {
                    console.error("Erro ao carregar projetos:", error);
                } finally {
                    setLoadingProjects(false);
                }
            }
            loadProjects();
        }
    }, [isOpen, defaultProjectId]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name || (!projectId && !defaultProjectId)) return;

        setLoading(true);
        const finalProjectId = defaultProjectId || projectId;
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || "";

            const response = await fetch(
                apiUrl(`/api/projects/${finalProjectId}/presentations`),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        project_id: finalProjectId,
                        name,
                        description,
                    }),
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (onSuccess) {
                    onSuccess(data.id, finalProjectId);
                }
                toast({ title: "Sucesso!", description: "Apresentação criada com sucesso." });
                router.push(`/projects/${finalProjectId}/presentation/${data.id}/builder`);
                onClose();
                setName("");
                setDescription("");
            } else {
                const err = await response.json();
                toast({ variant: "destructive", title: "Erro", description: err.detail || "Não foi possível criar a apresentação." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Ops!", description: "Erro de conexão ao criar apresentação." });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card rounded-xl shadow-lg w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-semibold text-foreground">
                        Nova Apresentação
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {!defaultProjectId && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Projeto *
                            </label>
                            <select
                                required
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                disabled={loadingProjects}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm bg-background text-foreground"
                            >
                                <option value="" disabled>
                                    {loadingProjects ? "Carregando..." : "Selecione um projeto"}
                                </option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Nome da Apresentação *
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Apresentação Final - Apartamento 302"
                            className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm bg-background text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Descrição (Opcional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Uma breve descrição sobre a apresentação"
                            rows={3}
                            className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm resize-none bg-background text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-input rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            Criar Apresentação
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
