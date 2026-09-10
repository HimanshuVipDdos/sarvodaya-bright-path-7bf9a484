/**
 * Utilities for normalizing and embedding PDF / Google Drive / Office documents
 * safely inside the Sarvodaya web portal.
 */

const DRIVE_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]+)/i,
  /[?&]id=([a-zA-Z0-9_-]+)/i,
  /[?&]srcid=([a-zA-Z0-9_-]+)/i,
  /\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i,
];

const RAW_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{25,55}$/;

/**
 * Extracts Google Drive file ID from any URL format, raw ID, or iframe snippet.
 */
export function extractDriveFileId(input: string | null | undefined): string | null {
  if (!input) return null;
  let target = input.trim();

  // If iframe snippet was pasted: <iframe src="...">
  const iframeMatch = target.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    target = iframeMatch[1].trim();
  }

  // Check raw file ID
  if (RAW_FILE_ID_REGEX.test(target)) {
    return target;
  }

  // Check all known Google Drive / Docs URL patterns
  for (const pattern of DRIVE_PATTERNS) {
    const match = target.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Checks if the given string represents a Google Drive or Google Docs link.
 */
export function isGoogleDriveLink(input: string | null | undefined): boolean {
  return extractDriveFileId(input) !== null;
}

/**
 * Normalizes any PDF / document input URL so that:
 * - Google Drive links are always converted to the official, embeddable /preview format.
 * - Missing protocols (e.g. drive.google.com/...) are prepended with https://.
 */
export function normalizePdfUrl(input: string | null | undefined): string {
  if (!input) return "";
  let url = input.trim();

  // Strip iframe tags if pasted
  const iframeMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    url = iframeMatch[1].trim();
  }

  const driveId = extractDriveFileId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }

  // Prepend https:// if domain lacks protocol
  if (/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(url) && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  return url;
}

/**
 * Converts a document URL into an iframe-embeddable URL.
 * Supports Google Drive preview, Google Docs Viewer wrapper for direct PDFs,
 * and direct embeddable streams.
 */
export function toEmbeddableDocumentUrl(url: string | null | undefined): string {
  if (!url) return "";
  const clean = normalizePdfUrl(url);
  if (!clean) return "";

  // Google Drive preview URL is directly embeddable
  const driveId = extractDriveFileId(clean);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }

  try {
    const u = new URL(clean);
    // Direct PDF or unknown document type -> Google Docs Viewer embeds it seamlessly
    if (/\.pdf(\?|#|$)/i.test(u.pathname) || !/\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(u.pathname)) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(clean)}&embedded=true`;
    }
  } catch {}

  return clean;
}
