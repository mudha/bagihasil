"use client"

import { createContext, useContext } from "react"

export type PortalLayer = "base" | "modal"

const PortalLayerContext = createContext<PortalLayer>("base")

export function PortalLayerProvider({
  children,
  layer = "modal",
}: {
  children: React.ReactNode
  layer?: PortalLayer
}) {
  return <PortalLayerContext.Provider value={layer}>{children}</PortalLayerContext.Provider>
}

export function usePortalLayer() {
  return useContext(PortalLayerContext)
}
