import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src/monarch';

describe('Vector Search Capabilities', () => {
  let db: Monarch;

  beforeEach(() => {
    db = new Monarch();
  });

  describe('AI Workload Vector Operations', () => {
    it('should store and retrieve embeddings', async () => {
      // Store document embeddings (384-dimensional vectors like BERT)
      const embeddings = [
        { id: 'doc1', vector: [0.1, 0.2, 0.3, 0.4], metadata: { text: 'Hello world', category: 'greeting' } },
        { id: 'doc2', vector: [0.2, 0.1, 0.4, 0.3], metadata: { text: 'Hi there', category: 'greeting' } },
        { id: 'doc3', vector: [0.8, 0.7, 0.1, 0.2], metadata: { text: 'Machine learning', category: 'tech' } },
        { id: 'doc4', vector: [0.9, 0.8, 0.2, 0.1], metadata: { text: 'Deep learning', category: 'tech' } },
      ];

      for (const embedding of embeddings) {
        await db.vadd('embeddings', embedding.id, embedding.vector, embedding.metadata);
      }

      expect(await db.vcount('embeddings')).toBe(4);

      // Retrieve specific embedding
      const doc1 = await db.vget('embeddings', 'doc1');
      expect(doc1?.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
      expect(doc1?.metadata?.category).toBe('greeting');
    });

    it('should perform semantic search with cosine similarity', async () => {
      // Store product embeddings
      const products = [
        { id: 'laptop', vector: [0.8, 0.1, 0.2, 0.9], metadata: { name: 'Gaming Laptop', price: 1500 } },
        { id: 'mouse', vector: [0.1, 0.8, 0.9, 0.2], metadata: { name: 'Wireless Mouse', price: 50 } },
        { id: 'keyboard', vector: [0.2, 0.9, 0.8, 0.1], metadata: { name: 'Mechanical Keyboard', price: 120 } },
        { id: 'monitor', vector: [0.9, 0.2, 0.1, 0.8], metadata: { name: '4K Monitor', price: 400 } },
      ];

      for (const product of products) {
        await db.vadd('products', product.id, product.vector, product.metadata);
      }

      // Search for products similar to a "computer peripheral" query
      const queryVector = [0.3, 0.7, 0.8, 0.2]; // Represents "peripheral device"
      const results = await db.vsearch('products', queryVector, 3, true);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('mouse'); // Most similar to peripheral query
      expect(results[0].score).toBeGreaterThan(0.8); // High similarity score
      expect(results[0].metadata?.name).toBe('Wireless Mouse');
    });

    it('should handle high-dimensional vectors for modern ML models', async () => {
      // Simulate 1536-dimensional OpenAI embeddings
      const generateRandomVector = (dimensions: number) => {
        return Array.from({ length: dimensions }, () => Math.random() - 0.5);
      };

      // Store high-dimensional embeddings
      const docs = [
        { id: 'text1', vector: generateRandomVector(1536), metadata: { content: 'Machine learning is fascinating' } },
        { id: 'text2', vector: generateRandomVector(1536), metadata: { content: 'AI will transform healthcare' } },
        { id: 'text3', vector: generateRandomVector(1536), metadata: { content: 'Data science requires statistics' } },
      ];

      for (const doc of docs) {
        await db.vadd('documents', doc.id, doc.vector, doc.metadata);
      }

      expect(await db.vcount('documents')).toBe(3);

      // Search with a query vector
      const queryVector = generateRandomVector(1536);
      const results = await db.vsearch('documents', queryVector, 2, false);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(-1);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should support vector similarity for recommendation systems', async () => {
      // User preference vectors
      const users = [
        { id: 'user1', vector: [0.9, 0.8, 0.1, 0.2], metadata: { name: 'Tech enthusiast' } },
        { id: 'user2', vector: [0.2, 0.1, 0.9, 0.8], metadata: { name: 'Creative professional' } },
      ];

      // Item vectors
      const items = [
        { id: 'item1', vector: [0.8, 0.7, 0.2, 0.3], metadata: { name: 'Latest smartphone', category: 'tech' } },
        { id: 'item2', vector: [0.3, 0.2, 0.8, 0.7], metadata: { name: 'Design software', category: 'creative' } },
      ];

      // Store in separate collections
      for (const user of users) {
        await db.vadd('users', user.id, user.vector, user.metadata);
      }

      for (const item of items) {
        await db.vadd('items', item.id, item.vector, item.metadata);
      }

      // Find most similar items for user1
      const user1Vector = (await db.vget('users', 'user1'))!.vector;
      const recommendations = await db.vsearch('items', user1Vector, 2, true);

      expect(recommendations[0].id).toBe('item1'); // Tech item should be most similar to tech user
      expect(recommendations[0].metadata?.category).toBe('tech');
    });

    it('should handle vector deletion and updates', async () => {
      // Add vectors
      await db.vadd('vectors', 'vec1', [1, 0, 0]);
      await db.vadd('vectors', 'vec2', [0, 1, 0]);
      await db.vadd('vectors', 'vec3', [0, 0, 1]);

      expect(await db.vcount('vectors')).toBe(3);

      // Delete a vector
      expect(await db.vdel('vectors', ['vec2'])).toBe(1);
      expect(await db.vcount('vectors')).toBe(2);

      // Try to get deleted vector
      const deleted = await db.vget('vectors', 'vec2');
      expect(deleted).toBeNull();

      // Update vector by overwriting
      await db.vadd('vectors', 'vec1', [0.5, 0.5, 0.5]);
      const updated = await db.vget('vectors', 'vec1');
      expect(updated?.vector).toEqual([0.5, 0.5, 0.5]);
    });

    it('should support metadata filtering in search results', async () => {
      const vectors = [
        { id: 'happy', vector: [0.9, 0.8, 0.1], metadata: { sentiment: 'positive', language: 'en' } },
        { id: 'sad', vector: [0.1, 0.2, 0.9], metadata: { sentiment: 'negative', language: 'en' } },
        { id: 'joyful', vector: [0.8, 0.9, 0.2], metadata: { sentiment: 'positive', language: 'es' } },
      ];

      for (const vec of vectors) {
        await db.vadd('sentiments', vec.id, vec.vector, vec.metadata);
      }

      // Search without metadata
      const resultsNoMeta = await db.vsearch('sentiments', [0.8, 0.7, 0.2], 3, false);
      expect(resultsNoMeta[0].metadata).toBeUndefined();

      // Search with metadata
      const resultsWithMeta = await db.vsearch('sentiments', [0.8, 0.7, 0.2], 3, true);
      expect(resultsWithMeta[0].metadata?.sentiment).toBeDefined();
      expect(resultsWithMeta[0].metadata?.language).toBeDefined();
    });

    it('should handle edge cases in vector search', async () => {
      // Empty collection
      const emptyResults = await db.vsearch('nonexistent', [1, 2, 3], 5);
      expect(emptyResults).toEqual([]);

      // Single vector
      await db.vadd('single', 'vec1', [1, 0, 0]);
      const singleResults = await db.vsearch('single', [1, 0, 0], 5);
      expect(singleResults).toHaveLength(1);
      expect(singleResults[0].score).toBe(1); // Perfect match

      // Zero vector query
      const zeroQuery = await db.vsearch('single', [0, 0, 0], 5);
      expect(zeroQuery).toHaveLength(1);

      // Large topK
      await db.vadd('single', 'vec2', [0, 1, 0]);
      const largeTopK = await db.vsearch('single', [0.5, 0.5, 0], 10);
      expect(largeTopK).toHaveLength(2); // Should not exceed available vectors
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain performance with multiple vector operations', async () => {
      const startTime = Date.now();

      // Add 100 vectors
      for (let i = 0; i < 100; i++) {
        const vector = Array.from({ length: 128 }, () => Math.random());
        await db.vadd('performance', `vec${i}`, vector, { index: i });
      }

      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(1000); // Should complete within 1 second

      // Search through all vectors
      const searchStart = Date.now();
      const queryVector = Array.from({ length: 128 }, () => Math.random());
      const results = await db.vsearch('performance', queryVector, 10);

      const searchTime = Date.now() - searchStart;
      expect(searchTime).toBeLessThan(500); // Search should be fast
      expect(results).toHaveLength(10);
    });

    it('should scale with vector dimensions', async () => {
      const dimensions = [64, 256, 512, 1024];

      for (const dim of dimensions) {
        const collectionName = `dim${dim}`;
        const vector = Array.from({ length: dim }, () => Math.random());

        await db.vadd(collectionName, 'test', vector);

        const startTime = Date.now();
        const results = await db.vsearch(collectionName, vector, 1);
        const searchTime = Date.now() - startTime;

        // Higher dimensions should still be reasonably fast
        expect(searchTime).toBeLessThan(100);
        expect(results[0].score).toBeCloseTo(1, 5); // Should be nearly perfect match
      }
    });
  });
});
