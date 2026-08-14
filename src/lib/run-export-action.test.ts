import { describe, expect, it, vi } from "vitest"
import { runExportAction } from "./run-export-action"

const makeToast = () => ({
    loading: vi.fn(() => "loading-id"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
})

const messages = {
    loadingMessage: "loading",
    successMessage: "success",
    fallbackErrorMessage: "fallback",
    thrownErrorMessage: "thrown",
}

describe("runExportAction", () => {
    it("shows success and always finishes", async () => {
        const toast = makeToast()
        const onStart = vi.fn()
        const onFinish = vi.fn()

        const result = await runExportAction({
            ...messages,
            run: vi.fn().mockResolvedValue({ success: true }),
            onStart,
            onFinish,
            toast,
        })

        expect(result).toEqual({ success: true })
        expect(onStart).toHaveBeenCalledOnce()
        expect(toast.loading).toHaveBeenCalledWith("loading")
        expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith("loading-id")
        expect(toast.success).toHaveBeenCalledExactlyOnceWith("success")
        expect(toast.error).not.toHaveBeenCalled()
        expect(onFinish).toHaveBeenCalledOnce()
    })

    it("shows the exporter error and always finishes", async () => {
        const toast = makeToast()
        const onFinish = vi.fn()

        const result = await runExportAction({
            ...messages,
            run: vi.fn().mockResolvedValue({ success: false, error: "export failed" }),
            onStart: vi.fn(),
            onFinish,
            toast,
        })

        expect(result).toEqual({ success: false, error: "export failed" })
        expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith("loading-id")
        expect(toast.success).not.toHaveBeenCalled()
        expect(toast.error).toHaveBeenCalledExactlyOnceWith("export failed")
        expect(onFinish).toHaveBeenCalledOnce()
    })

    it("handles a rejected lazy import or exporter and always finishes", async () => {
        const toast = makeToast()
        const onFinish = vi.fn()

        const result = await runExportAction({
            ...messages,
            run: vi.fn().mockRejectedValue(new Error("chunk failed")),
            onStart: vi.fn(),
            onFinish,
            toast,
        })

        expect(result).toEqual({ success: false, error: "thrown" })
        expect(toast.dismiss).toHaveBeenCalledExactlyOnceWith("loading-id")
        expect(toast.success).not.toHaveBeenCalled()
        expect(toast.error).toHaveBeenCalledExactlyOnceWith("thrown")
        expect(onFinish).toHaveBeenCalledOnce()
    })
})
