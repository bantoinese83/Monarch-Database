# Production Deployment Guide

Complete guide for deploying Monarch Database in production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Configuration](#configuration)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup Strategy](#backup-strategy)
8. [Security Hardening](#security-hardening)
9. [Scaling](#scaling)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ or Docker
- Kubernetes cluster (for K8s deployment)
- Monitoring stack (Prometheus + Grafana recommended)
- Backup storage (S3, Azure Blob, or GCP Storage)

## Environment Setup

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure Production Variables

```env
NODE_ENV=production
MONARCH_PORT=7331
MONARCH_LOG_LEVEL=info
MONARCH_LOG_FORMAT=json
MONARCH_DATA_DIR=/app/data
MONARCH_MAX_CONCURRENT_OPERATIONS=100
MONARCH_OPERATION_TIMEOUT=30000

# Durability
MONARCH_WAL_ENABLED=true
MONARCH_SNAPSHOT_INTERVAL=300000
MONARCH_SYNC_INTERVAL=5000

# Security
MONARCH_ENCRYPTION_ENABLED=true
MONARCH_ENCRYPTION_KEY=<your-encryption-key>

# Clustering (if enabled)
MONARCH_CLUSTER_ENABLED=true
MONARCH_NODE_ID=node_1
```

## Docker Deployment

### Build Image

```bash
docker build -t monarch-db:latest .
```

### Run Container

```bash
docker run -d \
  --name monarch-db \
  -p 7331:7331 \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  --env-file .env \
  --restart unless-stopped \
  monarch-db:latest
```

### Docker Compose

```bash
docker-compose up -d
```

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace monarch
```

### 2. Create ConfigMap

```bash
kubectl apply -f kubernetes/configmap.yaml
```

### 3. Deploy Application

```bash
kubectl apply -f kubernetes/deployment.yaml
```

### 4. Verify Deployment

```bash
kubectl get pods -n monarch
kubectl logs -f deployment/monarch-db -n monarch
```

### 5. Access Service

```bash
kubectl port-forward service/monarch-db-service 7331:7331 -n monarch
```

## Configuration

### Performance Tuning

```typescript
const db = new Monarch({
  config: {
    performance: {
      maxConcurrentOperations: 100,
      queryCacheSize: 5000,
      queryCacheTTL: 600000
    },
    limits: {
      maxDocumentSize: 50 * 1024 * 1024,
      maxDocumentsPerCollection: 1000000
    }
  }
});
```

### Durability Configuration

```typescript
await db.configureDurability({
  level: 'high',
  syncInterval: 1000,
  snapshotInterval: 300000,
  compressionEnabled: true,
  encryptionEnabled: true
});
```

## Monitoring Setup

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'monarch-db'
    scrape_interval: 30s
    static_configs:
      - targets: ['monarch-db-service:7331']
    metrics_path: '/metrics'
```

### Grafana Dashboard

1. Import dashboard: `monitoring/grafana-dashboard.json`
2. Configure Prometheus data source
3. Set up alerts using `monitoring/prometheus-alerts.yaml`

## Backup Strategy

### Automated Backups

```typescript
import { BackupManager } from 'monarch-database';

const backupManager = new BackupManager({
  enabled: true,
  interval: 24 * 60 * 60 * 1000, // Daily
  retentionDays: 30,
  maxBackups: 10,
  compress: true,
  cloudStorage: {
    provider: 's3',
    bucket: 'monarch-backups',
    region: 'us-east-1'
  }
});

await backupManager.initialize();
```

### Manual Backup

```typescript
const metadata = await backupManager.createBackup(dbData);
console.log(`Backup created: ${metadata.id}`);
```

### Restore

```typescript
const data = await backupManager.restoreBackup('backup_1234567890');
```

## Security Hardening

### Rate Limiting

```typescript
import { RateLimiter } from 'monarch-database';

const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  blockDuration: 60000
});

// Apply to HTTP server
const result = rateLimiter.check(clientIP);
if (!result.allowed) {
  return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

### Input Sanitization

```typescript
import { InputSanitizer } from 'monarch-database';

const sanitizer = new InputSanitizer();
const cleanQuery = sanitizer.sanitizeQuery(userQuery);
```

## Scaling

### Horizontal Scaling (Kubernetes)

```bash
kubectl scale deployment monarch-db --replicas=5 -n monarch
```

### Vertical Scaling

Update resource limits in `kubernetes/deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

## Troubleshooting

### Health Checks

```bash
# Check health
curl http://localhost:7331/health

# Check readiness
curl http://localhost:7331/ready

# Check metrics
curl http://localhost:7331/metrics
```

### Common Issues

1. **Out of Memory**
   - Reduce `maxConcurrentOperations`
   - Increase container memory limits
   - Enable compression

2. **High Latency**
   - Increase `queryCacheSize`
   - Optimize queries
   - Check network latency

3. **Service Unavailable**
   - Check logs: `kubectl logs -f deployment/monarch-db`
   - Verify health endpoints
   - Check resource limits

## Next Steps

- Set up automated backups
- Configure alerting
- Review security settings
- Load test your deployment
- Set up disaster recovery procedures

