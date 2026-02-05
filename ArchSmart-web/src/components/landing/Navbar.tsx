'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Equal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import React from 'react'
import { cn } from '@/lib/utils'
import { BRAND_ASSETS } from '@/config/brand'
import { ModeToggle } from '@/components/theme-toggle'

import { LANDING_MENU_ITEMS } from '@/config/navigation'

export const Navbar = () => {
    const [menuState, setMenuState] = React.useState(false)
    const [isScrolled, setIsScrolled] = React.useState(false)

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <nav
                data-state={menuState && 'active'}
                className="w-full px-4 group">
                <div className={cn('mx-auto max-w-7xl px-4 transition-all duration-300', isScrolled && '')}>
                    <div className="relative flex flex-wrap items-center justify-between py-4">
                        <div className="flex w-full justify-between lg:w-auto">
                            <Link
                                href="/"
                                aria-label="home"
                                className="flex gap-2 items-center">
                                <Image
                                    src={BRAND_ASSETS.horizontal}
                                    alt="Arch Smart"
                                    width={140}
                                    height={40}
                                    className="h-8 w-auto object-contain"
                                    unoptimized
                                />
                            </Link>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState == true ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                                <Equal className="group-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
                            </button>
                        </div>

                        <div className="hidden lg:block">
                            <ul className="flex gap-8 text-sm font-medium">
                                {LANDING_MENU_ITEMS.map((item, index) => (
                                    <li key={index}>
                                        <Link
                                            href={item.href}
                                            className="text-muted-foreground hover:text-primary transition-colors">
                                            <span>{item.name}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-background group-data-[state=active]:block lg:group-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-primary/5 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-4 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
                                    {LANDING_MENU_ITEMS.map((item, index) => (
                                        <li key={index}>
                                            <Link
                                                href={item.href}
                                                className="text-muted-foreground hover:text-primary block transition-colors">
                                                <span>{item.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-4 sm:space-y-0 md:w-fit items-center">
                                <ModeToggle />
                                <Button
                                    asChild
                                    variant="ghost"
                                >
                                    <Link href="/auth/login">
                                        <span>Entrar</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                >
                                    <Link href="/auth/register">
                                        <span>Criar Conta</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}