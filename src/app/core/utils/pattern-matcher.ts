/**
 * Pure utility functions for handling glob patterns and file matching.
 * Used by both the UI (for conflict detection) and the Worker (for search).
 */

const patternRegexCache = new Map<string, RegExp>();

export function getRegex(pattern: string): RegExp {
  if (patternRegexCache.has(pattern)) {
    return patternRegexCache.get(pattern)!;
  }

  const normalized = pattern.trim();
  const isDirectory = normalized.endsWith('/');
  let patternToConvert = isDirectory ? normalized.slice(0, -1) : normalized;

  // Convert glob to regex
  let regexStr = patternToConvert
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*');

  if (isDirectory) {
    regexStr = regexStr + '/.*';
  }
  
  // Allow matching anywhere in path (prefix with .*)
  regexStr = '.*' + regexStr;

  const regex = new RegExp(regexStr, 'i'); // Case insensitive
  patternRegexCache.set(pattern, regex);
  return regex;
}

/**
 * Synchronous check if a file path matches a specific exclude pattern
 */
export function matchesExcludePattern(filePath: string, pattern: string): boolean {
  // Fast path: simple directory check
  if (pattern.endsWith('/') && filePath.includes(pattern)) return true;
  
  // Regex check
  try {
    return getRegex(pattern).test(filePath);
  } catch {
    return false;
  }
}

/**
 * Clear the regex cache (useful when loading a new project)
 */
export function clearPatternCache(): void {
  patternRegexCache.clear();
}

