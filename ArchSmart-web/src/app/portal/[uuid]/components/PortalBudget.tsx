"use client";

import React, { useState, useMemo } from "react";
import { ShoppingCart, ExternalLink, Package, Check } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";

interface PublicProductInfo {
    id: string;
    name: string;
    store: string | null;
    price: number | null;
    image_url: string | null;
    source_url: string | null;
}

interface PublicOptionInfo {
    id: string;
    is_selected: boolean;
    product: PublicProductInfo | null;
    approval_status?: string;
}

interface PublicBudgetItemInfo {
    id: string;
    environment_id: string | null;
    rule_type: string;
    calculated_quantity: number | null;
    manual_quantity: number | null;
    options: PublicOptionInfo[];
}

interface PublicEnvironmentInfo {
    id: string;
    environment_id: string;
    environment_name: string;
    title: string | null;
}

interface PortalBudgetProps {
    initialItems: PublicBudgetItemInfo[];
    environments: PublicEnvironmentInfo[];
    presentationId: string;
    status: string;
}

export function PortalBudget({ initialItems, environments, presentationId, status }: PortalBudgetProps) {
    const { toast } = useToast();
    const [items, setItems] = useState(initialItems);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [accepted, setAccepted] = useState(true);
    const [isSuccess, setIsSuccess] = useState(false);

    // Group items by environment
    const groups = useMemo(() => {
        const result: { env: PublicEnvironmentInfo; items: PublicBudgetItemInfo[] }[] = [];
        for (const env of environments) {
            const envItems = items.filter(i => i.environment_id === env.environment_id);
            if (envItems.length > 0) {
                result.push({ env, items: envItems });
            }
        }
        return result;
    }, [items, environments]);

    const isLocked = status === "ACCEPTED" || status === "REVISION_REQUESTED";

    const handleSelectOption = async (itemId: string, optionId: string) => {
        if (isLocked) return;

        // Update local state
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                options: item.options.map(opt => ({
                    ...opt,
                    is_selected: opt.id === optionId
                }))
            };
        }));

        try {
            await fetch(
                apiUrl(`/public/presentations/${presentationId}/options/${optionId}/select`),
                { method: "POST" }
            );
        } catch (e) {
            console.error("Failed to save selection on server", e);
        }
    };

    const handleApproveOption = async (itemId: string, optionId: string) => {
        if (isLocked) return;

        // Optimistically update UI
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                options: item.options.map(opt => ({
                    ...opt,
                    is_selected: opt.id === optionId,
                    approval_status: opt.id === optionId ? "APPROVED" : "PENDING"
                }))
            };
        }));

        try {
            const res = await fetch(
                apiUrl(`/public/presentations/${presentationId}/options/${optionId}/approve`),
                { method: "POST" }
            );
            if (!res.ok) throw new Error("Erro ao aprovar item");
            toast({ title: "Item Aprovado", description: "O status foi atualizado com sucesso." });
        } catch (err) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a aprovação." });
            setItems(initialItems);
        }
    };

    const handleRejectOption = async (itemId: string, optionId: string) => {
        if (isLocked) return;

        // Optimistically update UI
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                options: item.options.map(opt => {
                    if (opt.id !== optionId) return opt;
                    return { ...opt, approval_status: "REJECTED" };
                })
            };
        }));

        try {
            const res = await fetch(
                apiUrl(`/public/presentations/${presentationId}/options/${optionId}/reject`),
                { method: "POST" }
            );
            if (!res.ok) throw new Error("Erro ao recusar item");
            toast({ title: "Item Recusado", description: "O orçamento foi recalculado." });
        } catch (err) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a recusa." });
            setItems(initialItems);
        }
    };

    const handleSubmitAcceptance = async () => {
        setIsSubmitting(true);
        try {
            // Build selected options snapshot
            const selectedOptions: Record<string, string> = {};
            items.forEach(item => {
                const active = item.options.find(o => o.is_selected) || item.options[0];
                if (active) selectedOptions[item.id] = active.id;
            });

            const res = await fetch(
                apiUrl(`/public/presentations/${presentationId}/accept`),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        accepted,
                        feedback,
                        selected_options: selectedOptions
                    })
                }
            );

            if (res.ok) {
                setIsSuccess(true);
                setIsDialogOpen(false);
                toast({ title: "Enviado com sucesso!", description: "O arquiteto foi notificado." });
            } else {
                toast({ variant: "destructive", title: "Erro", description: "Não foi possível enviar sua avaliação." });
            }
        } catch (error) {
            console.error("Error submitting acceptance:", error);
            toast({ variant: "destructive", title: "Ops!", description: "Erro de conexão ao enviar avaliação." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const calculateItemTotal = (item: PublicBudgetItemInfo) => {
        const active = item.options.find(o => o.is_selected) || item.options[0];
        if (active?.approval_status === "REJECTED") {
            return 0;
        }
        const price = active?.product?.price || 0;
        const qty = item.rule_type === "UNIT" ? (item.manual_quantity || 1) : (item.calculated_quantity || 0);
        return price * qty;
    };

    const grandTotal = useMemo(() => {
        return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    }, [items]);

    if (items.length === 0) return null;

    return (
        <section className="pt-8 pb-12">
            <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Materiais e Orçamento
            </h2>
            <p className="text-sm text-slate-500 mb-6">
                Clique nas opções abaixo para alternar entre os materiais sugeridos.
            </p>

            <div className="space-y-6">
                {groups.map(({ env, items: envItems }) => {
                    const groupTotal = envItems.reduce((s, item) => s + calculateItemTotal(item), 0);

                    return (
                        <div key={env.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-sm font-bold text-slate-700">
                                    {env.title || env.environment_name}
                                </span>
                                <span className="text-sm font-semibold text-emerald-600">
                                    R$ {groupTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-50">
                                {envItems.map(item => {
                                    const activeOption = item.options.find(o => o.is_selected) || item.options[0];
                                    const product = activeOption?.product;
                                    const qty = item.rule_type === "UNIT" ? (item.manual_quantity || 1) : (item.calculated_quantity || 0);

                                    return (
                                        <div key={item.id} className="p-4">
                                            {/* Selection Tabs if more than one option */}
                                            {item.options.length > 1 && (
                                                <div className="flex bg-slate-100 p-1 rounded-lg mb-4 w-fit">
                                                    {item.options.map((opt, idx) => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => handleSelectOption(item.id, opt.id)}
                                                            disabled={isLocked}
                                                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${opt.is_selected
                                                                ? "bg-white text-emerald-700 shadow-sm"
                                                                : "text-slate-500 hover:text-slate-700"
                                                                } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                                                        >
                                                            Opção {String.fromCharCode(65 + idx)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                                                    {product?.image_url ? (
                                                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">IMG</div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 line-clamp-1">
                                                        {product?.name || "Material"}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-slate-500">
                                                            {qty % 1 === 0 ? qty : qty.toFixed(2)} un
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-xs font-bold text-emerald-600">
                                                            R$ {(product?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-black text-slate-900">
                                                        R$ {calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    {product?.source_url && (
                                                        <a
                                                            href={product.source_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 mt-1"
                                                        >
                                                            <ShoppingCart className="w-3 h-3" />
                                                            Ver Produto
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Approve / Reject Controls */}
                                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                                                <span className="text-xs text-slate-400">
                                                    Status: {activeOption?.approval_status === "APPROVED" ? (
                                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">Aprovado ✓</span>
                                                    ) : activeOption?.approval_status === "REJECTED" ? (
                                                        <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">Recusado ✗</span>
                                                    ) : (
                                                        <span className="text-slate-500 font-medium">Aguardando Avaliação</span>
                                                    )}
                                                </span>
                                                
                                                {!isLocked && (
                                                    <div className="flex gap-2">
                                                        {activeOption?.approval_status !== "APPROVED" && (
                                                            <button
                                                                onClick={() => handleApproveOption(item.id, activeOption.id)}
                                                                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                                                            >
                                                                Aprovar
                                                            </button>
                                                        )}
                                                        {activeOption?.approval_status !== "REJECTED" && (
                                                            <button
                                                                onClick={() => handleRejectOption(item.id, activeOption.id)}
                                                                className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
                                                            >
                                                                Recusar
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Fixed Footer for Acceptance */}
            {!isSuccess && !isLocked && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Investimento Final (Estimado)</p>
                            <p className="text-xl font-black text-emerald-600">
                                R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <button
                            onClick={() => setIsDialogOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md transition-all active:scale-95"
                        >
                            Avaliar Projeto
                        </button>
                    </div>
                </div>
            )}

            {isSuccess && (
                <div className="mt-8 bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-800">Avaliação Enviada!</h3>
                    <p className="text-sm text-emerald-600 mt-1">O arquiteto foi notificado sobre as suas escolhas e comentários.</p>
                </div>
            )}

            {!isSuccess && isLocked && (
                <div className="mt-8 bg-slate-100 rounded-2xl border border-slate-200 p-6 text-center">
                    <h3 className="text-lg font-bold text-slate-800">Apresentação em Análise</h3>
                    <p className="text-sm text-slate-500 mt-1">As opções desta apresentação não podem ser alteradas no momento pois ela já foi avaliada e encontra-se com o Arquiteto.</p>
                </div>
            )}

            {/* Acceptance Dialog Overlay */}
            {isDialogOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Avaliar Apresentação</h3>
                            <p className="text-sm text-slate-500 mb-6">Estamos quase lá! Como você avalia as opções escolhidas?</p>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <button
                                    onClick={() => setAccepted(true)}
                                    className={`p-4 rounded-xl border-2 text-center transition-all ${accepted
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600 font-medium"
                                        }`}
                                >
                                    Aprovar Projeto
                                </button>
                                <button
                                    onClick={() => setAccepted(false)}
                                    className={`p-4 rounded-xl border-2 text-center transition-all ${!accepted
                                        ? "border-amber-500 bg-amber-50 text-amber-700 font-bold"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600 font-medium"
                                        }`}
                                >
                                    Solicitar Ajustes
                                </button>
                            </div>

                            <div className="mb-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Deixe um comentário {accepted ? "(Opcional)" : "(Recomendado)"}
                                </label>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm min-h-[100px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                                    placeholder="Escreva aqui suas observações sobre o projeto ou os materiais..."
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3 justify-end">
                            <button
                                onClick={() => setIsDialogOpen(false)}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitAcceptance}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Enviando...
                                    </>
                                ) : "Confirmar e Enviar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
