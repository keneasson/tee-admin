import { PDFiumLibrary } from '@hyzyla/pdfium'
import sharp from 'sharp'

/**
 * Generate a JPEG thumbnail of page 1 of a PDF.
 *
 * Runs entirely in-process: pdfium (WASM) rasterizes the first page to an RGBA
 * bitmap, sharp downscales it and encodes a JPEG. No new AWS service required —
 * most of our posters arrive as PDFs and need a real image to show as the
 * "link" preview in the web and email views.
 *
 * Best-effort: returns `null` on any failure so the caller can fall back to a
 * generic file/link affordance rather than failing the whole upload.
 */
export async function generatePdfThumbnail(
  pdfBuffer: Buffer,
  options: { width?: number; quality?: number } = {}
): Promise<Buffer | null> {
  const targetWidth = options.width ?? 600
  const quality = options.quality ?? 80

  let library: Awaited<ReturnType<typeof PDFiumLibrary.init>> | null = null
  let document: Awaited<ReturnType<PDFiumLibrary['loadDocument']>> | null = null

  try {
    library = await PDFiumLibrary.init()
    document = await library.loadDocument(new Uint8Array(pdfBuffer))

    if (document.getPageCount() < 1) return null

    const page = document.getPage(0)
    const { originalWidth } = page.getOriginalSize()

    // Render at ~2x the target width (capped) so the downscale stays crisp,
    // while keeping memory bounded for large-format pages.
    const renderWidth = Math.min(targetWidth * 2, 1600)
    const scale = originalWidth > 0 ? renderWidth / originalWidth : 2

    // 'bitmap' returns RGBA bytes (pdfium's BGRA is converted internally).
    const { width, height, data } = await page.render({ scale, render: 'bitmap' })

    const jpeg = await sharp(Buffer.from(data), {
      raw: { width, height, channels: 4 },
    })
      .flatten({ background: '#ffffff' }) // posters are opaque; drop the alpha onto white
      .resize({ width: targetWidth, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    return jpeg
  } catch (error) {
    console.error('PDF thumbnail generation failed:', error)
    return null
  } finally {
    try {
      document?.destroy()
    } catch {
      // ignore
    }
    try {
      library?.destroy()
    } catch {
      // ignore
    }
  }
}
