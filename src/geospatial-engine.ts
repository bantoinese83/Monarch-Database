import { Document, Point, Polygon, MultiPolygon, GeoQuery } from './types';
import { logger } from './logger';

/**
 * Geospatial Engine for Monarch Database
 * Implements MongoDB-style geospatial queries
 */
export class GeospatialEngine {
  /**
   * Check if a point is within a certain distance of another point
   */
  static pointNear(point1: Point, point2: Point, maxDistance?: number, minDistance?: number): boolean {
    const distance = this.haversineDistance(point1.coordinates, point2.coordinates);

    if (maxDistance !== undefined && distance > maxDistance) return false;
    if (minDistance !== undefined && distance < minDistance) return false;

    return true;
  }

  /**
   * Check if a point is within a polygon
   */
  static pointInPolygon(point: Point, polygon: Polygon): boolean {
    const [lng, lat] = point.coordinates;
    const coordinates = polygon.coordinates[0]; // Use outer ring

    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
      const [xi, yi] = coordinates[i];
      const [xj, yj] = coordinates[j];

      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Check if a point is within a multi-polygon
   */
  static pointInMultiPolygon(point: Point, multiPolygon: MultiPolygon): boolean {
    return multiPolygon.coordinates.some(polygonCoords => {
      const polygon: Polygon = { type: 'Polygon', coordinates: polygonCoords };
      return this.pointInPolygon(point, polygon);
    });
  }

  /**
   * Execute geospatial query
   */
  static executeGeoQuery(documents: Document[], field: string, query: GeoQuery): Document[] {
    const results: Document[] = [];

    for (const doc of documents) {
      const geoValue = this.getNestedValue(doc, field);
      if (!geoValue || typeof geoValue !== 'object') continue;

      let matches = false;

      if (query.$near) {
        const point = geoValue as Point;
        matches = this.pointNear(point, query.$near.$geometry,
          query.$near.$maxDistance, query.$near.$minDistance);
      } else if (query.$geoWithin) {
        const point = geoValue as Point;
        if (query.$geoWithin.$geometry.type === 'Polygon') {
          matches = this.pointInPolygon(point, query.$geoWithin.$geometry as Polygon);
        } else if (query.$geoWithin.$geometry.type === 'MultiPolygon') {
          matches = this.pointInMultiPolygon(point, query.$geoWithin.$geometry as MultiPolygon);
        }
      } else if (query.$geoIntersects) {
        // Simplified - just check if point is in geometry
        const point = geoValue as Point;
        if (query.$geoIntersects.$geometry.type === 'Polygon') {
          matches = this.pointInPolygon(point, query.$geoIntersects.$geometry as Polygon);
        }
      }

      if (matches) {
        results.push(doc);
      }
    }

    return results;
  }

  /**
   * Sort documents by distance from a point
   */
  static sortByDistance(documents: Document[], field: string, point: Point): Document[] {
    return documents.sort((a, b) => {
      const pointA = this.getNestedValue(a, field) as Point;
      const pointB = this.getNestedValue(b, field) as Point;

      if (!pointA || !pointB) return 0;

      const distA = this.haversineDistance(point.coordinates, pointA.coordinates);
      const distB = this.haversineDistance(point.coordinates, pointB.coordinates);

      return distA - distB;
    });
  }

  /**
   * Calculate Haversine distance between two points
   */
  private static haversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

/**
 * Geospatial Index for efficient spatial queries
 */
export class GeospatialIndex {
  private rtree: Map<string, any> = new Map(); // Simplified R-tree implementation

  /**
   * Insert a geospatial document into the index
   */
  insert(docId: string, geometry: Point | Polygon | MultiPolygon): void {
    // Simplified bounding box calculation
    const bbox = this.calculateBoundingBox(geometry);
    this.rtree.set(docId, { geometry, bbox });
  }

  /**
   * Remove document from geospatial index
   */
  remove(docId: string): void {
    this.rtree.delete(docId);
  }

  /**
   * Query documents within bounding box
   */
  queryWithin(bbox: [number, number, number, number]): string[] {
    const results: string[] = [];
    const [minLng, minLat, maxLng, maxLat] = bbox;

    for (const [docId, entry] of this.rtree) {
      const [entryMinLng, entryMinLat, entryMaxLng, entryMaxLat] = entry.bbox;
      if (entryMinLng <= maxLng && entryMaxLng >= minLng &&
          entryMinLat <= maxLat && entryMaxLat >= minLat) {
        results.push(docId);
      }
    }

    return results;
  }

  /**
   * Find nearest neighbors
   */
  findNearest(point: Point, maxDistance: number, limit: number = 10): Array<{ docId: string; distance: number }> {
    const results: Array<{ docId: string; distance: number }> = [];

    for (const [docId, entry] of this.rtree) {
      if (entry.geometry.type === 'Point') {
        const distance = GeospatialEngine.pointNear(entry.geometry, point, maxDistance) ? 0 : Infinity;
        if (distance < maxDistance) {
          results.push({ docId, distance });
        }
      }
    }

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  private calculateBoundingBox(geometry: Point | Polygon | MultiPolygon): [number, number, number, number] {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

    const processCoords = (coords: number[][]) => {
      for (const [lng, lat] of coords) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    };

    if (geometry.type === 'Point') {
      const [lng, lat] = geometry.coordinates;
      return [lng, lat, lng, lat];
    } else if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach(ring => processCoords(ring));
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(polygon => polygon.forEach(ring => processCoords(ring)));
    }

    return [minLng, minLat, maxLng, maxLat];
  }
}
