import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("src/app/dashboard/units/page.tsx", "utf8")

describe("Mudha operational unit list contract", () => {
  it("uses the compact operational header and four summary metrics", () => {
    expect(source).toContain('<OperationalPageHeader')
    expect(source).toContain('title="Unit Kendaraan"')
    expect(source).toContain('label="Total"')
    expect(source).toContain('label="Aktif"')
    expect(source).toContain('label="Terjual"')
    expect(source).toContain('label="Servis"')
    expect(source).not.toContain("Garage view")
    expect(source).not.toContain("Semua kendaraan, lebih gampang dipantau.")
    expect(source).not.toContain("<Sparkles")
    expect(source).not.toContain('bg-[#073f3b]')
    expect(source).not.toContain("shadow-2xl shadow-teal-950/15")
  })

  it("has explicit primary loading/error/loaded branches with response validation and retry", () => {
    expect(source).toContain("const [unitsLoading, setUnitsLoading] = useState(true)")
    expect(source).toContain("const [unitsError, setUnitsError] = useState<string | null>(null)")
    expect(source).toContain("if (!res.ok) throw new Error('Gagal memuat data unit')")
    expect(source).toContain('<LoadingState variant="table" label="Memuat data unit..." />')
    expect(source).toContain('<ErrorState title="Gagal memuat data unit" description={unitsError} onRetry={fetchUnits} />')
    expect(source).toContain('loading={unitsLoading || !!unitsError}')
    expect(source).toContain("setUnitsLoading(false)")
    expect(source).toContain("setUnitsError(null)")
  })

  it("keeps permitted actions before the list state gate and preserves domain wiring", () => {
    expect(source.indexOf("<ImportUnitsDialog")).toBeGreaterThan(-1)
    expect(source.indexOf("<ImportUnitsDialog")).toBeLessThan(source.indexOf("{unitsLoading ?"))
    expect(source).toContain("<UnitCardMobile")
    expect(source).toContain("<AdminUnitDetailDialog")
    expect(source).toContain("onDetail=")
    expect(source).toContain("onEdit=")
    expect(source).toContain("onDelete=")
    expect(source).toContain("<PaginationControls")
    expect(source).toContain("selectedIds")
  })
})
