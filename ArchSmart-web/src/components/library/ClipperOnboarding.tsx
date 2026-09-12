"use client"

import { useEffect, useState } from "react"
import { Chrome, Download, Pin, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAccessToken } from "@/lib/api/auth"

export function ClipperOnboarding() {
    const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading")

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const accessToken = await getAccessToken()

                if (accessToken) {
                    setStatus("connected")
                } else {
                    setStatus("disconnected")
                }
            } catch (error) {
                console.error("Erro ao verificar sessão do Clipper:", error)
                setStatus("disconnected")
            }
        }

        checkConnection()
    }, [])

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto py-8 animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="flex flex-col items-center text-center space-y-4 mb-4">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
                    <Chrome className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Capture produtos em segundos</h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                    Evite copiar e colar dados manualmente. Use nossa extensão para o Google Chrome e salve imagens, preços e nomes de produtos diretamente das lojas para a sua Biblioteca do Arq Smart.
                </p>

                <div className="flex items-center gap-2 mt-4 bg-muted/50 px-4 py-2 rounded-full border">
                    <span className="text-sm font-medium">Status da Conexão:</span>
                    {status === "loading" && <Badge variant="secondary">Verificando...</Badge>}
                    {status === "connected" && (
                        // Chip PREENCHIDO, pelo mesmo motivo que o aviso em
                        // BatchNormalizeRow: token de estado nao serve como cor de texto.
                        // Medido compondo o alfa da pilha REAL (este badge fica dentro de um
                        // `bg-muted/50`): `text-success` sobre `bg-success/15` sobre
                        // `bg-muted/50` da 3,97:1 no claro e REPROVA o 4.5:1 do Art. 6 — os
                        // 5,07:1 que justificavam a versao anterior eram sobre
                        // `--background`, que nao e o fundo que aparece na tela. Medir o
                        // token sobre o fundo da pagina, e nao sobre o par que renderiza, foi
                        // o erro; o par do chip da 5,07:1 no claro e 10,17:1 no escuro.
                        //
                        // `hover:bg-success` nao e redundante: a variante `default` do Badge
                        // traz `hover:bg-primary/80`, e sem sobrescrever isso o chip mudaria
                        // de cor no hover. Fixar o mesmo tom mantem os 5,07:1 em todo estado
                        // — um `hover:bg-success/90` cairia para 4,25:1 sobre o `bg-muted/50`
                        // e reprovaria de novo, no hover.
                        <Badge className="bg-success text-success-foreground hover:bg-success gap-1.5">
                            <CheckCircle2 className="h-3 w-3" />
                            Conta Pronta para Conexão
                        </Badge>
                    )}
                    {status === "disconnected" && (
                        <Badge variant="destructive" className="gap-1.5">
                            <AlertCircle className="h-3 w-3" />
                            Faça Login Novamente
                        </Badge>
                    )}
                </div>
            </div>

            {/* Step by Step */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Passo 1 */}
                <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Download className="h-24 w-24" />
                    </div>
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary">Passo 1</Badge>
                        </div>
                        <CardTitle>Instalar a Extensão</CardTitle>
                        <CardDescription>
                            Baixe o arquivo da extensão e adicione ao seu navegador Google Chrome para começar.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <Button className="w-full gap-2" asChild>
                            <a href="/arch-smart-clipper.zip" download="arch-smart-clipper.zip">
                                <Download className="h-4 w-4" />
                                Baixar Extensão (ZIP)
                            </a>
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center mt-3">
                            *Versão Beta. Requer instalação manual via "Load Unpacked".
                        </p>
                    </CardContent>
                </Card>

                {/* Passo 2 */}
                <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Pin className="h-24 w-24" />
                    </div>
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary">Passo 2</Badge>
                        </div>
                        <CardTitle>Fixar no Navegador</CardTitle>
                        <CardDescription>
                            Para acesso rápido, clique no ícone de "Quebra-cabeça" do Chrome e fixe o ícone do Arq Smart.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex justify-center">
                        <div className="bg-background border rounded-lg p-3 shadow-sm flex items-center gap-3">
                            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                                <Chrome className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="h-px w-4 bg-border" />
                            <div className="h-8 w-8 bg-primary/10 rounded flex items-center justify-center border border-primary/20">
                                <Pin className="h-4 w-4 text-primary transform rotate-45" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Passo 3 */}
                <Card className="relative bg-primary/5 border-primary/20 overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles className="h-24 w-24 text-primary" />
                    </div>
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-primary text-primary-foreground">Passo 3</Badge>
                        </div>
                        <CardTitle>Capturar Produtos</CardTitle>
                        <CardDescription>
                            Navegue na loja de sua preferência (ex: Tok&Stok), abra a extensão e envie o item para o seu Inbox.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="space-y-2">
                            <div className="h-2 w-full bg-primary/10 rounded" />
                            <div className="h-2 w-full bg-primary/10 rounded" />
                            <div className="h-2 w-2/3 bg-primary/10 rounded" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
