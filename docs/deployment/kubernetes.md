# Kubernetes Deployment Guide

Complete guide for deploying Monarch Database on Kubernetes.

## Quick Start

```bash
# Create namespace
kubectl create namespace monarch

# Deploy all resources
kubectl apply -f kubernetes/ -n monarch

# Check status
kubectl get all -n monarch

# View logs
kubectl logs -f deployment/monarch-db -n monarch
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Kubernetes Cluster              │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │   Monarch   │  │   Monarch   │      │
│  │  Pod (3x)   │  │  Pod (HPA)  │      │
│  └─────────────┘  └─────────────┘      │
│         │                  │           │
│  ┌──────▼──────────────────▼──────┐   │
│  │      Service (ClusterIP)       │   │
│  └──────┬──────────────────┬──────┘   │
│         │                  │           │
│  ┌──────▼──────────────────▼──────┐   │
│  │   PersistentVolume (Data)      │   │
│  └────────────────────────────────┘   │
│         │                              │
│  ┌──────▼──────────────────────────┐ │
│  │   ConfigMap (Configuration)     │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Components

### 1. Deployment

Manages the Monarch Database pods:

- **Replicas:** 3 (configurable)
- **Resources:** CPU/Memory limits
- **Health Checks:** Liveness, Readiness, Startup probes
- **Auto-scaling:** HPA configured

### 2. Service

Exposes Monarch Database:

- **Type:** ClusterIP (internal only)
- **Ports:** 7331 (HTTP), 9090 (metrics)

### 3. PersistentVolumeClaim

Stores database data:

- **Size:** 10Gi (configurable)
- **Access Mode:** ReadWriteOnce

### 4. HorizontalPodAutoscaler

Auto-scaling configuration:

- **Min Replicas:** 3
- **Max Replicas:** 10
- **CPU Target:** 70%
- **Memory Target:** 80%

### 5. ConfigMap

Configuration values:

- Log levels
- Performance settings
- Data directory

## Customization

### Update Resource Limits

Edit `kubernetes/deployment.yaml`:

```yaml
resources:
  requests:
    memory: "1Gi"    # Increase for heavy workloads
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "4000m"
```

### Change Replica Count

```bash
kubectl scale deployment monarch-db --replicas=5 -n monarch
```

### Update Configuration

Edit `kubernetes/configmap.yaml` and apply:

```bash
kubectl apply -f kubernetes/configmap.yaml -n monarch
kubectl rollout restart deployment/monarch-db -n monarch
```

## Monitoring Integration

### Prometheus ServiceMonitor

```bash
# Apply ServiceMonitor (requires Prometheus Operator)
kubectl apply -f kubernetes/service-monitor.yaml -n monarch
```

### Access Metrics

```bash
# Port forward
kubectl port-forward service/monarch-db-service 9090:7331 -n monarch

# Query metrics
curl http://localhost:9090/metrics
```

## Backup in Kubernetes

### Setup Backup CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: monarch-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: monarch-db:latest
            command: ["node", "backup-script.js"]
          restartPolicy: OnFailure
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n monarch

# Check logs
kubectl logs <pod-name> -n monarch

# Check events
kubectl get events -n monarch --sort-by='.lastTimestamp'
```

### Health Check Failures

```bash
# Test health endpoint
kubectl exec -it <pod-name> -n monarch -- curl http://localhost:7331/health

# Check probe configuration
kubectl get deployment monarch-db -n monarch -o yaml | grep -A 10 "livenessProbe"
```

### Resource Issues

```bash
# Check resource usage
kubectl top pods -n monarch

# Check resource limits
kubectl describe pod <pod-name> -n monarch | grep -A 5 "Limits"
```

## Production Checklist

- [ ] Configure resource limits
- [ ] Set up PersistentVolume with appropriate storage class
- [ ] Configure backup CronJob
- [ ] Set up Prometheus monitoring
- [ ] Import Grafana dashboard
- [ ] Configure alert rules
- [ ] Set up ingress (if external access needed)
- [ ] Enable TLS/SSL
- [ ] Configure network policies
- [ ] Set up log aggregation

