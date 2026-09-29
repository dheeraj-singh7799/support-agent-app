/**
 * Security & Sanitization Utilities
 * Handles safe URL validation, dangerous protocol stripping, and HTML sanitization.
 */

// Permitted protocols for external links
const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:'];

export interface UrlValidationResult {
  isSafe: boolean;
  sanitizedUrl?: string;
  reason?: string;
}

/**
 * Validates external URLs against XSS and malicious scheme vectors (e.g., javascript:, data:, intent:)
 */
export function validateUrl(url: string | null | undefined): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { isSafe: false, reason: 'Empty or missing URL' };
  }

  const trimmed = url.trim();

  // Explicitly disallow javascript: and data: URIs
  if (/^javascript:/i.test(trimmed)) {
    return { isSafe: false, reason: 'Blocked dangerous javascript: pseudo-protocol' };
  }

  if (/^data:/i.test(trimmed)) {
    return { isSafe: false, reason: 'Blocked data: URI scheme' };
  }

  // Intercept raw Android intent: schemes which could trigger unauthenticated actions
  if (/^intent:/i.test(trimmed)) {
    return { isSafe: false, reason: 'Arbitrary intent: URLs are blocked for security' };
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_PROTOCOLS.includes(parsed.protocol.toLowerCase())) {
      return { isSafe: false, reason: `Protocol ${parsed.protocol} is not permitted` };
    }
    return { isSafe: true, sanitizedUrl: trimmed };
  } catch {
    // If URL constructor fails, test for relative or http/https without modern constructor
    if (/^https?:\/\//i.test(trimmed)) {
      return { isSafe: true, sanitizedUrl: trimmed };
    }
    return { isSafe: false, reason: 'Malformed URL' };
  }
}

/**
 * Strips script tags, evil event handlers (onerror, onload, etc.), and javascript: from HTML strings.
 */
export function sanitizeHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') {
    return '';
  }

  let clean = dirtyHtml;

  // 1. Remove <script> tags and contents
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Remove <iframe>, <object>, <embed>, <applet>, <form>, <input>
  clean = clean.replace(/<(iframe|object|embed|applet|form|input|button)\b[^>]*>/gi, '');
  clean = clean.replace(/<\/(iframe|object|embed|applet|form|input|button)>/gi, '');

  // 3. Remove dangerous attributes like onerror=, onclick=, onload=, onmouseover=, etc.
  clean = clean.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 4. Remove javascript: pseudo-protocol in href or src attributes
  clean = clean.replace(/(href|src)\s*=\s*(?:["']\s*javascript:[^"']*["']|javascript:[^\s>]+)/gi, '$1="#"');

  return clean;
}

/**
 * Simple text extraction for summaries or plain previews (strips all HTML tags)
 */
export function stripHtmlToText(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
