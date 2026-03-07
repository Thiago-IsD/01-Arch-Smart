"use client";

import React, { useState, useRef, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PresentationEnvDetail {
    id: string;
    is_visible: boolean;
    title: string | null;
    subtitle: string | null;
    description: string | null;
    image_urls: string[];
    environment: { id: string; name: string } | null;
}

interface EnvironmentAccordionProps {
    presentationId: string;
    environments: PresentationEnvDetail[];
    onEnvironmentUpdate: (envId: string, updates: Partial<PresentationEnvDetail>) => void;
}

async function getToken(): Promise<string> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
}

function EnvAccordionItem({
    env,
    presentationId,
    onUpdate,
}: {
    env: PresentationEnvDetail;
    presentationId: string;
    onUpdate: (envId: string, updates: Partial<PresentationEnvDetail>) => void;
}) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState<number | null>(null); // index of uploading
    const [localTitle, setLocalTitle] = useState(env.title || "");
    const [localSubtitle, setLocalSubtitle] = useState(env.subtitle || "");
    const [localDescription, setLocalDescription] = useState(env.description || "");
    const [isDropOver, setIsDropOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const saveDetail = useCallback(
        async (field: string, value: string | boolean) => {
            setIsSaving(true);
            try {
                const token = await getToken();
                const res = await fetch(
                    apiUrl(`/api/presentations/${presentationId}/environments/${env.id}`),
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ [field]: value }),
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    onUpdate(env.id, { [field]: value });
                } else {
                    toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar." });
                }
            } catch {
                toast({ variant: "destructive", title: "Erro de conexão", description: "Tente novamente." });
            } finally {
                setIsSaving(false);
            }
        },
        [presentationId, env.id, onUpdate, toast]
    );

    const uploadImage = useCallback(
        async (file: File) => {
            if ((env.image_urls || []).length >= 4) {
                toast({ variant: "destructive", title: "Limite atingido", description: "Máximo de 4 imagens por ambiente." });
                return;
            }

            // Optimistic preview
            const localUrl = URL.createObjectURL(file);
            const tempUrls = [...(env.image_urls || []), localUrl];
            onUpdate(env.id, { image_urls: tempUrls });
            setIsUploading(tempUrls.length - 1);

            try {
                const token = await getToken();
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch(
                    apiUrl(`/api/presentations/${presentationId}/environments/${env.id}/images`),
                    {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    // Replace local blob with server URL
                    onUpdate(env.id, { image_urls: data.image_urls });
                    toast({ title: "Imagem adicionada!", description: "Foto enviada com sucesso." });
                } else {
                    // Revert
                    onUpdate(env.id, { image_urls: env.image_urls });
                    toast({ variant: "destructive", title: "Erro no upload", description: "Não foi possível enviar a imagem." });
                }
            } catch {
                onUpdate(env.id, { image_urls: env.image_urls });
                toast({ variant: "destructive", title: "Erro de conexão", description: "Tente novamente." });
            } finally {
                setIsUploading(null);
            }
        },
        [env, presentationId, onUpdate, toast]
    );

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        Array.from(files).slice(0, 4 - (env.image_urls || []).length).forEach(uploadImage);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDropOver(false);
        handleFiles(e.dataTransfer.files);
    };

    return (
        <AccordionPrimitive.Item value={env.id} className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
            {/* 
              Custom header: Trigger and Switch are SIBLINGS, not nested.
              This prevents the invalid button>button HTML that causes hydration errors.
            */}
            <AccordionPrimitive.Header className="flex items-center border-b border-transparent data-[state=open]:border-gray-100">
                {/* Expand/collapse trigger — takes full remaining width */}
                <AccordionPrimitive.Trigger
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-50 transition-colors [&[data-state=open]>svg]:rotate-180"
                >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${env.is_visible ? "bg-primary" : "bg-gray-300"}`} />
                    <span className={`text-sm font-medium text-left ${env.is_visible ? "text-gray-900" : "text-gray-400"}`}>
                        {env.environment?.name || "Ambiente"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto transition-transform duration-200" />
                </AccordionPrimitive.Trigger>

                {/* Visibility switch — sibling of trigger, NOT inside it */}
                <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 data-[state=open]:bg-gray-50 border-l border-gray-100">
                    <span className="text-xs text-gray-400">{env.is_visible ? "Visível" : "Oculto"}</span>
                    <Switch
                        checked={env.is_visible}
                        onCheckedChange={(val) => {
                            onUpdate(env.id, { is_visible: val });
                            saveDetail("is_visible", val);
                        }}
                    />
                </div>
            </AccordionPrimitive.Header>

            <AccordionPrimitive.Content className="px-4 pb-4 pt-2 bg-white space-y-4 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                {isSaving && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                    </div>
                )}

                {/* Textos */}
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Título da Seção</label>
                        <input
                            type="text"
                            value={localTitle}
                            onChange={(e) => setLocalTitle(e.target.value)}
                            onBlur={() => { if (localTitle !== (env.title || "")) saveDetail("title", localTitle); }}
                            placeholder="Ex: A Sala de Estar"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Subtítulo</label>
                        <input
                            type="text"
                            value={localSubtitle}
                            onChange={(e) => setLocalSubtitle(e.target.value)}
                            onBlur={() => { if (localSubtitle !== (env.subtitle || "")) saveDetail("subtitle", localSubtitle); }}
                            placeholder="Ex: Conforto e Minimalismo"
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Descrição</label>
                        <textarea
                            value={localDescription}
                            onChange={(e) => setLocalDescription(e.target.value)}
                            onBlur={() => { if (localDescription !== (env.description || "")) saveDetail("description", localDescription); }}
                            placeholder="Descreva o conceito, materiais e inspirações deste ambiente..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                    </div>
                </div>

                {/* Upload de Imagens */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">Imagens ({(env.image_urls || []).length}/4)</label>
                        {(env.image_urls || []).length < 4 && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <Upload className="w-3 h-3" /> Adicionar
                            </button>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                    />

                    {/* Grid de thumbnails */}
                    {(env.image_urls || []).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {(env.image_urls || []).map((url, idx) => (
                                <div key={idx} className="relative rounded-md overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    {isUploading === idx && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Drop zone */}
                    {(env.image_urls || []).length < 4 && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDropOver(true); }}
                            onDragLeave={() => setIsDropOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-all text-xs text-gray-400
                                ${isDropOver ? "border-primary bg-primary/5 text-primary" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                        >
                            <Upload className="w-4 h-4 mr-1.5" />
                            <span>Arraste ou clique para adicionar</span>
                        </div>
                    )}
                </div>
            </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
    );
}

export function EnvironmentAccordion({ presentationId, environments, onEnvironmentUpdate }: EnvironmentAccordionProps) {
    if (environments.length === 0) {
        return (
            <p className="text-sm text-gray-500 text-center py-4">
                Nenhum ambiente encontrado neste projeto.
            </p>
        );
    }

    return (
        <AccordionPrimitive.Root type="single" collapsible className="w-full space-y-0">
            {environments.map((env) => (
                <EnvAccordionItem
                    key={env.id}
                    env={env}
                    presentationId={presentationId}
                    onUpdate={onEnvironmentUpdate}
                />
            ))}
        </AccordionPrimitive.Root>
    );
}
