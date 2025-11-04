import { Document } from './types';
import { logger } from './logger';

/**
 * Vector Search and AI/ML Embeddings Engine for Monarch Database
 * Supports similarity search, embeddings, clustering, and machine learning features
 */
export class VectorEngine {
  private vectors = new Map<string, VectorEntry>();
  private indexes = new Map<string, VectorIndex>();
  private models = new Map<string, EmbeddingModel>();

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

    // Update indexes
    this.updateIndexes(collection, docId, vector);

    logger.debug('Vector stored', { collection, docId, dimension: vector.length });
  }

  /**
   * Search for similar vectors using various similarity metrics
   */
  async searchSimilar(
    collection: string,
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      threshold = 0,
      metric = 'cosine',
      includeMetadata = true,
      includeScores = true,
      indexName
    } = options;

    let candidates: Array<{ docId: string; score: number; entry: VectorEntry }> = [];

    if (indexName) {
      const index = this.indexes.get(indexName);
      if (!index) throw new Error(`Index ${indexName} not found`);
      candidates = this.indexedSearch(index, queryVector, metric);
    } else {
      candidates = this.bruteForceSearch(collection, queryVector, metric);
    }

    // Filter by threshold and sort
    const results = candidates
      .filter(c => c.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ docId, score, entry }) => {
        const result: any = { docId };
        if (includeScores) result.score = score;
        if (includeMetadata) result.metadata = entry.metadata;
        return result;
      });

    logger.info('Vector search completed', {
      collection,
      queryDimension: queryVector.length,
      resultsFound: results.length,
      metric,
      threshold
    });

    return results;
  }

  /**
   * Create a vector index for faster search
   */
  createVectorIndex(collection: string, options: VectorIndexOptions): string {
    const indexName = `vector_${collection}_${Date.now()}`;
    const index: VectorIndex = {
      name: indexName,
      collection,
      dimension: options.dimension,
      metric: options.metric || 'cosine',
      indexType: options.indexType || 'flat',
      vectors: new Map(),
      createdAt: Date.now()
    };

    this.indexes.set(indexName, index);

    // Build initial index
    this.buildIndex(indexName);

    logger.info('Vector index created', {
      indexName,
      collection,
      dimension: options.dimension,
      metric: options.metric,
      indexType: options.indexType
    });

    return indexName;
  }

  /**
   * Build or rebuild vector index
   */
  buildIndex(indexName: string): void {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index ${indexName} not found`);

    index.vectors.clear();

    // Populate index with existing vectors
    for (const [key, entry] of this.vectors) {
      if (key.startsWith(`${index.collection}:`)) {
        index.vectors.set(key, entry);
      }
    }

    // Build index structure based on type
    switch (index.indexType) {
      case 'hnsw':
        this.buildHNSWIndex(index);
        break;
      case 'ivf':
        this.buildIVFIndex(index);
        break;
      case 'flat':
      default:
        // Flat index doesn't need additional building
        break;
    }

    logger.info('Vector index built', {
      indexName,
      vectors: index.vectors.size,
      indexType: index.indexType
    });
  }

  /**
   * Generate embeddings using various models
   */
  async generateEmbedding(text: string, model: string = 'default'): Promise<number[]> {
    const embeddingModel = this.models.get(model) || this.getDefaultModel(model);
    return embeddingModel.encode(text);
  }

  /**
   * Register a custom embedding model
   */
  registerEmbeddingModel(name: string, model: EmbeddingModel): void {
    this.models.set(name, model);
    logger.info('Embedding model registered', { name, dimension: model.dimension });
  }

  /**
   * Bulk generate embeddings
   */
  async generateEmbeddings(texts: string[], model: string = 'default'): Promise<number[][]> {
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
    options: { indexName?: string; metric?: DistanceMetric } = {}
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar(collection, queryVector, {
      limit: k,
      includeScores: true,
      includeMetadata: false,
      metric: options.metric,
      indexName: options.indexName
    });
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
      case 'manhattan':
        return this.manhattanDistance(vector1, vector2);
      case 'hamming':
        return this.hammingDistance(vector1, vector2);
      default:
        throw new Error(`Unknown distance metric: ${metric}`);
    }
  }

  /**
   * Cluster vectors using k-means
   */
  kmeansClustering(vectors: number[][], k: number, options: {
    maxIterations?: number;
    tolerance?: number;
    metric?: DistanceMetric;
  } = {}): KMeansResult {
    const { maxIterations = 100, tolerance = 1e-4, metric = 'euclidean' } = options;

    // Initialize centroids randomly
    let centroids = this.initializeCentroids(vectors, k);
    let assignments = new Array(vectors.length);
    let inertia = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign points to nearest centroid
      const newAssignments = vectors.map(vector => {
        let minDistance = Infinity;
        let closestCentroid = 0;

        for (let j = 0; j < k; j++) {
          const distance = this.distance(vector, centroids[j], metric);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = j;
          }
        }

        return closestCentroid;
      });

      // Update centroids
      const newCentroids = this.updateCentroids(vectors, newAssignments, k);

      // Check for convergence
      const centroidShift = this.calculateCentroidShift(centroids, newCentroids, metric);
      centroids = newCentroids;
      assignments = newAssignments;

      if (centroidShift < tolerance) {
        logger.info('K-means converged', { iteration, centroidShift });
        break;
      }
    }

    // Calculate final inertia and clusters
    inertia = this.calculateInertia(vectors, centroids, assignments, metric);
    const clusters = this.groupByClusters(vectors, assignments, k);

    return { centroids, clusters, assignments, inertia, k };
  }

  /**
   * Dimensionality reduction using PCA
   */
  pcaReduce(vectors: number[][], targetDimensions: number): PCAResult {
    const n = vectors.length;
    const d = vectors[0].length;

    // Center the data
    const mean = this.calculateMean(vectors);
    const centered = this.centerData(vectors, mean);

    // Compute covariance matrix
    const covariance = this.computeCovariance(centered);

    // Eigenvalue decomposition (simplified power iteration for largest eigenvalues)
    const { eigenvalues, eigenvectors } = this.powerIteration(covariance, targetDimensions);

    // Project data onto principal components
    const projected = centered.map(vector => {
      const result = new Array(targetDimensions).fill(0);
      for (let i = 0; i < targetDimensions; i++) {
        for (let j = 0; j < d; j++) {
          result[i] += vector[j] * eigenvectors[j][i];
        }
      }
      return result;
    });

    return {
      projected,
      eigenvalues,
      eigenvectors: eigenvectors.slice(0, targetDimensions),
      explainedVariance: eigenvalues.map(ev => ev / eigenvalues.reduce((a, b) => a + b, 0)),
      originalDimension: d,
      targetDimension: targetDimensions
    };
  }

  /**
   * Perform anomaly detection using isolation forest
   */
  isolationForest(vectors: number[][], options: {
    nEstimators?: number;
    maxSamples?: number;
    contamination?: number;
  } = {}): AnomalyDetectionResult {
    const { nEstimators = 100, maxSamples = 256, contamination = 0.1 } = options;

    // Simplified isolation forest implementation
    const scores = vectors.map(vector => {
      let avgPathLength = 0;

      for (let i = 0; i < nEstimators; i++) {
        const sample = this.sampleVectors(vectors, Math.min(maxSamples, vectors.length));
        avgPathLength += this.pathLengthInTree(vector, sample);
      }

      avgPathLength /= nEstimators;
      return avgPathLength;
    });

    // Normalize scores
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const normalizedScores = scores.map(score => (score - minScore) / (maxScore - minScore));

    // Determine anomalies based on contamination
    const threshold = this.calculateAnomalyThreshold(normalizedScores, contamination);
    const predictions = normalizedScores.map(score => score >= threshold ? 1 : 0);

    return {
      scores: normalizedScores,
      predictions,
      threshold,
      contamination
    };
  }

  /**
   * Remove vector
   */
  removeVector(collection: string, docId: string): void {
    const key = `${collection}:${docId}`;
    this.vectors.delete(key);

    // Remove from indexes
    for (const index of this.indexes.values()) {
      if (index.collection === collection) {
        index.vectors.delete(key);
      }
    }

    logger.debug('Vector removed', { collection, docId });
  }

  /**
   * Get vector statistics
   */
  getVectorStats(collection: string): VectorStats {
    const collectionVectors = Array.from(this.vectors.entries())
      .filter(([key]) => key.startsWith(`${collection}:`))
      .map(([, entry]) => entry);

    if (collectionVectors.length === 0) {
      return { count: 0, dimensions: 0, avgDimension: 0, totalSize: 0 };
    }

    const dimensions = collectionVectors[0].dimension;
    const avgDimension = collectionVectors.reduce((sum, v) => sum + v.dimension, 0) / collectionVectors.length;
    const totalSize = collectionVectors.reduce((sum, v) => sum + v.vector.length * 8, 0); // 8 bytes per float64

    return { count: collectionVectors.length, dimensions, avgDimension, totalSize };
  }

  // Private helper methods
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

  private manhattanDistance(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      sum += Math.abs(vector1[i] - vector2[i]);
    }
    return sum;
  }

  private hammingDistance(vector1: number[], vector2: number[]): number {
    let distance = 0;
    for (let i = 0; i < vector1.length; i++) {
      if (vector1[i] !== vector2[i]) distance++;
    }
    return distance;
  }

  private dotProduct(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      sum += vector1[i] * vector2[i];
    }
    return sum;
  }

  private bruteForceSearch(collection: string, queryVector: number[], metric: DistanceMetric) {
    const candidates: Array<{ docId: string; score: number; entry: VectorEntry }> = [];

    for (const [key, entry] of this.vectors) {
      if (!key.startsWith(`${collection}:`)) continue;

      const score = this.similarityToScore(this.distance(queryVector, entry.vector, metric), metric);
      const docId = key.split(':')[1];

      candidates.push({ docId, score, entry });
    }

    return candidates;
  }

  private indexedSearch(index: VectorIndex, queryVector: number[], metric: DistanceMetric) {
    // For now, implement basic indexed search
    // In production, this would use specialized algorithms like HNSW, IVF, etc.
    return this.bruteForceSearch(index.collection, queryVector, metric);
  }

  private updateIndexes(collection: string, docId: string, vector: number[]): void {
    for (const index of this.indexes.values()) {
      if (index.collection === collection) {
        const key = `${collection}:${docId}`;
        index.vectors.set(key, {
          vector,
          metadata: {},
          timestamp: Date.now(),
          dimension: vector.length
        });
      }
    }
  }

  private buildHNSWIndex(index: VectorIndex): void {
    // Simplified HNSW implementation - in production would use a proper HNSW library
    logger.debug('HNSW index building not fully implemented - using flat search');
  }

  private buildIVFIndex(index: VectorIndex): void {
    // Simplified IVF implementation
    logger.debug('IVF index building not fully implemented - using flat search');
  }

  private getDefaultModel(modelName: string): EmbeddingModel {
    switch (modelName) {
      case 'tfidf':
        return new TFIDFEmbedding();
      case 'word2vec':
        return new Word2VecEmbedding();
      default:
        return new SimpleEmbedding();
    }
  }

  private similarityToScore(distance: number, metric: DistanceMetric): number {
    switch (metric) {
      case 'cosine':
        return 1 - distance; // Convert distance back to similarity
      case 'euclidean':
      case 'manhattan':
      case 'hamming':
        return 1 / (1 + distance); // Convert to similarity score
      case 'dotproduct':
        return Math.max(0, distance); // Already a similarity measure
      default:
        return 1 - distance;
    }
  }

  private initializeCentroids(vectors: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const used = new Set<number>();

    // K-means++ initialization
    centroids.push([...vectors[Math.floor(Math.random() * vectors.length)]]);

    for (let i = 1; i < k; i++) {
      const distances = vectors.map(vector =>
        Math.min(...centroids.map(centroid => this.euclideanDistance(vector, centroid)))
      );

      const totalDistance = distances.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalDistance;

      for (let j = 0; j < vectors.length; j++) {
        random -= distances[j];
        if (random <= 0 && !used.has(j)) {
          centroids.push([...vectors[j]]);
          used.add(j);
          break;
        }
      }
    }

    return centroids;
  }

  private updateCentroids(vectors: number[][], assignments: number[], k: number): number[][] {
    const centroids = Array.from({ length: k }, () => new Array(vectors[0].length).fill(0));
    const counts = new Array(k).fill(0);

    for (let i = 0; i < vectors.length; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      for (let j = 0; j < vectors[i].length; j++) {
        centroids[cluster][j] += vectors[i][j];
      }
    }

    for (let i = 0; i < k; i++) {
      if (counts[i] > 0) {
        for (let j = 0; j < centroids[i].length; j++) {
          centroids[i][j] /= counts[i];
        }
      }
    }

    return centroids;
  }

  private calculateCentroidShift(oldCentroids: number[][], newCentroids: number[][], metric: DistanceMetric): number {
    let totalShift = 0;
    for (let i = 0; i < oldCentroids.length; i++) {
      totalShift += this.distance(oldCentroids[i], newCentroids[i], metric);
    }
    return totalShift / oldCentroids.length;
  }

  private calculateInertia(vectors: number[][], centroids: number[][], assignments: number[], metric: DistanceMetric): number {
    let inertia = 0;
    for (let i = 0; i < vectors.length; i++) {
      const centroid = centroids[assignments[i]];
      inertia += Math.pow(this.distance(vectors[i], centroid, metric), 2);
    }
    return inertia;
  }

  private groupByClusters(vectors: number[][], assignments: number[], k: number): number[][][] {
    const clusters: number[][][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < vectors.length; i++) {
      clusters[assignments[i]].push(vectors[i]);
    }
    return clusters;
  }

  private calculateMean(vectors: number[][]): number[] {
    const d = vectors[0].length;
    const mean = new Array(d).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < d; i++) {
        mean[i] += vector[i];
      }
    }

    for (let i = 0; i < d; i++) {
      mean[i] /= vectors.length;
    }

    return mean;
  }

  private centerData(vectors: number[][], mean: number[]): number[][] {
    return vectors.map(vector => vector.map((val, i) => val - mean[i]));
  }

  private computeCovariance(centered: number[][]): number[][] {
    const n = centered.length;
    const d = centered[0].length;
    const covariance = Array.from({ length: d }, () => new Array(d).fill(0));

    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        for (let k = 0; k < n; k++) {
          covariance[i][j] += centered[k][i] * centered[k][j];
        }
        covariance[i][j] /= n;
      }
    }

    return covariance;
  }

  private powerIteration(matrix: number[][], numComponents: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    // Simplified power iteration for demonstration
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];

    for (let i = 0; i < numComponents; i++) {
      // Random initial vector
      let vector = matrix[0].map(() => Math.random() - 0.5);
      let eigenvalue = 0;

      // Simple power iteration (would need more iterations in practice)
      for (let iter = 0; iter < 10; iter++) {
        const newVector = this.matrixVectorMultiply(matrix, vector);
        const norm = Math.sqrt(this.dotProduct(newVector, newVector));
        vector = newVector.map(v => v / norm);
        eigenvalue = this.dotProduct(this.matrixVectorMultiply(matrix, vector), vector);
      }

      eigenvalues.push(eigenvalue);
      eigenvectors.push(vector);
    }

    return { eigenvalues, eigenvectors };
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => this.dotProduct(row, vector));
  }

  private sampleVectors(vectors: number[][], size: number): number[][] {
    const sampled: number[][] = [];
    const indices = new Set<number>();

    while (sampled.length < size && indices.size < vectors.length) {
      const index = Math.floor(Math.random() * vectors.length);
      if (!indices.has(index)) {
        indices.add(index);
        sampled.push(vectors[index]);
      }
    }

    return sampled;
  }

  private pathLengthInTree(vector: number[], sample: number[][]): number {
    // Simplified isolation tree path length calculation
    let pathLength = 0;
    let currentSample = [...sample];

    while (currentSample.length > 1) {
      const splitValue = this.calculateSplitValue(currentSample);
      const left = currentSample.filter(v => v[0] < splitValue);
      const right = currentSample.filter(v => v[0] >= splitValue);

      currentSample = vector[0] < splitValue ? left : right;
      pathLength++;

      if (currentSample.length === 0) break;
    }

    return pathLength;
  }

  private calculateSplitValue(vectors: number[][]): number {
    const values = vectors.map(v => v[0]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min + Math.random() * (max - min);
  }

  private calculateAnomalyThreshold(scores: number[], contamination: number): number {
    const sortedScores = [...scores].sort((a, b) => b - a);
    const index = Math.floor(scores.length * contamination);
    return sortedScores[index];
  }
}

// Embedding Models
interface EmbeddingModel {
  name: string;
  dimension: number;
  encode(text: string): Promise<number[]>;
}

class SimpleEmbedding implements EmbeddingModel {
  name = 'simple';
  dimension = 128;

  async encode(text: string): Promise<number[]> {
    const vector = new Array(this.dimension).fill(0);
    const chars = text.toLowerCase().split('');

    for (let i = 0; i < chars.length && i < this.dimension; i++) {
      vector[i] = chars[i].charCodeAt(0) / 255;
    }

    // Add basic features
    vector[100] = text.length / 1000;
    vector[101] = (text.match(/[a-z]/g) || []).length / text.length;
    vector[102] = (text.match(/\d/g) || []).length / text.length;
    vector[103] = (text.match(/\s/g) || []).length / text.length;

    return vector;
  }
}

class TFIDFEmbedding implements EmbeddingModel {
  name = 'tfidf';
  dimension = 256;
  private documentFrequency = new Map<string, number>();
  private totalDocuments = 0;

  async encode(text: string): Promise<number[]> {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const vector = new Array(this.dimension).fill(0);
    const wordCount = new Map<string, number>();

    // Count word frequencies
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // Calculate TF-IDF
    wordCount.forEach((count, word) => {
      const tf = count / words.length;
      const df = this.documentFrequency.get(word) || 1;
      const idf = Math.log(this.totalDocuments / df);
      const tfidf = tf * idf;

      // Hash word to vector position
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xffffffff;
      }
      const index = Math.abs(hash) % this.dimension;
      vector[index] += tfidf;
    });

    return vector;
  }

  updateDocumentFrequency(text: string): void {
    const words = new Set(text.toLowerCase().match(/\b\w+\b/g) || []);
    words.forEach(word => {
      this.documentFrequency.set(word, (this.documentFrequency.get(word) || 0) + 1);
    });
    this.totalDocuments++;
  }
}

class Word2VecEmbedding implements EmbeddingModel {
  name = 'word2vec';
  dimension = 300;
  private wordVectors = new Map<string, number[]>();

  async encode(text: string): Promise<number[]> {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const vector = new Array(this.dimension).fill(0);

    for (const word of words) {
      const wordVector = this.getWordVector(word);
      for (let i = 0; i < this.dimension; i++) {
        vector[i] += wordVector[i];
      }
    }

    if (words.length > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= words.length;
      }
    }

    return vector;
  }

  private getWordVector(word: string): number[] {
    if (this.wordVectors.has(word)) {
      return this.wordVectors.get(word)!;
    }

    // Generate deterministic pseudo-random vector for unknown words
    const vector = new Array(this.dimension);
    for (let i = 0; i < this.dimension; i++) {
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
      }
      vector[i] = (Math.sin(hash + i) + 1) / 2; // Normalize to 0-1
    }

    this.wordVectors.set(word, vector);
    return vector;
  }
}

// Type definitions
interface VectorEntry {
  vector: number[];
  metadata: any;
  timestamp: number;
  dimension: number;
}

interface VectorIndex {
  name: string;
  collection: string;
  dimension: number;
  metric: DistanceMetric;
  indexType: 'flat' | 'hnsw' | 'ivf';
  vectors: Map<string, VectorEntry>;
  createdAt: number;
}

interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  metric?: DistanceMetric;
  includeMetadata?: boolean;
  includeScores?: boolean;
  indexName?: string;
}

interface VectorSearchResult {
  docId: string;
  score: number;
  metadata?: any;
}

interface VectorIndexOptions {
  dimension: number;
  metric?: DistanceMetric;
  indexType?: 'flat' | 'hnsw' | 'ivf';
}

interface KMeansResult {
  centroids: number[][];
  clusters: number[][][];
  assignments: number[];
  inertia: number;
  k: number;
}

interface PCAResult {
  projected: number[][];
  eigenvalues: number[];
  eigenvectors: number[][];
  explainedVariance: number[];
  originalDimension: number;
  targetDimension: number;
}

interface AnomalyDetectionResult {
  scores: number[];
  predictions: number[];
  threshold: number;
  contamination: number;
}

interface VectorStats {
  count: number;
  dimensions: number;
  avgDimension: number;
  totalSize: number;
}

type DistanceMetric = 'cosine' | 'euclidean' | 'dotproduct' | 'manhattan' | 'hamming';
