# Troubleshooting Guide

Common issues and solutions for Monarch Database operations.

## Health Check Failures

### Issue: `/health` returns `unhealthy`

**Symptoms:**
- Health endpoint returns status `unhealthy` or `degraded`
- Service appears down

**Diagnosis:**
```bash
curl http://localhost:7331/health
# Check response for specific failures
```

**Solutions:**
1. Check memory usage:
   ```bash
   # High memory usage (>90%)
   # Solution: Increase container memory or reduce maxConcurrentOperations
   ```

2. Check logs:
   ```bash
   kubectl logs -f deployment/monarch-db | grep -i error
   ```

3. Restart service:
   ```bash
   kubectl rollout restart deployment/monarch-db
   ```

## High Memory Usage

### Issue: Memory usage >90%

**Symptoms:**
- Memory alerts firing
- Service becoming slow
- Potential OOM kills

**Solutions:**
1. **Reduce concurrent operations:**
   ```typescript
   config.performance.maxConcurrentOperations = 50; // Reduce from default
   ```

2. **Enable compression:**
   ```typescript
   config.durability.compressionEnabled = true;
   ```

3. **Reduce cache sizes:**
   ```typescript
   config.performance.queryCacheSize = 500; // Reduce from default
   ```

4. **Increase container memory:**
   ```yaml
   resources:
     limits:
       memory: "2Gi"  # Increase as needed
   ```

## Slow Operations

### Issue: High operation latency

**Symptoms:**
- Operations taking >1 second
- High `operation_duration_seconds` metrics

**Diagnosis:**
```bash
curl http://localhost:7331/metrics | grep operation_duration
```

**Solutions:**
1. **Enable query cache:**
   ```typescript
   config.performance.queryCacheSize = 5000;
   ```

2. **Optimize queries:**
   - Use indexed fields
   - Limit result sets
   - Use projections

3. **Check system resources:**
   ```bash
   kubectl top pods -n monarch
   ```

## Connection Issues

### Issue: Cannot connect to service

**Diagnosis:**
```bash
# Test connectivity
curl http://localhost:7331/health

# Check service endpoints
kubectl get endpoints -n monarch
```

**Solutions:**
1. **Check service status:**
   ```bash
   kubectl get svc monarch-db-service -n monarch
   ```

2. **Verify port forwarding:**
   ```bash
   kubectl port-forward service/monarch-db-service 7331:7331 -n monarch
   ```

3. **Check firewall rules**

## Data Loss / Corruption

### Issue: Data missing or corrupted

**Recovery:**
1. **Restore from backup:**
   ```typescript
   const backupManager = new BackupManager(config);
   const data = await backupManager.restoreBackup('backup_1234567890');
   ```

2. **Recover from WAL:**
   ```typescript
   await durabilityManager.recoverFromWAL();
   ```

3. **Check snapshot:**
   ```typescript
   const snapshots = await durabilityManager.listSnapshots();
   // Restore from most recent snapshot
   ```

## Performance Degradation

### Issue: Gradual performance decrease

**Diagnosis:**
- Check metrics trends in Grafana
- Review operation counts
- Check cache hit rates

**Solutions:**
1. **Clear caches:**
   ```typescript
   queryCache.clear();
   ```

2. **Rebuild indexes:**
   ```typescript
   collection.rebuildIndexes();
   ```

3. **Restart service:**
   ```bash
   kubectl rollout restart deployment/monarch-db
   ```

## Error Messages

### Common Errors and Solutions

#### "Resource limit exceeded"
- **Cause:** Operation exceeds configured limits
- **Solution:** Increase limits or optimize queries

#### "Validation error"
- **Cause:** Invalid input data
- **Solution:** Validate input before inserting

#### "Rate limit exceeded"
- **Cause:** Too many requests
- **Solution:** Implement rate limiting or increase limits

#### "Memory limit exceeded"
- **Cause:** Not enough memory
- **Solution:** Increase container memory or reduce data size

## Log Analysis

### Finding Errors

```bash
# Filter errors
kubectl logs -f deployment/monarch-db | grep -i error

# Filter warnings
kubectl logs -f deployment/monarch-db | grep -i warn

# Search by timestamp
kubectl logs --since=1h deployment/monarch-db
```

### Log Levels

Set appropriate log level:
```env
MONARCH_LOG_LEVEL=debug  # For detailed debugging
MONARCH_LOG_LEVEL=info   # For production (default)
MONARCH_LOG_LEVEL=warn   # For warnings only
```

## Emergency Procedures

### Service Recovery

1. **Restart service:**
   ```bash
   kubectl rollout restart deployment/monarch-db
   ```

2. **Scale down and up:**
   ```bash
   kubectl scale deployment monarch-db --replicas=0
   kubectl scale deployment monarch-db --replicas=3
   ```

3. **Delete and recreate:**
   ```bash
   kubectl delete deployment monarch-db
   kubectl apply -f kubernetes/deployment.yaml
   ```

### Data Recovery

1. **Stop service**
2. **Restore from backup**
3. **Verify data integrity**
4. **Restart service**

## Getting Help

1. Check logs: `kubectl logs -f deployment/monarch-db`
2. Check metrics: `curl http://localhost:7331/metrics`
3. Review documentation
4. Contact support: support@bantoinese83/Monarch-Database

