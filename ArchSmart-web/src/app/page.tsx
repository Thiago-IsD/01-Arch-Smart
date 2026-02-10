
import { Navbar } from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowRight,
  Chrome,
  Building2,
  LayoutDashboard,
  HardHat,
  BookOpen,
  Wallet,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Abstract UI Components ---

const AbstractHeroIllustration = () => (
  <div className="relative w-full max-w-lg aspect-square mx-auto lg:mx-0">
    {/* Central Dashboard Card */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-card rounded-xl border shadow-2xl flex flex-col p-4 z-20">
      <div className="flex items-center gap-2 mb-4 border-b pb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div className="h-2 w-24 bg-muted rounded-full" />
      </div>
      <div className="space-y-2 flex-1">
        <div className="flex gap-2">
          <div className="h-16 w-full bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20" />
          <div className="h-16 w-full bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20" />
        </div>
        <div className="h-8 w-full bg-primary/5 rounded-lg mt-auto" />
      </div>
    </div>

    {/* Floating Satellite Cards */}
    {/* 1. Project */}
    <div className="absolute top-0 right-10 w-32 p-3 bg-card rounded-lg border shadow-lg z-10 animate-bounce delay-700 [animation-duration:3000ms]">
      <div className="flex items-center gap-2 mb-2">
        <HardHat className="w-4 h-4 text-secondary" />
        <div className="h-2 w-12 bg-muted rounded-full" />
      </div>
      <div className="h-1.5 w-full bg-muted/30 rounded-full mb-1" />
      <div className="h-1.5 w-16 bg-muted/30 rounded-full" />
    </div>

    {/* 2. Budget */}
    <div className="absolute bottom-10 left-0 w-36 p-3 bg-card rounded-lg border shadow-lg z-10 animate-bounce delay-500 [animation-duration:4000ms]">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-4 h-4 text-primary" />
        <div className="h-2 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-6 w-full bg-primary/10 rounded border border-primary/20 flex items-center px-2">
        <span className="text-[10px] font-bold text-primary">R$ 14.500</span>
      </div>
    </div>

    {/* 3. Library */}
    <div className="absolute top-10 left-10 w-28 p-3 bg-card rounded-lg border shadow-lg z-0 opacity-80 animate-pulse [animation-duration:5000ms]">
      <BookOpen className="w-4 h-4 text-primary mb-2" />
      <div className="flex gap-1">
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded" />
      </div>
    </div>

    {/* Connecting Lines (SVG) */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10 text-muted-foreground/20" stroke="currentColor" strokeWidth="1">
      <line x1="50%" y1="50%" x2="75%" y2="15%" strokeDasharray="4 4" />
      <line x1="50%" y1="50%" x2="25%" y2="85%" strokeDasharray="4 4" />
      <line x1="50%" y1="50%" x2="20%" y2="25%" strokeDasharray="4 4" />
    </svg>

    {/* Background Glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -z-20" />
  </div>
);

const AbstractDashboardTeaser = () => (
  <div className="w-full h-full bg-card rounded-xl border shadow-sm p-4 md:p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/50 transition-colors">
    {/* Header */}
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-primary/20" />
        <div className="space-y-1">
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          <div className="h-2 w-20 bg-muted/50 rounded" />
        </div>
      </div>
      <div className="h-8 w-8 rounded-full bg-muted/30" />
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-3 gap-4 flex-1">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col gap-2 col-span-1 border-r pr-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 w-full bg-muted/20 rounded flex items-center px-2">
            <div className="h-4 w-4 bg-muted/40 rounded mr-2" />
          </div>
        ))}
      </div>

      {/* Main Area */}
      <div className="col-span-3 md:col-span-2 space-y-4">
        <div className="flex gap-4">
          <div className="h-24 flex-1 bg-primary/5 rounded border border-primary/20 p-3">
            <div className="h-4 w-4 bg-primary/20 rounded mb-2" />
            <div className="h-2 w-12 bg-primary/10 rounded mb-1" />
            <div className="h-6 w-16 bg-primary/10 rounded" />
          </div>
          <div className="h-24 flex-1 bg-muted/20 rounded border p-3">
            <div className="h-4 w-4 bg-muted/40 rounded mb-2" />
            <div className="h-2 w-12 bg-muted/30 rounded" />
          </div>
        </div>
        <div className="h-32 w-full bg-muted/10 rounded border border-dashed border-muted-foreground/20 flex items-center justify-center">
          <div className="h-40 w-40 bg-gradient-to-t from-muted/20 to-transparent rounded-full blur-xl" />
        </div>
      </div>
    </div>

    {/* Overlay Badge */}
    <div className="absolute bottom-4 right-4 bg-foreground text-background text-xs font-bold px-3 py-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
      Vision
    </div>
  </div>
);

