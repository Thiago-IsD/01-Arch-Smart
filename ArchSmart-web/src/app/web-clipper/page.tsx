import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Scissors,
    Zap,
    LayoutGrid,
    Chrome,
    CheckCircle2,
    XCircle,
    ArrowRight,
    Bean,
    ShoppingBag,
    Link2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Abstract UI Component: Browser Window
const AbstractBrowser = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={cn("relative rounded-xl border bg-background shadow-2xl overflow-hidden", className)}>
        {/* Browser Header */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 px-4">
                <div className="mx-auto h-6 w-3/4 max-w-[400px] rounded-md bg-background border flex items-center px-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><ShoppingBag size={10} /> loja-portobello.com.br/produto/porcelanato-mineral...</span>
                </div>
            </div>
            {/* Extended Browser Actions with Clipper Icon */}
            <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center">
                    <Scissors size={12} />
                </div>
            </div>
        </div>

        {/* Browser Body */}
        <div className="relative bg-muted/10 p-0 h-[400px] overflow-hidden">
            {/* Simulated Webpage Content */}
            <div className="p-8 space-y-8 opacity-60 pointer-events-none select-none filter blur-[1px]">
                <div className="flex gap-8">
                    <div className="w-1/2 aspect-square rounded-lg bg-muted animate-pulse" />
                    <div className="w-1/2 space-y-4">
                        <div className="h-8 w-3/4 bg-muted rounded" />
                        <div className="h-6 w-1/4 bg-muted rounded" />
                        <div className="space-y-2 pt-4">
                            <div className="h-4 w-full bg-muted rounded" />
                            <div className="h-4 w-5/6 bg-muted rounded" />
                            <div className="h-4 w-4/6 bg-muted rounded" />
                        </div>
                    </div>
                </div>
            </div>

            {children}
        </div>
    </div>
);

// Abstract UI: Extension Popup
const ExtensionPopup = () => (
    <div className="absolute top-4 right-4 w-[300px] rounded-lg border bg-background shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="p-4 border-b flex items-center justify-between bg-primary/5">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Scissors className="h-4 w-4" /> Arch Smart
            </div>
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Produto Detectado</label>
                <div className="text-sm font-medium leading-tight">Porcelanato Mineral Portland Grey 90x90</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Preço</label>
                    <div className="flex items-center gap-1 text-sm font-bold text-primary">
                        R$ 129,90
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Unidade</label>
                    <div className="text-sm font-bold">
                        m²
                    </div>
                </div>
            </div>

            <Button className="w-full gap-2">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                Salvar no Inbox
            </Button>

            <div className="text-[10px] text-center text-muted-foreground pt-2 border-t">
                Normalização por IA ativa ⚡
            </div>
        </div>
    </div>
);

