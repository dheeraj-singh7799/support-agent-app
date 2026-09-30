import { validateUrl, sanitizeHtml, stripHtmlToText } from '../src/services/security/sanitizer';

describe('Security Sanitization & URL Whitelist Verification', () => {
  describe('URL Scheme Whitelisting', () => {
    test('blocks dangerous javascript: pseudo-protocol (test case T-2003)', () => {
      const maliciousUrl = 'javascript:alert(document.cookie)';
      const result = validateUrl(maliciousUrl);

      expect(result.isSafe).toBe(false);
      expect(result.reason).toContain('javascript:');
    });

    test('blocks dangerous Android intent: schemes (test case T-2009)', () => {
      const intentUrl = 'intent://settings#Intent;scheme=android;end';
      const result = validateUrl(intentUrl);

      expect(result.isSafe).toBe(false);
      expect(result.reason).toContain('intent:');
    });

    test('permits valid HTTPS URLs (test cases T-2002 and T-2010)', () => {
      const safeInvoice = 'https://example.com/invoice';
      const resInvoice = validateUrl(safeInvoice);
      expect(resInvoice.isSafe).toBe(true);
      expect(resInvoice.sanitizedUrl).toBe(safeInvoice);

      const safeScreenshot = 'https://files.example.com/screenshots/export-bug.png';
      const resScreenshot = validateUrl(safeScreenshot);
      expect(resScreenshot.isSafe).toBe(true);
      expect(resScreenshot.sanitizedUrl).toBe(safeScreenshot);
    });

    test('handles empty or malformed URLs gracefully', () => {
      expect(validateUrl(null).isSafe).toBe(false);
      expect(validateUrl('').isSafe).toBe(false);
      expect(validateUrl('invalid-url-with-no-protocol').isSafe).toBe(false);
    });
  });

  describe('HTML Body & Summary Sanitization', () => {
    test('strips dangerous event handlers (onerror in T-2002 and T-2011)', () => {
      const dirtyBody = `<img src=x onerror="alert('hacked')"> I was charged twice. <a href="https://example.com/invoice">Invoice</a>`;
      const clean = sanitizeHtml(dirtyBody);

      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('I was charged twice.');
      expect(clean).toContain('href="https://example.com/invoice"');
    });

    test('strips inline <script> tags and payloads', () => {
      const xss = `Normal text <script>window.location='https://evil.com'</script> trailing text`;
      const clean = sanitizeHtml(xss);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('evil.com');
      expect(clean).toContain('Normal text');
      expect(clean).toContain('trailing text');
    });

    test('strips HTML to pure text for plain summaries', () => {
      const rich = `<b>Refund</b> needed &amp; requested.`;
      const plain = stripHtmlToText(rich);

      expect(plain).toBe('Refund needed & requested.');
      expect(plain).not.toContain('<b>');
    });
  });
});
