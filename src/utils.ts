// Use a counter-based approach with timestamp for better uniqueness
let idCounter = 0;

/**
 * Generate a unique ID for documents with better collision resistance
 * Format: timestamp(36) + counter(36) + random_suffix(36)
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const counter = (idCounter++ % 46656).toString(36).padStart(3, '0'); // 36^3 = 46656
  const random = Math.random().toString(36).substr(2, 3);

  // Reset counter to prevent overflow (every ~46k IDs)
  if (idCounter >= 46656) {
    idCounter = 0;
  }

  return `${timestamp}-${counter}-${random}`;
}

/**
 * Generate a simple sequential ID for better performance
 * Only use this when uniqueness is guaranteed by other means
 */
export function generateSequentialId(counter: number): string {
  return `doc_${counter}`;
}

/**
 * Check if a string is a valid ID format
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length < 1 || id.length > 100) return false; // Allow reasonable ID lengths

  // Allow alphanumeric characters, underscores, hyphens, and dots
  // Support both new format (timestamp-based) and legacy format (doc_###)
  return /^[a-zA-Z0-9_.-]+$/.test(id);
}

/**
 * Check if the current module is the main entry point
 * Compatible with both CommonJS and ES module environments
 */
export function isMainModule(): boolean {
  // ES module environment
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      // Get the current file URL and compare with the main entry point
      const currentUrl = new URL(import.meta.url);
      const mainUrl = new URL(process.argv[1], `file://${process.cwd()}/`);
      return currentUrl.href === mainUrl.href;
    } catch {
      return false;
    }
  }

  // CommonJS environment
  if (typeof require !== 'undefined' && require.main) {
    return require.main === module;
  }

  // Fallback - assume not main module if we can't determine
  return false;
}
