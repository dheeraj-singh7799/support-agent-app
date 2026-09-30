import React from 'react';
import { View, Text, StyleSheet, Linking, useColorScheme } from 'react-native';
import { sanitizeHtml, validateUrl } from '@/services/security/sanitizer';

interface HtmlViewerProps {
  html: string | null | undefined;
  fallbackText?: string;
}

interface TextSegment {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  linkUrl?: string;
}

export function HtmlViewer({ html, fallbackText = '(No content provided)' }: HtmlViewerProps) {
  const isDark = useColorScheme() === 'dark';

  if (!html || html.trim().length === 0) {
    return (
      <Text style={[styles.fallback, { color: isDark ? '#94A3B8' : '#64748B' }]}>
        {fallbackText}
      </Text>
    );
  }

  // 1. Sanitize to eradicate XSS scripts & onerror handlers
  const sanitized = sanitizeHtml(html);

  // 2. Parse basic inline tags: <b>, <strong>, <i>, <em>, <a href="...">
  const segments = parseInlineHtml(sanitized);

  const handleOpenLink = (url: string) => {
    const check = validateUrl(url);
    if (check.isSafe && check.sanitizedUrl) {
      Linking.openURL(check.sanitizedUrl).catch((err) => {
        console.warn('Could not open link:', err);
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.baseText, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
        {segments.map((seg, idx) => {
          if (seg.linkUrl) {
            return (
              <Text
                key={idx}
                onPress={() => handleOpenLink(seg.linkUrl!)}
                style={[
                  styles.linkText,
                  seg.isBold && styles.bold,
                  seg.isItalic && styles.italic,
                ]}
              >
                {seg.text}
              </Text>
            );
          }

          return (
            <Text
              key={idx}
              style={[
                seg.isBold && styles.bold,
                seg.isItalic && styles.italic,
              ]}
            >
              {seg.text}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

/**
 * Lightweight inline HTML tokenizer for React Native Text components
 */
function parseInlineHtml(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Tokenize by HTML tags: <...>, while capturing
  const tagRegex = /(<[^>]+>)/g;
  const parts = html.split(tagRegex);

  let isBold = false;
  let isItalic = false;
  let currentLink: string | undefined = undefined;

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('<') && part.endsWith('>')) {
      const lower = part.toLowerCase();

      if (lower === '<b>' || lower === '<strong>') {
        isBold = true;
      } else if (lower === '</b>' || lower === '</strong>') {
        isBold = false;
      } else if (lower === '<i>' || lower === '<em>') {
        isItalic = true;
      } else if (lower === '</i>' || lower === '</em>') {
        isItalic = false;
      } else if (lower.startsWith('<a ')) {
        const hrefMatch = part.match(/href=["']([^"']*)["']/i);
        if (hrefMatch) {
          currentLink = hrefMatch[1];
        }
      } else if (lower === '</a>') {
        currentLink = undefined;
      } else if (lower === '<br>' || lower === '<br/>' || lower === '<br />') {
        segments.push({ text: '\n' });
      } else if (lower === '<p>' || lower === '<div>') {
        if (segments.length > 0) segments.push({ text: '\n\n' });
      }
    } else {
      // Decode standard HTML entities
      const unescaped = part
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

      segments.push({
        text: unescaped,
        isBold,
        isItalic,
        linkUrl: currentLink,
      });
    }
  }

  return segments;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  baseText: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'auto', // Supports RTL and LTR
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  linkText: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  fallback: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
