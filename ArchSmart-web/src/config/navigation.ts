import {
    LayoutDashboard,
    Book,
    Folder,
    Monitor,
    DollarSign,
    Calendar,
    Settings,
    User,
    CreditCard
} from "lucide-react";

export const NAV_ITEMS = [
    { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
    { icon: Book, title: "Biblioteca", href: "/library" },
    { icon: Folder, title: "Projetos", href: "/projects" },
    { icon: Monitor, title: "Apresentações", href: "/presentations" },
    { icon: DollarSign, title: "Financeiro", href: "/finance" },
    { icon: Calendar, title: "Agenda", href: "/calendar" },
];

export const PROFILE_MENU_ITEMS = [
    { icon: User, title: "Meu Perfil", href: "/profile" },
    { icon: Settings, title: "Configurações", href: "/settings" },
    { icon: CreditCard, title: "Faturamento", href: "/billing" },
];

export const LANDING_MENU_ITEMS = [
    { name: 'Produto', href: '/produto' },
    { name: 'Web Clipper', href: '/web-clipper' },
    { name: 'Preços', href: '/precos' },
    { name: 'Beta', href: '/beta' },
    { name: 'Sobre', href: '/sobre' },
];
