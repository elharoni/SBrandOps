/**
 * Client-side PDF text extraction using PDF.js.
 * Runs entirely in the browser — no Edge Function call, no body size limit.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Point to the bundled worker via Vite's ?url import
// @ts-ignore — Vite resolves this at build time
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extracts plain text from a PDF File object.
 * Returns the concatenated text of all pages (up to maxChars characters).
 */
export async function extractTextFromPdf(
    file: File,
    maxChars = 25_000,
): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const parts: string[] = [];
    let total = 0;

    for (let p = 1; p <= pdf.numPages && total < maxChars; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .join(' ');
        parts.push(pageText);
        total += pageText.length;
    }

    return parts.join('\n').slice(0, maxChars);
}
