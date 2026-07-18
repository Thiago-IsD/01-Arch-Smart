"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Lock, Loader2 } from "lucide-react"
import { PortalView, type PublicPresentationData } from "./PortalView"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const tokenKey = (uuid: string) => `portal_token_${uuid}`

type ViewState = "loading" | "unlocked" | "gate" | "unavailable" | "notfound"

export function PortalClient({ uuid }: { uuid: string }) {
    const [state, setState] = useState<ViewState>("loading")
    const [data, setData] = useState<PublicPresentationData | null>(null)
    const [branding, setBranding] = useState<PublicPresentationData["branding"] | null>(null)
    const [password, setPassword] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        const token = typeof window !== "undefined" ? localStorage.getItem(tokenKey(uuid)) : null
        try {
            const res = await fetch(`${API_BASE}/public/presentations/${uuid}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                cache: "no-store",
            })
            if (!res.ok) {
                setState("notfound")
                return
            }
            const json: PublicPresentationData = await res.json()
            setBranding(json.branding)

            if (json.locked) {
                // Token expirado/ausente: limpa para não insistir num token inválido.
                if (token) localStorage.removeItem(tokenKey(uuid))
                setState(json.has_password ? "gate" : "unavailable")
            } else {
                setData(json)
                setState("unlocked")
            }
        } catch {
            setState("notfound")
        }
    }, [uuid])

    useEffect(() => {
        load()
    }, [load])

    const submitPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!password.trim()) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`${API_BASE}/public/presentations/${uuid}/verify-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            })
            if (res.status === 401) {
                setError("Senha incorreta.")
                return
            }
            if (!res.ok) {
                setError("Não foi possível validar. Tente novamente.")
                return
            }
            const json = await res.json()
            localStorage.setItem(tokenKey(uuid), json.access_token)
            setPassword("")
            setState("loading")
            await load()
        } catch {
            setError("Erro de conexão. Tente novamente.")
        } finally {
            setSubmitting(false)
        }
    }

    if (state === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    if (state === "unlocked" && data) {
        return <PortalView data={data} />
    }

    if (state === "notfound") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-slate-50">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <h1 className="text-xl font-bold text-slate-700 mb-2">Apresentação não encontrada</h1>
                <p className="text-sm text-slate-500 max-w-xs">
                    O link que você acessou é inválido ou a apresentação foi removida.
                </p>
            </div>
        )
    }

    if (state === "unavailable") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-slate-50">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h1 className="text-xl font-bold text-slate-700 mb-2">Apresentação ainda não disponível</h1>
                <p className="text-sm text-slate-500 max-w-xs">
                    O responsável ainda não liberou o acesso. Peça o link e a senha atualizados.
                </p>
            </div>
        )
    }

    // state === "gate"
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-50">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                {branding?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={branding.logo_url}
                        alt={branding.office_name || "Logo"}
                        className="h-12 w-auto object-contain mx-auto mb-4"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-6 h-6 text-white" />
                    </div>
                )}

                <h1 className="text-lg font-bold text-slate-800">Apresentação protegida</h1>
                <p className="text-sm text-slate-500 mt-1 mb-6">
                    Digite a senha que {branding?.office_name || "o responsável"} compartilhou com você.
                </p>

                <form onSubmit={submitPassword} className="space-y-3">
                    <input
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    {error && <p className="text-sm text-red-600 text-left">{error}</p>}
                    <button
                        type="submit"
                        disabled={submitting || !password.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Entrar
                    </button>
                </form>
            </div>
            <p className="text-xs text-slate-400 mt-6">
                Protegido por <span className="font-semibold text-emerald-600">Arch Smart</span>
            </p>
        </div>
    )
}
