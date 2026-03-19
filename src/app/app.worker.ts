/// <reference lib="webworker" />

import { encode } from 'gpt-tokenizer';

// --- Types ---

type WorkerAction = 'TOKENIZE' | 'UPDATE_FILES' | 'SEARCH';

interface WorkerMessage {
  action: WorkerAction;
  payload: any;
  id?: string;
}

interface SimpleFile {
  name: string;
  path: string;
  lowerName: string;
  lowerPath: string;
}

interface SearchParams {
  query: string;
  includes: string[];
  excludes: string[];
  limit: number;
}

interface TokenRequest {
  id: string;
  content: string;
  priority?: boolean;
}

// --- State ---

const tokenQueue: { id: string; content: string; priority: boolean }[] = [];
let isTokenizing = false;
let fileCache: SimpleFile[] = [];
const patternRegexCache = new Map<string, RegExp>();

// --- Token Logic ---

function processTokenQueue() {
  if (isTokenizing || tokenQueue.length === 0) return;
  isTokenizing = true;

  tokenQueue.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
  const request = tokenQueue.shift()!;

  try {
    if (!request.content) {
      postMessage({ action: 'TOKEN_RESULT', id: request.id, count: 0 });
      setTimeout(processTokenQueue, 0);
      return;
    }

    try {
      const tokens = encode(request.content);
      postMessage({ action: 'TOKEN_RESULT', id: request.id, count: tokens.length });
    } catch (e) {
      postMessage({ action: 'TOKEN_RESULT', id: request.id, count: 0 });
    }

    setTimeout(processTokenQueue, 0);
  } finally {
    isTokenizing = false;
  }
}

// --- Regex Helpers (Inlined to ensure they work) ---

function getRegex(pattern: string): RegExp {
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

  regexStr = '.*' + regexStr;

  const regex = new RegExp(regexStr, 'i');
  patternRegexCache.set(pattern, regex);
  return regex;
}

function matchesExclude(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;

  for (const pattern of patterns) {
    // Fast path
    if (pattern.endsWith('/') && filePath.includes(pattern)) return true;
    // Regex path
    try {
      if (getRegex(pattern).test(filePath)) return true;
    } catch (e) {
      continue;
    }
  }
  return false;
}

// --- Search Logic ---

function performSearch(params: SearchParams) {
  const { query, includes, excludes, limit } = params;
  const lowerQuery = query.toLowerCase().trim();
  const results: SimpleFile[] = [];

  // Iterate!
  for (const file of fileCache) {
    // 1. INCLUDES
    if (includes.length > 0) {
      let isIncluded = false;
      for (const inc of includes) {
        if (file.path.startsWith(inc + '/') || file.path === inc) {
          isIncluded = true;
          break;
        }
      }
      if (!isIncluded) continue;
    }

    // 2. EXCLUDES
    if (excludes.length > 0 && matchesExclude(file.path, excludes)) {
      continue;
    }

    // 3. QUERY MATCH
    if (lowerQuery) {
      if (!file.lowerName.includes(lowerQuery) && !file.lowerPath.includes(lowerQuery)) {
        continue;
      }
    }

    results.push(file);
    if (results.length >= limit) break;
  }

  postMessage({ action: 'SEARCH_RESULT', results });
}

// --- Handler ---

addEventListener('message', ({ data }: { data: WorkerMessage | TokenRequest }) => {
  // Legacy support
  if ('id' in data && 'content' in data && !('action' in data)) {
    const req = data as TokenRequest;
    tokenQueue.push({ id: req.id, content: req.content, priority: req.priority || false });
    if (!isTokenizing) processTokenQueue();
    return;
  }

  const message = data as WorkerMessage;

  switch (message.action) {
    case 'TOKENIZE':
      tokenQueue.push(message.payload);
      if (!isTokenizing) processTokenQueue();
      break;

    case 'UPDATE_FILES':
      // Populate the cache for search
      fileCache = message.payload.map((f: any) => ({
        name: f.name,
        path: f.path,
        lowerName: f.name.toLowerCase(),
        lowerPath: f.path.toLowerCase(),
      }));
      patternRegexCache.clear();
      break;

    case 'SEARCH':
      performSearch(message.payload);
      break;
  }
});
