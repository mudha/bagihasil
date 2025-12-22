import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

type ActionType = "CREATE" | "UPDATE" | "DELETE"
type EntityType = "UNIT" | "TRANSACTION" | "INVESTOR" | "COST" | "PAYMENT"

export async function logActivity(
    action: ActionType,
    entity: EntityType,
    entityId: string,
    details: string,
    userId?: string, // Optional, can be fetched from session if not provided
    userName?: string // Optional
) {
    try {
        let finalUserId = userId
        let finalUserName = userName

        if (!finalUserId) {
            const session = await auth()
            if (session?.user?.id) {
                finalUserId = session.user.id
                finalUserName = session.user.name || "Unknown"
            } else {
                finalUserId = "SYSTEM"
                finalUserName = "System"
            }
        }

        await db.activityLog.create({
            data: {
                action,
                entity,
                entityId,
                details,
                userId: finalUserId!,
                userName: finalUserName,
            }
        })
    } catch (error) {
        console.error("Failed to log activity:", error)
        // Don't throw error to prevent blocking the main action
    }
}
