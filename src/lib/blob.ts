import { put, del } from '@vercel/blob';

/**
 * Upload an image to Vercel Blob storage.
 * Returns the public CDN URL.
 */
export async function uploadImage(
  file: File | Blob,
  lojaId: number,
  filename: string
): Promise<string> {
  const pathname = `lojas/${lojaId}/${Date.now()}-${filename}`;
  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: false,
  });
  return blob.url;
}

/**
 * Delete an image from Vercel Blob storage.
 * Silently ignores errors (image may already be deleted).
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    if (url && url.includes('blob.vercel-storage.com')) {
      await del(url);
    }
  } catch {
    // Ignore - blob may already be deleted
  }
}
