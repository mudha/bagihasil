"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

type ThemeOption = "light" | "dark" | "system"

const themes: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Terang" },
  { value: "dark", icon: Moon, label: "Gelap" },
  { value: "system", icon: Monitor, label: "Sistem" },
]

export function ThemeSwitcher({ inverse = false }: { inverse?: boolean }) {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <span
        className="inline-flex h-[52px] w-[148px] items-center justify-center"
        aria-hidden="true"
      >
        <Monitor className="size-4 opacity-0" />
      </span>
    )
  }

  const currentTheme: ThemeOption =
    theme === "dark" || theme === "light" || theme === "system"
      ? theme
      : "light"

  return (
    <div
      role="radiogroup"
      aria-label="Ganti tema"
      className={cn(
        "inline-flex gap-1 rounded-lg border p-1",
        inverse ? "border-white/15 bg-white/10" : "border-border bg-muted"
      )}
    >
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={currentTheme === value}
          aria-label={label}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
            inverse
              ? "text-teal-100 hover:bg-white/10 hover:text-white focus-visible:ring-white/60 data-[state=on]:bg-white data-[state=on]:text-teal-950 data-[state=on]:shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          )}
          data-state={currentTheme === value ? "on" : "off"}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
