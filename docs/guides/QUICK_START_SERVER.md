# Quick Start: Server Mode

Monarch Database now includes an optional HTTP server mode for health checks, metrics, and monitoring.

## Starting the Server

```bash
# Build and start
npm run server

# Or separately
npm run build
npm start
```

The server will start on port 7331 (or `MONARCH_PORT` env var).

## Endpoints

### Health Check
```bash
curl http://localhost:7331/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0"
}
```

### Readiness Check
```bash
curl http://localhost:7331/ready
```

Returns:
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "memory": true,
    "disk": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Liveness Check
```bash
curl http://localhost:7331/live
```

Returns:
```json
{
  "alive": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Prometheus Metrics
```bash
curl http://localhost:7331/metrics
```

Returns Prometheus-formatted metrics:
```
# HELP monarch_uptime_seconds Service uptime in seconds
# TYPE monarch_uptime_seconds gauge
monarch_uptime_seconds 3600.5

# HELP monarch_memory_used_bytes Memory used in bytes
# TYPE monarch_memory_used_bytes gauge
monarch_memory_used_bytes 52428800
...
```

## Configuration

Set environment variables or create a `.env` file:

```env
NODE_ENV=production
MONARCH_PORT=7331
MONARCH_LOG_LEVEL=info
MONARCH_LOG_FORMAT=json
MONARCH_DATA_DIR=./data
```

## Docker

```bash
docker build -t monarch-db .
docker run -p 7331:7331 monarch-db
```

## Kubernetes

```bash
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/configmap.yaml
```

Check health:
```bash
kubectl get pods -l app=monarch-db
kubectl logs -l app=monarch-db
```

## Notes

- The server is **optional** - Monarch still works as a library
- Health endpoints are required for Kubernetes deployments
- Metrics endpoint enables Prometheus monitoring
- Server runs on port 7331 by default (configurable)

