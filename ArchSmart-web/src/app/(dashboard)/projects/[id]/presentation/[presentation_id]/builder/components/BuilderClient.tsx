"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Link as LinkIcon, Upload, Loader2, Image as ImageIcon, Trash2, Building2, MessageSquare, Lock, AlertTriangle } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EnvironmentAccordion, type PresentationEnvDetail } from "./EnvironmentAccordion";
import { PresenterBudgetTable, type BudgetDataInfo } from "@/components/budget/PresenterBudgetTable";
import { PresentationCommentsDrawer } from "./PresentationCommentsDrawer";

// ==================== TYPES ====================

interface Presentation {
    id: string;
    name: string;
    description: string | null;
    status: string;
    branding_snapshot: any;
    environments: PresentationEnvDetail[];
    has_access_password?: boolean;
    project?: {
        id: string;
        name: string;
    };
}

// ==================== HELPERS ====================

async function getToken(): Promise<string> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
}

// ==================== MAIN BUILDER ====================

export function BuilderClient({
    projectId,
    presentationId,
    initialData,
    initialBudgetData,
}: {
    projectId: string;
    presentationId: string;
    initialData: Presentation;
    initialBudgetData: BudgetDataInfo | null;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [data, setData] = useState<Presentation>(initialData);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState(initialData.name || "");
    const [description, setDescription] = useState(initialData.description || "");

    // ---- Acesso do cliente (senha do portal) ----
    const [accessPassword, setAccessPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [hasPassword, setHasPassword] = useState(!!initialData.has_access_password);

    const saveAccessPassword = async () => {
        const pw = accessPassword.trim();
        if (!pw) return;
        setIsSavingPassword(true);
        try {
            const token = await getToken();
            const res = await fetch(apiUrl(`/api/presentations/${presentationId}/access-password`), {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ password: pw }),
            });
            if (!res.ok) throw new Error();
            const result = await res.json();
            setHasPassword(!!result.has_access_password);
            setAccessPassword("");
            toast({ title: "Senha salva", description: "Seu cliente vai precisar dela para abrir a apresentação." });
        } catch {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a senha." });
        } finally {
            setIsSavingPassword(false);
        }
    };

    // ---- Environments state (for accordion) ----
    const [environments, setEnvironments] = useState<PresentationEnvDetail[]>(
        initialData.environments || []
    );

    const handleEnvironmentUpdate = (envId: string, updates: Partial<PresentationEnvDetail>) => {
        setEnvironments(prev =>
            prev.map(e => e.id === envId ? { ...e, ...updates } : e)
        );
    };

    // ---- Save cover config ----
    const saveConfig = async (updates?: Partial<{ name: string; description: string; status: string }>) => {
        setIsSaving(true);
        try {
            const token = await getToken();
            const payload = {
                name: updates?.name !== undefined ? updates.name : name,
                description: updates?.description !== undefined ? updates.description : description,
                status: updates?.status || data.status,
                environments: environments.map(env => ({ id: env.id, is_visible: env.is_visible })),
            };

            const res = await fetch(apiUrl(`/api/presentations/${presentationId}/config`), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const updatedData = await res.json();
                setData(updatedData);
                if (updates?.status === "PUBLISHED") {
                    toast({ title: "Publicado!", description: "Apresentação salva e publicada com sucesso." });
                }
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Erro ao salvar configuração." });
            }
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Erro de conexão ao salvar." });
        } finally {
            setIsSaving(false);
        }
    };

    // ---- Upload cover image ----
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = await getToken();
            const res = await fetch(apiUrl(`/api/presentations/${presentationId}/assets`), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (res.ok) {
                const updatedData = await res.json();
                setData(updatedData);
                toast({ title: "Imagem Atualizada", description: "Capa alterada com sucesso." });
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Erro ao enviar imagem de capa." });
            }
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Erro de conexão ao enviar arquivo." });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async () => {
        setIsSaving(true);
        setIsDeleteDialogOpen(false);
        try {
            const token = await getToken();
            const res = await fetch(apiUrl(`/api/presentations/${presentationId}`), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                toast({ title: "Apresentação excluída", description: "A apresentação foi removida com sucesso." });
                router.push(`/projects/${projectId}/presentation`);
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Erro ao excluir apresentação." });
            }
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Erro de conexão ao excluir." });
        } finally {
            setIsSaving(false);
        }
    };

    const coverUrl = data.branding_snapshot?.cover_url;
    const visibleEnvironments = environments.filter(e => e.is_visible);
    const visibleEnvironmentIds = visibleEnvironments.map(e => e.environment?.id || e.id);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground absolute inset-0 z-[100]">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card shadow-sm z-10 w-full">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push(`/projects/${projectId}/presentation`)}
                        className="flex items-center justify-center p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="h-8 w-px bg-border mx-1 hidden sm:block" />

                    <div className="flex items-center gap-3">
                        {data.branding_snapshot?.logo_url ? (
                            <img
                                src={data.branding_snapshot.logo_url}
                                alt={data.branding_snapshot.office_name || "Logo"}
                                className="h-8 w-auto object-contain"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-white" />
                            </div>
                        )}
                        <div className="hidden sm:block">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
                                {data.branding_snapshot?.office_name || "Escritório"}
                            </p>
                            <h1 className="text-sm font-bold text-foreground leading-none flex items-center gap-2">
                                {name || "Apresentação sem nome"}
                                <span className={`px-1.5 py-0.5 text-[9px] uppercase font-black rounded-sm
                                    ${data.status === "DRAFT" ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                                    {data.status === "PUBLISHED" ? "PUBL" : "RASC"}
                                </span>
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <button
                                disabled={isSaving}
                                className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                                title="Excluir apresentação"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="z-[200]">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Tem certeza que deseja excluir apresentação?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <Button
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Excluir Apresentação
                                </Button>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <button
                        className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 transition-colors"
                        onClick={() => setIsCommentsDrawerOpen(true)}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Ver Feedbacks
                    </button>

                    <button
                        className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-muted border border-border"
                        onClick={() => {
                            const publicUrl = `${window.location.origin}/portal/${presentationId}`;
                            navigator.clipboard.writeText(publicUrl);
                            toast({ title: "Link Copiado", description: "O link foi copiado para a área de transferência!" });
                        }}
                    >
                        <LinkIcon className="w-4 h-4" />
                        Copiar Link
                    </button>

                    <button
                        disabled={isSaving}
                        className="text-sm font-medium text-primary-foreground flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary hover:bg-primary/90 transition-all disabled:opacity-50"
                        onClick={() => saveConfig({ status: "PUBLISHED" })}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Salvar e Publicar
                    </button>
                </div>
            </header>

            {/* Main Split */}
            <div className="flex flex-1 overflow-hidden w-full">

                {/* Painel Esquerdo: Configurações */}
                <aside className="w-[380px] flex-shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-y-auto">
                    <div className="p-6 space-y-8">

                        {/* Informações Básicas */}
                        <section>
                            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-4">Informações Básicas</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Nome da Apresentação</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        onBlur={() => saveConfig({ name })}
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        onBlur={() => saveConfig({ description })}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Imagem de Capa */}
                        <section>
                            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-4">Aparência da Capa</h2>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                            {coverUrl ? (
                                <div className="relative group rounded-lg overflow-hidden border border-border">
                                    <img src={coverUrl} alt="Capa" className="w-full h-32 object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="bg-background text-foreground px-3 py-1.5 rounded-md text-xs font-medium shadow-sm"
                                        >
                                            Trocar Imagem
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="w-full h-32 border-2 border-dashed border-input rounded-lg flex flex-col items-center justify-center hover:bg-muted hover:border-muted-foreground/50 transition-all text-muted-foreground disabled:opacity-50"
                                >
                                    {isUploading ? <Loader2 className="w-6 h-6 animate-spin mb-2" /> : <Upload className="w-6 h-6 mb-2" />}
                                    <span className="text-sm font-medium">{isUploading ? "Enviando..." : "Fazer upload da Capa"}</span>
                                </button>
                            )}
                        </section>

                        {/* Ambientes com Accordion */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Ambientes</h2>
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                                    {visibleEnvironments.length}/{environments.length} visíveis
                                </span>
                            </div>
                            <EnvironmentAccordion
                                presentationId={presentationId}
                                environments={environments}
                                onEnvironmentUpdate={handleEnvironmentUpdate}
                            />
                        </section>

                        {/* Acesso do Cliente */}
                        <section>
                            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-4">Acesso do Cliente</h2>

                            {hasPassword ? (
                                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 mb-3">
                                    <Lock className="w-4 h-4 shrink-0" />
                                    <span>Protegida por senha</span>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 mb-3">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>Sem senha — o cliente ainda não consegue abrir. Defina uma senha abaixo.</span>
                                </div>
                            )}

                            <label className="block text-sm font-medium text-foreground mb-1">
                                {hasPassword ? "Trocar senha" : "Definir senha"}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={accessPassword}
                                    onChange={e => setAccessPassword(e.target.value)}
                                    placeholder="Senha para o cliente"
                                    className="flex-1 min-w-0 px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-sm placeholder:text-muted-foreground"
                                />
                                <Button onClick={saveAccessPassword} disabled={isSavingPassword || !accessPassword.trim()} size="sm">
                                    {isSavingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Compartilhe o link e a senha com o cliente. Ele digita apenas uma vez por dispositivo.
                            </p>
                        </section>

                    </div>
                </aside>

                {/* Painel Direito: Live Preview */}
                <main className="flex-1 bg-muted p-8 overflow-y-auto relative hidden md:block">
                    {/* O preview abaixo é o documento branco que o cliente vê no portal —
                        mantido claro de propósito (WYSIWYG), independente do tema. */}
                    <div className="max-w-4xl mx-auto">

                        {/* Header do Preview */}
                        <div className="bg-white rounded-t-xl p-4 border-b border-gray-100 flex items-center justify-between shadow-sm">
                            <div className="font-bold tracking-tight text-primary">ARCH SMART</div>
                            <div className="text-sm text-gray-500">Visualização do Cliente</div>
                        </div>

                        {/* Corpo */}
                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden flex flex-col">

                            {/* Hero Section */}
                            <div className="h-64 md:h-80 w-full relative bg-gray-900 flex items-center justify-center">
                                {coverUrl ? (
                                    <>
                                        <img src={coverUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-col text-gray-500">
                                        <ImageIcon className="w-12 h-12 opacity-20 mb-2" />
                                        <span className="text-sm uppercase tracking-widest opacity-50 font-bold">Sem imagem de capa</span>
                                    </div>
                                )}
                                <div className="relative z-10 text-center px-6 mt-16">
                                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-md">{name || "Título da Apresentação"}</h1>
                                    {description && <p className="text-lg text-gray-200 max-w-2xl mx-auto drop-shadow">{description}</p>}
                                </div>
                            </div>

                            {/* Loop de Ambientes Visíveis */}
                            <div className="bg-gray-50">
                                {visibleEnvironments.length === 0 ? (
                                    <div className="text-center py-16 px-8">
                                        <p className="text-gray-500">Nenhum ambiente marcado como visível.</p>
                                        <p className="text-sm text-gray-400 mt-1">Ative os ambientes na barra lateral.</p>
                                    </div>
                                ) : (
                                    visibleEnvironments.map((env, idx) => (
                                        <div key={env.id} className={`py-10 px-8 md:px-12 ${idx > 0 ? "border-t border-gray-200" : ""}`}>
                                            {/* Texts */}
                                            <div className="mb-6">
                                                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                                                    {env.environment?.name || "Ambiente"}
                                                </p>
                                                <h2 className="text-2xl font-bold text-gray-900">
                                                    {env.title || env.environment?.name || "Ambiente"}
                                                </h2>
                                                {env.subtitle && (
                                                    <p className="text-base text-gray-500 mt-1 italic">{env.subtitle}</p>
                                                )}
                                                {env.description && (
                                                    <p className="text-sm text-gray-600 mt-3 leading-relaxed max-w-2xl">{env.description}</p>
                                                )}
                                            </div>

                                            {/* Images Grid */}
                                            {(env.image_urls || []).length > 0 ? (
                                                <div className={`grid gap-3 
                                                    ${(env.image_urls || []).length === 1 ? "grid-cols-1" : ""}
                                                    ${(env.image_urls || []).length === 2 ? "grid-cols-2" : ""}
                                                    ${(env.image_urls || []).length === 3 ? "grid-cols-3" : ""}
                                                    ${(env.image_urls || []).length === 4 ? "grid-cols-2 md:grid-cols-4" : ""}
                                                `}>
                                                    {(env.image_urls || []).map((url, imgIdx) => (
                                                        <div key={imgIdx} className="rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="h-40 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                                                    <ImageIcon className="w-8 h-8 opacity-50" />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Tabela de Orçamento */}
                            <PresenterBudgetTable
                                budgetData={initialBudgetData}
                                visibleEnvironments={visibleEnvironments}
                            />

                        </div>
                    </div>
                </main>
            </div>

            <PresentationCommentsDrawer
                presentationId={presentationId}
                isOpen={isCommentsDrawerOpen}
                onOpenChange={setIsCommentsDrawerOpen}
                onStatusChange={(s) => setData({ ...data, status: s })}
            />
        </div>
    );
}
