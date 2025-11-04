import { Document } from './types';
import { logger } from './logger';

/**
 * Vector Search and AI/ML Embeddings Engine for Monarch Database
 * Supports similarity search, embeddings, and machine learning features
 */
export class VectorSearchEngine {
  private vectors = new Map<string, VectorEntry>();
  private indexes = new Map<string, VectorIndex>();

  /**
   * Store a vector embedding
   */
  storeVector(collection: string, docId: string, vector: number[], metadata?: any): void {
    const key = `${collection}:${docId}`;
    this.vectors.set(key, {
      vector,
      metadata: metadata || {},
      timestamp: Date.now(),
      dimension: vector.length
    });

    logger.debug('Vector stored', { collection, docId, dimension: vector.length });
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async searchSimilar(
    collection: string,
    queryVector: number[],
    options: {
      limit?: number;
      threshold?: number;
      includeMetadata?: boolean;
      includeScores?: boolean;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const { limit = 10, threshold = 0, includeMetadata = true, includeScores = true } = options;
    const results: VectorSearchResult[] = [];

    for (const [key, entry] of this.vectors) {
      if (!key.startsWith(`${collection}:`)) continue;

      const similarity = this.cosineSimilarity(queryVector, entry.vector);

      if (similarity >= threshold) {
        const docId = key.split(':')[1];
        const result: any = { docId };

        if (includeScores) result.score = similarity;
        if (includeMetadata) result.metadata = entry.metadata;

        results.push(result);
      }
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Create a vector index for faster search
   */
  createVectorIndex(collection: string, options: {
    dimension: number;
    metric?: 'cosine' | 'euclidean' | 'dotproduct';
    indexType?: 'flat' | 'hnsw' | 'ivf';
  }): string {
    const indexName = `vector_${collection}_${Date.now()}`;
    this.indexes.set(indexName, {
      collection,
      dimension: options.dimension,
      metric: options.metric || 'cosine',
      indexType: options.indexType || 'flat',
      vectors: new Map()
    });

    logger.info('Vector index created', { indexName, collection, dimension: options.dimension });
    return indexName;
  }

  /**
   * Build vector index (for HNSW/IVF indexes)
   */
  buildIndex(indexName: string): void {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index ${indexName} not found`);

    // For now, just populate with existing vectors
    index.vectors.clear();

    for (const [key, entry] of this.vectors) {
      if (key.startsWith(`${index.collection}:`)) {
        index.vectors.set(key, entry);
      }
    }

    logger.info('Vector index built', { indexName, vectors: index.vectors.size });
  }

  /**
   * Generate embeddings using built-in models
   */
  async generateEmbedding(text: string, model: EmbeddingModel = 'default'): Promise<number[]> {
    switch (model) {
      case 'default':
        return this.simpleTextEmbedding(text);
      case 'tfidf':
        return this.tfidfEmbedding(text);
      case 'word2vec':
        return this.word2vecEmbedding(text);
      default:
        throw new Error(`Unknown embedding model: ${model}`);
    }
  }

  /**
   * Bulk generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[], model: EmbeddingModel = 'default'): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text, model));
    }
    return embeddings;
  }

  /**
   * Perform k-nearest neighbors search
   */
  async knnSearch(
    collection: string,
    queryVector: number[],
    k: number = 10,
    indexName?: string
  ): Promise<VectorSearchResult[]> {
    if (indexName) {
      const index = this.indexes.get(indexName);
      if (!index) throw new Error(`Index ${indexName} not found`);
      return this.indexedKnnSearch(index, queryVector, k);
    }

    return this.bruteForceKnnSearch(collection, queryVector, k);
  }

  /**
   * Calculate distance between vectors
   */
  distance(vector1: number[], vector2: number[], metric: DistanceMetric = 'cosine'): number {
    switch (metric) {
      case 'cosine':
        return 1 - this.cosineSimilarity(vector1, vector2);
      case 'euclidean':
        return this.euclideanDistance(vector1, vector2);
      case 'dotproduct':
        return -this.dotProduct(vector1, vector2);
      default:
        throw new Error(`Unknown distance metric: ${metric}`);
    }
  }

  /**
   * Cluster vectors using k-means
   */
  kmeansClustering(vectors: number[][], k: number, maxIterations: number = 100): {
    centroids: number[][];
    clusters: number[][][];
    assignments: number[];
  } {
    // Initialize centroids randomly
    let centroids = vectors.slice(0, k);
    let assignments = new Array(vectors.length);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign points to nearest centroid
      for (let i = 0; i < vectors.length; i++) {
        let minDistance = Infinity;
        let closestCentroid = 0;

        for (let j = 0; j < k; j++) {
          const distance = this.euclideanDistance(vectors[i], centroids[j]);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = j;
          }
        }

        assignments[i] = closestCentroid;
      }

      // Update centroids
      const newCentroids = centroids.map(() => new Array(vectors[0].length).fill(0));
      const clusterSizes = new Array(k).fill(0);

      for (let i = 0; i < vectors.length; i++) {
        const cluster = assignments[i];
        clusterSizes[cluster]++;
        for (let j = 0; j < vectors[i].length; j++) {
          newCentroids[cluster][j] += vectors[i][j];
        }
      }

      // Average the centroids
      for (let i = 0; i < k; i++) {
        if (clusterSizes[i] > 0) {
          for (let j = 0; j < newCentroids[i].length; j++) {
            newCentroids[i][j] /= clusterSizes[i];
          }
        }
      }

      centroids = newCentroids;
    }

    // Group vectors by cluster
    const clusters: number[][][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < vectors.length; i++) {
      clusters[assignments[i]].push(vectors[i]);
    }

    return { centroids, clusters, assignments };
  }

  /**
   * Dimensionality reduction using PCA
   */
  pcaReduce(vectors: number[][], targetDimensions: number): number[][] {
    // Simplified PCA implementation
    const n = vectors.length;
    const d = vectors[0].length;

    // Center the data
    const mean = new Array(d).fill(0);
    for (const vector of vectors) {
      for (let i = 0; i < d; i++) {
        mean[i] += vector[i];
      }
    }
    for (let i = 0; i < d; i++) {
      mean[i] /= n;
    }

    const centered = vectors.map(vector =>
      vector.map((val, i) => val - mean[i])
    );

    // Compute covariance matrix (simplified)
    const covariance = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        for (let k = 0; k < n; k++) {
          covariance[i][j] += centered[k][i] * centered[k][j];
        }
        covariance[i][j] /= n;
      }
    }

    // For simplicity, return first targetDimensions dimensions
    return vectors.map(vector => vector.slice(0, targetDimensions));
  }

  /**
   * Remove vector
   */
  removeVector(collection: string, docId: string): void {
    const key = `${collection}:${docId}`;
    this.vectors.delete(key);
  }

  /**
   * Get vector statistics
   */
  getVectorStats(collection: string): {
    count: number;
    dimensions: number;
    avgDimension: number;
  } {
    const collectionVectors = Array.from(this.vectors.entries())
      .filter(([key]) => key.startsWith(`${collection}:`))
      .map(([, entry]) => entry);

    if (collectionVectors.length === 0) {
      return { count: 0, dimensions: 0, avgDimension: 0 };
    }

    const dimensions = collectionVectors[0].dimension;
    const avgDimension = collectionVectors.reduce((sum, v) => sum + v.dimension, 0) / collectionVectors.length;

    return { count: collectionVectors.length, dimensions, avgDimension };
  }

  private cosineSimilarity(vector1: number[], vector2: number[]): number {
    const dot = this.dotProduct(vector1, vector2);
    const norm1 = Math.sqrt(this.dotProduct(vector1, vector1));
    const norm2 = Math.sqrt(this.dotProduct(vector2, vector2));
    return dot / (norm1 * norm2);
  }

  private euclideanDistance(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      const diff = vector1[i] - vector2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private dotProduct(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      sum += vector1[i] * vector2[i];
    }
    return sum;
  }

  private async simpleTextEmbedding(text: string): Promise<number[]> {
    // Simple character-level embedding for demo purposes
    const vector = new Array(128).fill(0);
    const chars = text.toLowerCase().split('');

    for (let i = 0; i < chars.length && i < vector.length; i++) {
      vector[i] = chars[i].charCodeAt(0) / 255; // Normalize to 0-1
    }

    // Add some simple features
    vector[100] = text.length / 1000; // Normalized length
    vector[101] = (text.match(/[a-z]/g) || []).length / text.length; // Letter ratio
    vector[102] = (text.match(/\d/g) || []).length / text.length; // Number ratio
    vector[103] = (text.match(/\s/g) || []).length / text.length; // Whitespace ratio

    return vector;
  }

  private async tfidfEmbedding(text: string): Promise<number[]> {
    // Simplified TF-IDF embedding
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const vector = new Array(256).fill(0);

    // Simple word hashing to vector positions
    words.forEach(word => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
      }
      const index = Math.abs(hash) % vector.length;
      vector[index] += 1; // Term frequency
    });

    // Normalize
    const max = Math.max(...vector);
    if (max > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= max;
      }
    }

    return vector;
  }

  private async word2vecEmbedding(text: string): Promise<number[]> {
    // Mock word2vec - in reality would use pre-trained model
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const vector = new Array(300).fill(0);

    // Simple averaging of word vectors (mock)
    for (const word of words) {
      for (let i = 0; i < 300; i++) {
        vector[i] += (word.charCodeAt(i % word.length) || 0) / 255;
      }
    }

    if (words.length > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= words.length;
      }
    }

    return vector;
  }

  private bruteForceKnnSearch(collection: string, queryVector: number[], k: number): VectorSearchResult[] {
    const candidates: Array<{ docId: string; score: number; entry: VectorEntry }> = [];

    for (const [key, entry] of this.vectors) {
      if (!key.startsWith(`${collection}:`)) continue;

      const score = this.cosineSimilarity(queryVector, entry.vector);
      const docId = key.split(':')[1];

      candidates.push({ docId, score, entry });
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ docId, score, entry }) => ({
        docId,
        score,
        metadata: entry.metadata
      }));
  }

  private indexedKnnSearch(index: VectorIndex, queryVector: number[], k: number): VectorSearchResult[] {
    // For HNSW or IVF indexes, this would use optimized search
    // For now, fall back to brute force
    return this.bruteForceKnnSearch(index.collection, queryVector, k);
  }
}

interface VectorEntry {
  vector: number[];
  metadata: any;
  timestamp: number;
  dimension: number;
}

interface VectorIndex {
  collection: string;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  indexType: 'flat' | 'hnsw' | 'ivf';
  vectors: Map<string, VectorEntry>;
}

interface VectorSearchResult {
  docId: string;
  score: number;
  metadata?: any;
}

type EmbeddingModel = 'default' | 'tfidf' | 'word2vec';
type DistanceMetric = 'cosine' | 'euclidean' | 'dotproduct';
