import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const unitsPage = readFileSync('src/app/dashboard/units/page.tsx', 'utf8')

describe('unit list mobile affordance', () => {
    it('exposes an explicit Detail button that opens the unit viewer', () => {
        expect(unitsPage).toContain('setViewingUnit(unit)')
        expect(unitsPage).toContain('<Eye className="mr-1.5 h-4 w-4" /> Detail')
    })

    it('does not use a route link as the mobile detail access point', () => {
        expect(unitsPage).not.toMatch(/Link href=\`\/dashboard\/units\/\$\{/)
    })
})
