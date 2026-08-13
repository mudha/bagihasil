type PrismaTransactionRunner = {
    $transaction<T>(
        operation: (tx: any) => Promise<T>,
        options: { isolationLevel: "Serializable" }
    ): Promise<T>
}

function isWriteConflict(error: unknown): error is { code: string } {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "P2034"
}

export async function runSerializableTransaction<T>(
    prisma: PrismaTransactionRunner,
    operation: (tx: any) => Promise<T>,
    maxAttempts = 3
): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await prisma.$transaction(operation, {
                isolationLevel: "Serializable",
            })
        } catch (error) {
            if (!isWriteConflict(error) || attempt === maxAttempts) {
                throw error
            }
        }
    }

    throw new Error("Serializable transaction retry limit reached")
}