const AbstractBrowserWindow = () => (
  <div className="relative w-full aspect-video bg-background rounded-xl border shadow-xl overflow-hidden flex flex-col">
    {/* Browser Toolbar */}
    <div className="h-8 bg-muted/50 border-b flex items-center px-3 gap-2">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
      </div>
      <div className="flex-1 max-w-[200px] mx-auto h-5 bg-background rounded border flex items-center px-2 text-[10px] text-muted-foreground">
        loja-moveis.com.br/cadeira-design
      </div>
    </div>

    {/* Content */}
    <div className="flex-1 bg-muted/10 relative p-4 grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="h-32 w-full bg-muted rounded-lg" />
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-4 w-1/2 bg-muted rounded" />
      </div>
      <div className="space-y-4 pt-8">
        <div className="h-2 w-full bg-muted rounded" />
        <div className="h-2 w-full bg-muted rounded" />
        <div className="h-8 w-24 bg-primary/20 rounded" />
      </div>

      {/* Extension Popup */}
      <div className="absolute top-4 right-4 w-48 bg-card rounded-lg border shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-700">
        <div className="flex items-center gap-2 mb-3">
          <Chrome className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold">Arch Smart Clipper</span>
        </div>
        <div className="space-y-2">
          <div className="h-20 bg-muted/30 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">
            Imagem Capturada
          </div>
          <div className="h-6 bg-primary text-primary-foreground rounded text-[10px] font-bold flex items-center justify-center cursor-pointer hover:bg-primary/90">
            Salvar na Biblioteca
          </div>
        </div>
      </div>
    </div>
  </div>
);


export default function Home() {


  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-primary/20">
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="py-20 lg:py-28 overflow-hidden">
          <div className="container px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-8">
                <Badge variant="outline" className="py-1.5 px-4 bg-primary/5 border-primary/20 text-primary">
                  Otimizado para Escritórios
                </Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                  Transforme a Gestão do seu <span className="text-primary">Escritório</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                  A plataforma tudo-em-um para gestão de projetos, controle financeiro e colaboração com clientes, feita sob medida para arquitetos e designers.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <Button size="lg" className="h-12 px-8 text-base gap-2" asChild>
                    <Link href="/beta/register">
                      Entrar no Beta
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                    <Link href="/produto">
                      Conhecer o Produto
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Visual */}
              <div className="w-full relative mx-auto">
                <AbstractHeroIllustration />
              </div>
            </div>
          </div>
        </section>

        <div className="container px-4"><div className="h-px bg-border" /></div>

        {/* 2. Dashboard Teaser */}
        <section className="py-24 bg-muted/10">
          <div className="container px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 relative h-[400px]">
                <AbstractDashboardTeaser />
                {/* Decoration */}
                <div className="absolute -bottom-6 -left-6 w-full h-full border-2 border-dashed border-muted rounded-xl -z-10" />
              </div>

              <div className="order-1 lg:order-2 space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">Tudo o que você precisa em um só lugar</h2>
                <p className="text-lg text-muted-foreground">
                  Abandone as planilhas desconexas. O Arch Smart centraliza seus projetos, orçamentos, cronogramas e comunicação com clientes em uma interface intuitiva e poderosa.
                </p>
                <ul className="space-y-3 pt-4">
                  {[
                    "Biblioteca de Produtos Inteligente",
                    "Orçamentos Automáticos",
                    "Portal do Cliente Integrado"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground/80 font-medium">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="link" className="px-0 text-primary h-auto font-bold group" asChild>
                  <Link href="/produto">
                    Ver todas as funcionalidades
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Web Clipper Teaser */}
        <section className="py-24">
          <div className="container px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">Capture inspirações instantaneamente</h2>
                <p className="text-lg text-muted-foreground">
                  Viu um produto incrível em um site de fornecedor? Use nossa extensão Web Clipper para salvar especificações, imagens e preços diretamente na sua biblioteca de projetos com um clique.
                </p>
                <div className="pt-4">
                  <Button className="h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href="/web-clipper">
                      <Chrome className="w-4 h-4 mr-2" />
                      Baixar Web Clipper
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="relative">
                <AbstractBrowserWindow />
                {/* Decoration */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* 4. Pricing Teaser */}
        <section className="py-24 bg-muted/10 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16 max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl font-bold tracking-tight">Planos que crescem com você</h2>
              <p className="text-lg text-muted-foreground">
                De freelancers a grandes escritórios, temos a solução ideal. Sem contratos de fidelidade.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
              {/* Solo */}
              <div className="bg-card border rounded-xl p-6 flex flex-col items-center text-center opacity-80 hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <UserIcon />
                </div>
                <h3 className="font-bold text-lg mb-1">Solo</h3>
                <p className="text-sm text-muted-foreground mb-4">Para arquitetos autônomos</p>
                <span className="font-bold text-2xl">R$ 119<span className="text-sm font-normal text-muted-foreground">/mês</span></span>
              </div>

              {/* Professional */}
              <div className="bg-card border-2 border-primary rounded-xl p-8 flex flex-col items-center text-center shadow-2xl scale-105 relative z-10">
                <div className="absolute -top-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Mais Popular
                </div>
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <BuildingIcon />
                </div>
                <h3 className="font-bold text-xl mb-1">Professional</h3>
                <p className="text-sm text-muted-foreground mb-6">Para escritórios em crescimento</p>
                <span className="font-bold text-4xl mb-6">R$ 299<span className="text-lg font-normal text-muted-foreground">/mês</span></span>
                <Button className="w-full" asChild>
                  <Link href="/precos">Ver Detalhes</Link>
                </Button>
              </div>

              {/* Studio */}
              <div className="bg-card border rounded-xl p-6 flex flex-col items-center text-center opacity-80 hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Building2Icon />
                </div>
                <h3 className="font-bold text-lg mb-1">Studio</h3>
                <p className="text-sm text-muted-foreground mb-4">Para grandes equipes</p>
                <span className="font-bold text-lg text-muted-foreground line-clamp-1 py-1">Sob Consulta</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

// Simple icons for the pricing section
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
)
const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>
)
const Building2Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
)
