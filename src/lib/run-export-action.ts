export interface ExportResult {
    success: boolean
    error?: string
}

export interface ExportToast {
    loading: (message: string) => string | number
    dismiss: (id: string | number) => void
    success: (message: string) => void
    error: (message: string) => void
}

interface RunExportActionOptions {
    loadingMessage: string
    successMessage: string
    fallbackErrorMessage: string
    thrownErrorMessage: string
    run: () => Promise<ExportResult>
    onStart: () => void
    onFinish: () => void
    toast: ExportToast
}

export async function runExportAction({
    loadingMessage,
    successMessage,
    fallbackErrorMessage,
    thrownErrorMessage,
    run,
    onStart,
    onFinish,
    toast,
}: RunExportActionOptions) {
    onStart()
    const loadingToastId = toast.loading(loadingMessage)

    try {
        const result = await run()
        toast.dismiss(loadingToastId)

        if (result.success) {
            toast.success(successMessage)
        } else {
            toast.error(result.error || fallbackErrorMessage)
        }

        return result
    } catch {
        toast.dismiss(loadingToastId)
        toast.error(thrownErrorMessage)
        return { success: false, error: thrownErrorMessage }
    } finally {
        onFinish()
    }
}
