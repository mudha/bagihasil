/**
 * Utility functions for image handling in the application
 */

/**
 * Convert image URL to base64 data URL for PDF embedding
 * Supports both local paths and external URLs
 */
export async function convertImageToBase64(url: string): Promise<string> {
    try {
        // Handle local public URLs
        const imageUrl = url.startsWith('/') ? url : `/${url}`

        const response = await fetch(imageUrl)
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`)
        }

        const blob = await response.blob()

        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
                const base64String = reader.result as string
                resolve(base64String)
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    } catch (error) {
        console.error('Error converting image to base64:', error)
        throw error
    }
}

/**
 * Validate image file type and size
 * @param file - File to validate
 * @returns true if valid, false otherwise
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    const maxSizeInBytes = 5 * 1024 * 1024 // 5MB

    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Tipe file tidak valid. Hanya JPG, PNG, dan PDF yang diperbolehkan.'
        }
    }

    if (file.size > maxSizeInBytes) {
        return {
            valid: false,
            error: 'Ukuran file terlalu besar. Maksimal 5MB.'
        }
    }

    return { valid: true }
}

/**
 * Generate unique filename with timestamp and random string
 * @param originalName - Original filename
 * @returns Unique filename
 */
export function generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const extension = originalName.split('.').pop()

    return `proof_${timestamp}_${randomString}.${extension}`
}

/**
 * Format file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
