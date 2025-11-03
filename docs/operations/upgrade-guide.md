# Upgrade Guide

Step-by-step guide for upgrading Monarch Database.

## Pre-Upgrade Checklist

- [ ] Review release notes
- [ ] Backup all data
- [ ] Test upgrade in staging
- [ ] Review breaking changes
- [ ] Schedule maintenance window

## Backup Before Upgrade

```typescript
import { BackupManager } from 'monarch-database';

const backupManager = new BackupManager({
  enabled: true,
  compress: true
});

await backupManager.initialize();
const backup = await backupManager.createBackup(dbData);
console.log(`Backup created: ${backup.id}`);
```

## Upgrade Steps

### 1. Stop Service

```bash
# Docker
docker stop monarch-db

# Kubernetes
kubectl scale deployment monarch-db --replicas=0 -n monarch
```

### 2. Update Code

```bash
# Pull latest version
git pull origin main

# Install dependencies
npm install

# Build
npm run build
```

### 3. Update Configuration

Review and update configuration if needed:

```typescript
// Check for new config options
const newConfig = {
  // ... existing config
  // Add any new options from release notes
};
```

### 4. Start Service

```bash
# Docker
docker start monarch-db

# Kubernetes
kubectl scale deployment monarch-db --replicas=3 -n monarch
```

### 5. Verify

```bash
# Check health
curl http://localhost:7331/health

# Check logs
kubectl logs -f deployment/monarch-db

# Verify data
# Run your verification scripts
```

## Rollback Procedure

If upgrade fails:

### 1. Stop Service

```bash
kubectl scale deployment monarch-db --replicas=0 -n monarch
```

### 2. Restore Backup

```typescript
const data = await backupManager.restoreBackup('backup_1234567890');
```

### 3. Revert Code

```bash
git checkout <previous-version>
npm install
npm run build
```

### 4. Restart Service

```bash
kubectl scale deployment monarch-db --replicas=3 -n monarch
```

## Version-Specific Notes

### v1.0.0 → v1.1.0

- New logger configuration
- Health check endpoints added
- Breaking: Some console.log replaced with logger

**Migration:**
```typescript
// Update logging calls
import { logger } from 'monarch-database';
logger.info('Message', { context });
```

## Post-Upgrade

- [ ] Verify all endpoints working
- [ ] Check metrics
- [ ] Run smoke tests
- [ ] Monitor for 24 hours
- [ ] Document any issues

