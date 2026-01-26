import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    fileType?: string;
}

/**
 * Compresses an image file if it exceeds the maximum size.
 * @param file The image file to compress.
 * @param options Compression options.
 * @returns The compressed file or the original file if compression fails or is unnecessary.
 */
export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    // Default options
    const defaultOptions = {
        maxSizeMB: 0.5, // 500KB
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: 'image/jpeg',
        ...options
    };

    // If file is already smaller than limit (approx), just return it
    // Note: maxSizeMB is in MB, file.size is in bytes
    if (file.size <= defaultOptions.maxSizeMB * 1024 * 1024) {
        return file;
    }

    try {
        const compressedFile = await imageCompression(file, defaultOptions);
        return compressedFile;
    } catch (error) {
        console.error('Image compression failed:', error);
        // Fallback to original file
        return file;
    }
}
