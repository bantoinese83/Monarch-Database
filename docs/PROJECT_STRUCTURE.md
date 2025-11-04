# Project Structure

This document describes the organization of the Monarch Database project.

## Root Directory

The root contains only essential configuration and entry points:
- `package.json` - NPM package configuration
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `vitest.config.ts` - Test configuration
- `Dockerfile` - Docker image definition
- `docker-compose.yml` - Local development environment
- `README.md` - Main project documentation
- `.gitignore` - Git ignore rules

## Directory Structure

```
monarch-data/
├── src/                    # Source code
│   ├── adapters/          # Persistence adapters
│   └── [core modules]      # Main database implementation
│
├── test/                   # Unit tests
│
├── tests/                  # Integration & performance tests
│   └── performance/        # Load tests
│
├── examples/               # Example code and demos
│   ├── example.ts         # Basic usage example
│   ├── performance-example.ts
│   └── [other examples]   # TypeScript/JavaScript examples
│
├── docs/                   # All documentation
│   ├── api/               # API documentation
│   │   ├── complete-api.md
│   │   └── openapi.yaml
│   ├── audit/             # Audit and analysis docs
│   │   ├── PRODUCTION_READINESS_AUDIT.md
│   │   ├── PRODUCTION_READY_100.md
│   │   ├── IMPLEMENTATION_SUMMARY.md
│   │   └── QUICK_WINS_IMPLEMENTED.md
│   ├── deployment/        # Deployment guides
│   │   ├── production.md
│   │   └── kubernetes.md
│   ├── guides/            # Quick start guides
│   │   ├── QUICK_START_SERVER.md
│   │   └── NEXT_STEPS_ROADMAP.md
│   ├── operations/        # Operations guides
│   │   ├── troubleshooting.md
│   │   └── upgrade-guide.md
│   ├── api-reference.md   # API reference
│   ├── getting-started.md # Getting started guide
│   ├── DEVELOPMENT_SCRIPTS.md # Development scripts reference
│   └── DEVELOPER_ECOSYSTEM.md
│
├── kubernetes/            # Kubernetes manifests
│   ├── deployment.yaml
│   ├── configmap.yaml
│   └── service-monitor.yaml
│
├── monitoring/            # Monitoring configuration
│   ├── grafana-dashboard.json
│   └── prometheus-alerts.yaml
│
├── benchmarks/            # Benchmark scripts
│
└── dist/                 # Build output (gitignored)
```

## Documentation Organization

### `/docs/api/` - API Documentation
- `complete-api.md` - Complete API reference
- `openapi.yaml` - OpenAPI specification

### `/docs/audit/` - Audit & Analysis
All production readiness audit documents and implementation summaries:
- `PRODUCTION_READINESS_AUDIT.md` - Initial audit report
- `PRODUCTION_READY_100.md` - 100/100 completion report
- `PERFORMANCE_OPTIMIZATION_AUDIT.md` - Performance audit
- `PERFORMANCE_OPTIMIZATION_RESULTS.md` - Optimization results
- `QUICK_WINS_IMPLEMENTED.md` - Quick wins summary
- `IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `CLEANUP_SUMMARY.md` - Project cleanup summary
- `QUALITY_REPORT.md` - Final quality check report

### `/docs/deployment/` - Deployment Guides
- `production.md` - Production deployment guide
- `kubernetes.md` - Kubernetes-specific guide

### `/docs/guides/` - Quick Start Guides
- `QUICK_START_SERVER.md` - Server mode quick start
- `NEXT_STEPS_ROADMAP.md` - Future development roadmap

### `/docs/operations/` - Operations Manuals
- `troubleshooting.md` - Troubleshooting guide
- `upgrade-guide.md` - Upgrade procedures

## Examples

All example code is in `/examples/`:
- `example.ts` - Basic usage
- `performance-example.ts` - Performance demo
- `advanced-caching-demo.ts` - Caching examples
- `enterprise-monarch-demo.ts` - Enterprise features
- `vector-database-demo.ts` - Vector search examples

## Key Files

### Configuration Files (Root)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript settings
- `.gitignore` - Git ignore rules
- `.cursorignore` - Cursor IDE ignore rules

### Infrastructure Files (Root)
- `Dockerfile` - Container image
- `docker-compose.yml` - Local development

### Source Code
- `src/index.ts` - Main entry point and exports
- `src/monarch.ts` - Core database class
- `src/collection.ts` - Collection implementation

## Notes

- All documentation moved from root to `/docs/` subdirectories
- All examples moved from root to `/examples/`
- Temporary test files removed
- Backup files removed
- Build artifacts ignored (dist/, coverage/, etc.)

