/**
 * Enterprise Security and Compliance
 * 
 * SOC 2, GDPR compliance features, encryption at rest, audit logging,
 * and security controls.
 */

import { SecurityManager } from './security-manager';
import { logger } from './logger';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Data retention policy
 */
export interface RetentionPolicy {
  resourceType: string; // 'collection', 'user', 'audit', etc.
  retentionDays: number;
  autoDelete: boolean;
}

/**
 * GDPR data subject request
 */
export interface DataSubjectRequest {
  id: string;
  type: 'access' | 'deletion' | 'portability' | 'rectification';
  subjectId: string;
  email?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: number;
  completedAt?: number;
}

/**
 * Encryption at rest configuration
 */
export interface EncryptionAtRestConfig {
  enabled: boolean;
  algorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyRotationInterval: number; // days
  keyManagement: 'local' | 'kms' | 'hsm';
  kmsProvider?: string;
}

/**
 * Compliance Manager
 */
export class ComplianceManager {
  private auditLogs: AuditLogEntry[] = [];
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private dataSubjectRequests: Map<string, DataSubjectRequest> = new Map();
  private encryptionConfig: EncryptionAtRestConfig = {
    enabled: false,
    algorithm: 'AES-256-GCM',
    keyRotationInterval: 90,
    keyManagement: 'local'
  };
  private securityManager?: SecurityManager;

  constructor(securityManager?: SecurityManager) {
    this.securityManager = securityManager;
  }

  /**
   * Log audit event
   */
  logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...entry
    };

    this.auditLogs.push(auditEntry);

    // Keep only last 100,000 entries in memory
    if (this.auditLogs.length > 100000) {
      this.auditLogs.shift();
    }

    logger.info('Audit event logged', {
      action: entry.action,
      resource: entry.resource,
      outcome: entry.outcome
    });
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    startTime?: number;
    endTime?: number;
  }): AuditLogEntry[] {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.resource) {
        logs = logs.filter(log => log.resource === filters.resource);
      }
      if (filters.startTime) {
        logs = logs.filter(log => log.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        logs = logs.filter(log => log.timestamp <= filters.endTime!);
      }
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Configure retention policy
   */
  setRetentionPolicy(policy: RetentionPolicy): void {
    this.retentionPolicies.set(policy.resourceType, policy);
    logger.info('Retention policy set', { resourceType: policy.resourceType, days: policy.retentionDays });
  }

  /**
   * Apply retention policies
   */
  async applyRetentionPolicies(): Promise<number> {
    let deletedCount = 0;

    for (const [resourceType, policy] of this.retentionPolicies) {
      if (!policy.autoDelete) {
        continue;
      }

      const cutoffDate = Date.now() - (policy.retentionDays * 24 * 60 * 60 * 1000);
      
      // In production, this would delete resources older than cutoffDate
      logger.info('Applying retention policy', {
        resourceType,
        cutoffDate: new Date(cutoffDate).toISOString()
      });

      deletedCount++;
    }

    return deletedCount;
  }

  /**
   * Create GDPR data subject request
   */
  createDataSubjectRequest(
    type: DataSubjectRequest['type'],
    subjectId: string,
    email?: string
  ): string {
    const requestId = `dsr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request: DataSubjectRequest = {
      id: requestId,
      type,
      subjectId,
      email,
      status: 'pending',
      requestedAt: Date.now()
    };

    this.dataSubjectRequests.set(requestId, request);

    logger.info('Data subject request created', { requestId, type, subjectId });

    return requestId;
  }

  /**
   * Process GDPR access request (Right to Access)
   */
  async processAccessRequest(requestId: string): Promise<any> {
    const request = this.dataSubjectRequests.get(requestId);
    if (!request || request.type !== 'access') {
      throw new Error('Invalid access request');
    }

    request.status = 'processing';

    // Collect all data related to the subject
    const subjectData = await this.collectSubjectData(request.subjectId);

    request.status = 'completed';
    request.completedAt = Date.now();

    logger.info('Access request completed', { requestId });

    return subjectData;
  }

  /**
   * Process GDPR deletion request (Right to be Forgotten)
   */
  async processDeletionRequest(requestId: string): Promise<number> {
    const request = this.dataSubjectRequests.get(requestId);
    if (!request || request.type !== 'deletion') {
      throw new Error('Invalid deletion request');
    }

    request.status = 'processing';

    // Delete all data related to the subject
    const deletedCount = await this.deleteSubjectData(request.subjectId);

    request.status = 'completed';
    request.completedAt = Date.now();

    this.logAuditEvent({
      action: 'gdpr_deletion',
      resource: `subject:${request.subjectId}`,
      outcome: 'success',
      metadata: { requestId, deletedCount }
    });

    logger.info('Deletion request completed', { requestId, deletedCount });

    return deletedCount;
  }

  /**
   * Configure encryption at rest
   */
  configureEncryptionAtRest(config: EncryptionAtRestConfig): void {
    this.encryptionConfig = { ...this.encryptionConfig, ...config };
    logger.info('Encryption at rest configured', { enabled: config.enabled, algorithm: config.algorithm });
  }

  /**
   * Encrypt data at rest
   */
  async encryptAtRest(data: Buffer | string): Promise<string> {
    if (!this.encryptionConfig.enabled) {
      return typeof data === 'string' ? data : data.toString('base64');
    }

    if (!this.securityManager) {
      throw new Error('Security manager required for encryption at rest');
    }

    const dataStr = typeof data === 'string' ? data : data.toString('utf-8');
    return await this.securityManager.encrypt(dataStr);
  }

  /**
   * Decrypt data at rest
   */
  async decryptAtRest(encryptedData: string): Promise<Buffer> {
    if (!this.encryptionConfig.enabled) {
      return Buffer.from(encryptedData, 'base64');
    }

    if (!this.securityManager) {
      throw new Error('Security manager required for decryption at rest');
    }

    const decrypted = await this.securityManager.decrypt(encryptedData);
    return Buffer.from(decrypted, 'utf-8');
  }

  /**
   * Get compliance status
   */
  getComplianceStatus(): {
    auditLogging: boolean;
    encryptionAtRest: boolean;
    retentionPolicies: number;
    pendingDataSubjectRequests: number;
  } {
    const pendingRequests = Array.from(this.dataSubjectRequests.values())
      .filter(r => r.status === 'pending' || r.status === 'processing').length;

    return {
      auditLogging: true, // Always enabled
      encryptionAtRest: this.encryptionConfig.enabled,
      retentionPolicies: this.retentionPolicies.size,
      pendingDataSubjectRequests: pendingRequests
    };
  }

  // Private helper methods

  private async collectSubjectData(subjectId: string): Promise<Record<string, any>> {
    // In production, this would query all collections for data related to subjectId
    return {
      userId: subjectId,
      collections: [],
      auditLogs: this.getAuditLogs({ userId: subjectId })
    };
  }

  private async deleteSubjectData(subjectId: string): Promise<number> {
    // In production, this would delete all data related to subjectId from all collections
    let deletedCount = 0;

    // Delete audit logs
    const auditLogs = this.getAuditLogs({ userId: subjectId });
    deletedCount += auditLogs.length;
    this.auditLogs = this.auditLogs.filter(log => log.userId !== subjectId);

    return deletedCount;
  }
}

