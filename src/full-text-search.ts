import { Document, TextSearchOptions, TextSearchResult } from './types';
import { logger } from './logger';

/**
 * Full-Text Search Engine for Monarch Database
 * Implements text indexing and search with scoring
 */
export class FullTextSearchEngine {
  private textIndexes = new Map<string, TextIndex>();
  private tokenizer = new TextTokenizer();

  /**
   * Create a text index on specified fields
   */
  createTextIndex(collection: string, fields: string[], options: {
    weights?: Record<string, number>;
    defaultLanguage?: string;
    name?: string;
  } = {}): void {
    const indexName = options.name || `text_${fields.join('_')}`;
    const weights = options.weights || {};

    // Default weight of 1 for all fields
    fields.forEach(field => {
      if (!(field in weights)) {
        weights[field] = 1;
      }
    });

    this.textIndexes.set(indexName, new Map([
      ['_fields', fields],
      ['_weights', weights],
      ['_language', options.defaultLanguage || 'english'],
      ['_collection', collection]
    ] as any));

    logger.info('Text index created', { indexName, collection, fields, weights });
  }

  /**
   * Update text index with document changes
   */
  updateIndex(indexName: string, document: Document): void {
    const index = this.textIndexes.get(indexName);
    if (!index) return;

    const fields = index.get('_fields') as string[];
    const weights = index.get('_weights') as Record<string, number>;
    const data = (index.get('_data') as Map<string, Map<string, TextIndexEntry>>) || new Map();
    const docId = document._id as string;

    // Remove existing entries for this document
    for (const [term, entries] of data) {
      entries.delete(docId);
      if (entries.size === 0) {
        data.delete(term);
      }
    }

    // Add new entries
    fields.forEach(field => {
      const text = this.extractText(document, field);
      if (text) {
        const tokens = this.tokenizer.tokenize(text);
        const weight = weights[field] || 1;

        tokens.forEach(token => {
          if (!data.has(token)) {
            data.set(token, new Map());
          }
          const termEntries = data.get(token)!;
          termEntries.set(docId, {
            field,
            weight,
            positions: this.findPositions(text, token),
            frequency: (termEntries.get(docId)?.frequency || 0) + 1
          });
        });
      }
    });

    index.set('_data', data);
  }

  /**
   * Search text index
   */
  search(indexName: string, query: string, options: TextSearchOptions = {}): TextSearchResult[] {
    const index = this.textIndexes.get(indexName);
    if (!index) {
      throw new Error(`Text index '${indexName}' not found`);
    }

    const data = index.get('_data') as Map<string, Map<string, TextIndexEntry>>;
    if (!data) {
      return [];
    }

    const tokens = this.tokenizer.tokenize(query);
    const results = new Map<string, TextSearchResult>();

    // Calculate scores for each document
    tokens.forEach(token => {
      const termEntries = data.get(token);
      if (termEntries) {
        termEntries.forEach((entry, docId) => {
          if (!results.has(docId)) {
            results.set(docId, {
              document: { _id: docId } as Document, // Placeholder - would need document lookup
              score: 0,
              highlights: []
            });
          }

          const result = results.get(docId)!;
          // TF-IDF scoring
          const tf = entry.frequency / this.getDocumentLength(docId, index);
          const idf = Math.log(this.getTotalDocuments(index) / termEntries.size);
          const fieldWeight = entry.weight;

          result.score += (tf * idf * fieldWeight);

          // Add highlights (simplified)
          if (result.highlights!.length < 5) { // Limit highlights
            result.highlights!.push(`${entry.field}: ...${token}...`);
          }
        });
      }
    });

    // Sort by score and apply limit
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);

    logger.info('Text search completed', {
      indexName,
      query,
      tokens: tokens.length,
      results: sortedResults.length
    });

    return sortedResults;
  }

  /**
   * Remove document from text index
   */
  removeFromIndex(indexName: string, docId: string): void {
    const index = this.textIndexes.get(indexName);
    if (!index) return;

    const data = index.get('_data') as Map<string, Map<string, TextIndexEntry>>;
    if (!data) return;

    for (const [term, entries] of data) {
      entries.delete(docId);
      if (entries.size === 0) {
        data.delete(term);
      }
    }
  }

  /**
   * Drop text index
   */
  dropIndex(indexName: string): void {
    this.textIndexes.delete(indexName);
    logger.info('Text index dropped', { indexName });
  }

  private extractText(document: Document, field: string): string {
    const value = this.getNestedValue(document, field);
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.filter(item => typeof item === 'string').join(' ');
    }
    return '';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getDocumentLength(docId: string, index: Map<string, any>): number {
    let totalTerms = 0;
    for (const [term, entries] of index) {
      if (term.startsWith('_')) continue;
      const entry = entries.get(docId);
      if (entry) {
        totalTerms += entry.frequency;
      }
    }
    return totalTerms;
  }

  private getTotalDocuments(index: Map<string, any>): number {
    const data = index.get('_data') as Map<string, Map<string, TextIndexEntry>>;
    if (!data) return 0;

    const docIds = new Set<string>();
    for (const entries of data.values()) {
      for (const docId of entries.keys()) {
        docIds.add(docId);
      }
    }
    return docIds.size;
  }

  private findPositions(text: string, token: string): number[] {
    const positions: number[] = [];
    let index = text.toLowerCase().indexOf(token.toLowerCase());
    while (index !== -1) {
      positions.push(index);
      index = text.toLowerCase().indexOf(token.toLowerCase(), index + 1);
    }
    return positions;
  }
}

interface TextIndexEntry {
  field: string;
  weight: number;
  positions: number[];
  frequency: number;
}

type TextIndex = Map<string, any>; // key -> metadata or Map<docId, TextIndexEntry>

/**
 * Text Tokenizer for full-text search
 */
class TextTokenizer {
  private stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'would'
  ]);

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token))
      .map(token => this.stem(token)); // Simple stemming
  }

  private stem(word: string): string {
    // Very basic stemming - remove common suffixes
    return word.replace(/(ing|ly|ed|ies|ied|ies|ied|s)$/, '');
  }
}
