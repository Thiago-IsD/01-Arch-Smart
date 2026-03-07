"use client"

import { useState } from "react"
import { MapPin, X, ChevronLeft, ChevronRight } from "lucide-react"

export function EnvironmentGallery({
    images,
    title,
    environmentName
}: {
    images: string[],
    title: string,
    environmentName: string
}) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

    if (!images || images.length === 0) return null

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % images.length)
        }
    }

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + images.length) % images.length)
        }
    }

    return (
        <>
            {/* Thumbnail Grid */}
            <div className={`grid gap-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {images.map((url, idx) => (
                    <div
                        key={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className={`rounded-xl overflow-hidden bg-slate-200 cursor-pointer group relative ${images.length === 1 ? "aspect-video" : "aspect-square"
                            } ${images.length === 3 && idx === 0 ? "col-span-2 aspect-video" : ""}`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt={`${title} — imagem ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    </div>
                ))}
            </div>

            {/* Lightbox / Albums Fullscreen Overlay */}
            {selectedIndex !== null && (
                <div
                    className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4"
                    onClick={() => setSelectedIndex(null)}
                >
                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white/80 bg-gradient-to-b from-black/50 to-transparent">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium tracking-wide">
                                {selectedIndex + 1} / {images.length}
                            </span>
                            <div className="h-4 w-px bg-white/20" />
                            <div className="flex items-center gap-1.5 text-emerald-400">
                                <MapPin className="w-4 h-4" />
                                <span className="text-sm font-medium">{environmentName}</span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedIndex(null); }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Main Image View */}
                    <div className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center mt-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={images[selectedIndex]}
                            alt={`${title} (ampliada)`}
                            className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm"
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Navigation Arrows (only if more than 1 image) */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrev}
                                    className="absolute left-0 md:-left-12 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all border border-white/10 backdrop-blur-sm"
                                >
                                    <ChevronLeft className="w-8 h-8" />
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="absolute right-0 md:-right-12 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all border border-white/10 backdrop-blur-sm"
                                >
                                    <ChevronRight className="w-8 h-8" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