export default function WebClipperPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
            <Navbar />

            <main className="flex-1">
                {/* 1. Hero Section (The Hook) */}
                <section className="py-20 lg:py-32 overflow-hidden">
                    <div className="container px-4 md:px-6">
                        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                            {/* Left: Copy */}
                            <div className="flex flex-col gap-6 text-center lg:text-left">
                                <Badge variant="outline" className="w-fit mx-auto lg:mx-0 gap-2 py-1.5 px-4 border-primary/20 bg-primary/5 text-primary">
                                    <Chrome className="h-3 w-3" />
                                    Extensão para Chrome
                                </Badge>
                                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl text-foreground">
                                    Pare de tirar prints. <br />
                                    <span className="text-primary">Comece a construir sua biblioteca.</span>
                                </h1>
                                <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                                    Capture produtos técnicos de qualquer loja online com um clique.
                                    A IA do Arch Smart organiza nome, preço e dimensões automaticamente.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center lg:justify-start">
                                    <Button size="lg" className="gap-2 h-12 text-base px-8 shadow-lg shadow-primary/20">
                                        <Chrome className="h-5 w-5" />
                                        Instalar no Chrome — É Grátis
                                    </Button>
                                    <p className="text-xs text-muted-foreground sm:hidden mt-2">
                                        Disponível para Desktop
                                    </p>
                                </div>
                            </div>

                            {/* Right: Abstract UI Visual */}
                            <div className="relative perspective-1000">
                                {/* Decorator Blobs */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 blur-[100px] rounded-full -z-10" />

                                <AbstractBrowser className="transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 ease-out">
                                    <ExtensionPopup />
                                </AbstractBrowser>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container px-4"><div className="h-px bg-border" /></div>

                {/* 2. The Problem (Before vs After) */}
                <section className="py-24 bg-muted/30">
                    <div className="container px-4 md:px-6">
                        <div className="text-center mb-16 space-y-4">
                            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl text-foreground">
                                O fim da planilha de especificações.
                            </h2>
                            <p className="text-muted-foreground max-w-2xl mx-auto">
                                Chega de perder tempo procurando aquele link no WhatsApp ou tentando entender qual era o preço daquele revestimento.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            {/* The Old Way (Chaos) */}
                            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 space-y-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <XCircle size={100} className="text-destructive" />
                                </div>
                                <h3 className="text-xl font-bold text-destructive flex items-center gap-2">
                                    <XCircle size={20} /> O Caos Atual
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-destructive/80">
                                        <div className="h-10 w-10 rounded bg-background/50 flex items-center justify-center shrink-0">
                                            <span className="text-2xl">📱</span>
                                        </div>
                                        <span className="font-medium">Print perdido no WhatsApp</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-destructive/80">
                                        <div className="h-10 w-10 rounded bg-background/50 flex items-center justify-center shrink-0">
                                            <span className="text-2xl">📉</span>
                                        </div>
                                        <span className="font-medium">Planilha desatualizada</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-destructive/80">
                                        <div className="h-10 w-10 rounded bg-background/50 flex items-center justify-center shrink-0">
                                            <span className="text-2xl">🔗</span>
                                        </div>
                                        <span className="font-medium"> Links quebrados (404)</span>
                                    </div>
                                </div>
                            </div>

                            {/* The Arch Smart Way (Order) */}
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 space-y-6 relative overflow-hidden ring-1 ring-primary/20 shadow-xl shadow-primary/5">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <CheckCircle2 size={100} className="text-primary" />
                                </div>
                                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                                    <CheckCircle2 size={20} /> A Solução Arch Smart
                                </h3>

                                {/* Abstract Card */}
                                <div className="rounded-lg bg-card border p-4 shadow-sm space-y-3">
                                    <div className="flex gap-3">
                                        <div className="h-12 w-12 rounded bg-muted shrink-0" />
                                        <div className="space-y-1.5 w-full">
                                            <div className="h-2 w-3/4 rounded bg-foreground/20" />
                                            <div className="h-2 w-1/2 rounded bg-foreground/10" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge variant="secondary" className="text-[10px]">Piso</Badge>
                                        <Badge variant="outline" className="text-[10px] border-primary text-primary">R$ 129,90</Badge>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-primary/80">
                                    Tudo organizado, com preço e especificações técnicas salvas para sempre.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. The Magic (Normalize Flow) */}
                <section className="py-24">
                    <div className="container px-4 md:px-6">
                        <div className="flex flex-col items-center justify-center space-y-12">
                            <div className="text-center space-y-4 max-w-2xl">
                                <h2 className="text-3xl font-bold tracking-tighter">Normalização Automática</h2>
                                <p className="text-muted-foreground">
                                    Não salvamos apenas o link. Nossa Inteligência Artificial lê a página, entende o produto e estrutura os dados para você.
                                </p>
                            </div>

                            <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12 w-full max-w-4xl justify-center">
                                {/* Step 1: Capture */}
                                <div className="flex flex-col items-center gap-4 group">
                                    <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center border-2 border-transparent group-hover:border-primary/50 transition-colors">
                                        <Scissors className="h-8 w-8 text-foreground" />
                                    </div>
                                    <span className="font-semibold">1. Captura</span>
                                </div>

                                <ArrowRight className="text-muted-foreground rotate-90 md:rotate-0" />

                                {/* Step 2: AI Process */}
                                <div className="flex flex-col items-center gap-4 group">
                                    <div className="h-20 w-20 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center animate-pulse">
                                        <Zap className="h-8 w-8 text-primary-foreground" />
                                    </div>
                                    <span className="font-bold text-primary">2. IA Normaliza</span>
                                    <div className="absolute top-24 md:top-auto md:-bottom-12 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                                        <Badge variant="outline" className="bg-background text-[10px]">R$ 120</Badge>
                                        <Badge variant="outline" className="bg-background text-[10px]">m²</Badge>
                                        <Badge variant="outline" className="bg-background text-[10px]">cm</Badge>
                                    </div>
                                </div>

                                <ArrowRight className="text-muted-foreground rotate-90 md:rotate-0" />

                                {/* Step 3: Library */}
                                <div className="flex flex-col items-center gap-4 group">
                                    <div className="h-20 w-20 rounded-2xl bg-primary/10 border-2 border-primary flex items-center justify-center">
                                        <LayoutGrid className="h-8 w-8 text-primary" />
                                    </div>
                                    <span className="font-semibold">3. Biblioteca</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container px-4"><div className="h-px bg-border" /></div>

                {/* 4. Features Grid */}
                <section className="py-24 bg-muted/20">
                    <div className="container px-4 md:px-6">
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="p-6 rounded-xl bg-background border shadow-sm space-y-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <ShoppingBag size={20} />
                                </div>
                                <h3 className="font-semibold text-lg">Curadoria Universal</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Funciona na Amazon, Leroy Merlin, Portobello ou na loja do seu bairro. Se tem um site, nós capturamos.
                                </p>
                            </div>

                            <div className="p-6 rounded-xl bg-background border shadow-sm space-y-3">
                                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                                    <Bean size={20} />
                                </div>
                                <h3 className="font-semibold text-lg">Preço Sempre à Mão</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    O sistema salva o preço do dia da captura para histórico, permitindo que você compare evoluções no futuro.
                                </p>
                            </div>

                            <div className="p-6 rounded-xl bg-background border shadow-sm space-y-3">
                                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Link2 size={20} />
                                </div>
                                <h3 className="font-semibold text-lg">Vínculo com Projetos</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Envie do navegador direto para o DNA de um projeto específico ou para sua biblioteca geral.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. Footer CTA */}
                <section className="py-24">
                    <div className="container px-4 text-center">
                        <div className="max-w-2xl mx-auto space-y-8">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Sua biblioteca começa hoje.</h2>
                            <p className="text-lg text-muted-foreground">
                                Instale a extensão e capture seus primeiros 5 produtos agora mesmo. É grátis.
                            </p>
                            <div className="flex justify-center flex-col sm:flex-row gap-4">
                                <Button size="lg" className="h-12 px-8 text-base gap-2">
                                    <Chrome className="h-5 w-5" />
                                    Adicionar ao Chrome
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </div>
    );
}
