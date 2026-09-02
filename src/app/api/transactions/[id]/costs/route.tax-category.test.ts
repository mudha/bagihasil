import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const costCreate = vi.fn()
  const costFindFirst = vi.fn()
  const costUpdate = vi.fn()
  const transactionFindUnique = vi.fn()
  const transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
    cost: { update: costUpdate },
    transaction: { findUnique: transactionFindUnique, update: vi.fn() },
    profitSharing: { update: vi.fn() },
  }))
  return {
    requireAdmin: vi.fn(async () => ({ session: { user: { id: "synthetic-admin" } } })),
    costCreate,
    costFindFirst,
    costUpdate,
    transactionFindUnique,
    transaction,
  }
})

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/cost-types", () => ({
  CREATE_COST_TYPE_VALUES: [
    "INSPECTION", "TRANSPORT", "MEAL", "TOLL", "ADS", "REPAIR",
    "GAS", "PARKING", "STAMP_DUTY", "BROKER", "TAX", "OTHER",
  ],
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cost: { create: mocks.costCreate, findFirst: mocks.costFindFirst },
    $transaction: mocks.transaction,
  },
}))

import { POST } from "./route"
import { PUT } from "./[costId]/route"

const params = { params: Promise.resolve({ id: "synthetic-transaction" }) }
const updateParams = { params: Promise.resolve({ id: "synthetic-transaction", costId: "synthetic-cost" }) }

function request(method: "POST" | "PUT", costType: string) {
  return new Request("http://local.invalid", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ costType, payer: "MANAGER", amount: 125000, description: "synthetic" }),
  })
}

describe("Pajak Cost API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.costCreate.mockImplementation(async ({ data }) => ({ id: "synthetic-cost", ...data }))
    mocks.costFindFirst.mockResolvedValue({ id: "synthetic-cost", transactionId: "synthetic-transaction", amount: 125000 })
    mocks.costUpdate.mockImplementation(async ({ data }) => ({ id: "synthetic-cost", ...data }))
    mocks.transactionFindUnique.mockResolvedValue({ status: "ON_PROCESS" })
  })

  it("POST accepts and persists the canonical TAX payload", async () => {
    const response = await POST(request("POST", "TAX"), params)
    expect(response!.status).toBe(200)
    expect(mocks.costCreate).toHaveBeenCalledTimes(1)
    expect(mocks.costCreate.mock.calls[0][0].data).toMatchObject({
      transactionId: "synthetic-transaction",
      costType: "TAX",
      payer: "MANAGER",
      amount: 125000,
      description: "synthetic",
    })
  })

  it("POST continues to reject an arbitrary category", async () => {
    const response = await POST(request("POST", "NOT_A_COST"), params)
    expect(response!.status).toBe(400)
    expect(mocks.costCreate).not.toHaveBeenCalled()
  })

  it("PUT accepts and preserves TAX", async () => {
    const response = await PUT(request("PUT", "TAX"), updateParams)
    expect(response!.status).toBe(200)
    expect(mocks.costUpdate.mock.calls[0][0].data).toMatchObject({ costType: "TAX", payer: "MANAGER", amount: 125000 })
  })

  it("PUT preserves the historical free-form contract", async () => {
    const response = await PUT(request("PUT", "UNKNOWN_LEGACY"), updateParams)
    expect(response!.status).toBe(200)
    expect(mocks.costUpdate.mock.calls[0][0].data.costType).toBe("UNKNOWN_LEGACY")
  })
})
