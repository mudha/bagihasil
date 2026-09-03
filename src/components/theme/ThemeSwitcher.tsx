"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"

type ThemeOption = "light" | "dark" | "system"

const themes: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Terang" },
  { value: "dark", icon: Moon, label: "Gelap" },
  { value: "system", icon: Monitor, label: "Sistem" },
]

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <span
        className="inline-flex h-10 w-10 items-center justify-center"
        aria-hidden="true"
      >
        <Monitor className="size-4 opacity-0" />
      </span>
    )
  }

  const currentTheme: ThemeOption =
    theme === "dark" || theme === "light" || theme === "system"
      ? theme
      : "system"

  return (
    <div
      role="radiogroup"
      aria-label="Ganti tema"
      className="inline-flex gap-1 rounded-lg border border-border bg-muted p-1"
    >
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={currentTheme === value}
          aria-label={label}
          onClick={() => setTheme(value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          data-state={currentTheme === value ? "on" : "off"}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
