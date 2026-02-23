"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useDebouncedCallback } from "use-debounce"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface LibraryToolbarProps {
    inboxCount?: number;
}

export function LibraryToolbar({ inboxCount = 0 }: LibraryToolbarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Get current values
    const currentTab = searchParams.get("tab") || "library"
    const currentSearch = searchParams.get("q") || ""
    const currentSort = searchParams.get("sort_by") || "created_at_desc"

    // Parse array params
    const currentCategories = searchParams.getAll("categories")
    const currentOrigins = searchParams.getAll("origins")

    // Filter State (Local for Popover)
    const [selectedCategories, setSelectedCategories] = React.useState<string[]>(currentCategories)
    const [selectedOrigins, setSelectedOrigins] = React.useState<string[]>(currentOrigins)
    const [isFilterOpen, setIsFilterOpen] = React.useState(false)

    // Sync local state when URL changes (if popover is closed)
    React.useEffect(() => {
        if (!isFilterOpen) {
            setSelectedCategories(currentCategories)
            setSelectedOrigins(currentOrigins)
        }
    }, [searchParams, isFilterOpen])

    // Options
    const sortOptions = [
        { value: "created_at_desc", label: "Mais Recentes" },
        { value: "name_asc", label: "Nome (A-Z)" },
        { value: "name_desc", label: "Nome (Z-A)" },
        { value: "price_asc", label: "Menor Preço" },
        { value: "price_desc", label: "Maior Preço" },
    ]

    const categoryOptions = ["Cadeiras", "Poltronas", "Sofás", "Mesas", "Luminárias", "Decoração"]
    const originOptions = ["Manual", "Web Clipper"] // Matching Backend Names

    // Debounced search handler
    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (term) {
            params.set("q", term)
        } else {
            params.delete("q")
        }
        router.replace(`${pathname}?${params.toString()}`)
    }, 300)

    // Tab handler
    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.replace(`${pathname}?${params.toString()}`)
    }

    // Sort handler
    const handleSortChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("sort_by", value)
        router.replace(`${pathname}?${params.toString()}`)
    }

    // Filter Application
    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString())

        // Clear existing
        params.delete("categories")
        params.delete("origins")

        // Append selected
        selectedCategories.forEach(c => params.append("categories", c))
        selectedOrigins.forEach(o => params.append("origins", o))

        router.replace(`${pathname}?${params.toString()}`)
        setIsFilterOpen(false)
    }

    const clearFilters = () => {
        setSelectedCategories([])
        setSelectedOrigins([])
        // Also update URL immediately? Or wait for Apply? User requested "Limpar e Aplicar buttons". 
        // Usually Clear clears local state, then user clicks Apply. Or Clear applies immediately.
        // Guidelines say "Botão Limpar Filtros e Aplicar".
        // I will make Clear reset local state.
    }

    // Helper to toggle checkbox
    const toggleCategory = (c: string) => {
        setSelectedCategories(prev =>
            prev.includes(c) ? prev.filter(i => i !== c) : [...prev, c]
        )
    }

    const toggleOrigin = (o: string) => {
        setSelectedOrigins(prev =>
            prev.includes(o) ? prev.filter(i => i !== o) : [...prev, o]
        )
    }

    // Remove single filter tag
    const removeCategory = (c: string) => {
        const params = new URLSearchParams(searchParams.toString())
        const newCats = currentCategories.filter(i => i !== c)
        params.delete("categories")
        newCats.forEach(i => params.append("categories", i))
        router.replace(`${pathname}?${params.toString()}`)
    }

    const removeOrigin = (o: string) => {
        const params = new URLSearchParams(searchParams.toString())
        const newOrigins = currentOrigins.filter(i => i !== o)
        params.delete("origins")
        newOrigins.forEach(i => params.append("origins", i))
        router.replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full md:w-auto">
                    <TabsList>
                        <TabsTrigger value="inbox" className="relative">
                            Inbox
                            {inboxCount > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] px-1">
                                    {inboxCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="library">Biblioteca</TabsTrigger>
                        <TabsTrigger value="clipper">Web Clipper</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-1 items-center gap-2 md:justify-end">
                    <div className="relative w-full md:w-[250px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar produtos..."
                            className="pl-8"
                            defaultValue={currentSearch}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>

                    {/* SORT SELECT */}
                    <Select value={currentSort} onValueChange={handleSortChange}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Ordenar" />
                        </SelectTrigger>
                        <SelectContent>
                            {sortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* FILTER POPOVER */}
                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className={cn(
                                (currentCategories.length > 0 || currentOrigins.length > 0) && "border-primary text-primary"
                            )}>
                                <Filter className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                            <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Categorias</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {categoryOptions.map((category) => (
                                            <div key={category} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`cat-${category}`}
                                                    checked={selectedCategories.includes(category)}
                                                    onCheckedChange={() => toggleCategory(category)}
                                                />
                                                <label
                                                    htmlFor={`cat-${category}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {category}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Origem</h4>
                                    <div className="flex flex-col gap-2">
                                        {originOptions.map((origin) => (
                                            <div key={origin} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`org-${origin}`}
                                                    checked={selectedOrigins.includes(origin)}
                                                    onCheckedChange={() => toggleOrigin(origin)}
                                                />
                                                <label
                                                    htmlFor={`org-${origin}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {origin}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 border-t bg-muted/50">
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    Limpar
                                </Button>
                                <Button size="sm" onClick={applyFilters}>
                                    Aplicar
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* ACTIVE FILTERS BADGES */}
            {(currentCategories.length > 0 || currentOrigins.length > 0) && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-muted-foreground mr-1">Filtros ativos:</span>
                    {currentCategories.map(cat => (
                        <Badge key={cat} variant="secondary" className="h-6 px-2 gap-1" onClick={() => removeCategory(cat)}>
                            {cat}
                            <span className="ml-1 cursor-pointer hover:text-foreground">×</span>
                        </Badge>
                    ))}
                    {currentOrigins.map(origin => (
                        <Badge key={origin} variant="secondary" className="h-6 px-2 gap-1" onClick={() => removeOrigin(origin)}>
                            {origin}
                            <span className="ml-1 cursor-pointer hover:text-foreground">×</span>
                        </Badge>
                    ))}
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete("categories")
                        params.delete("origins")
                        router.replace(`${pathname}?${params.toString()}`)
                    }}>
                        Limpar tudo
                    </Button>
                </div>
            )}
        </div>
    )
}
