# Development Scripts Reference

This document provides a comprehensive reference for all npm scripts available in the Monarch Database project.

## 🏗️ Build & Development

### `npm run build`
Builds the project for production using Vite. Generates:
- `dist/index.js` - ES module bundle
- `dist/index.cjs` - CommonJS bundle
- `dist/index.d.ts` - TypeScript declarations

**Usage:**
```bash
npm run build
```

### `npm run dev`
Starts development mode with watch for benchmarking.

**Usage:**
```bash
npm run dev
```

### `npm run clean`
Removes build artifacts and temporary files:
- `dist/` directory
- `coverage/` directory
- `*.tsbuildinfo` files

**Usage:**
```bash
npm run clean
```

## 🧪 Testing

### `npm test`
Runs all tests using Vitest.

**Usage:**
```bash
npm test
```

### `npm run test:unit`
Runs only unit tests.

**Usage:**
```bash
npm run test:unit
```

### `npm run test:integration`
Runs only integration tests.

**Usage:**
```bash
npm run test:integration
```

### `npm run test:coverage`
Runs tests with coverage reporting.

**Usage:**
```bash
npm run test:coverage
```

### `npm run test:watch`
Runs tests in watch mode for development.

**Usage:**
```bash
npm run test:watch
```

### `npm run test:performance`
Runs performance/load tests.

**Usage:**
```bash
npm run test:performance
```

## 📝 Code Quality

### `npm run lint`
Runs ESLint on all TypeScript source files.

**Usage:**
```bash
npm run lint
```

### `npm run lint:fix`
Runs ESLint and automatically fixes fixable issues.

**Usage:**
```bash
npm run lint:fix
```

### `npm run format`
Formats all TypeScript files using Prettier.

**Usage:**
```bash
npm run format
```

### `npm run format:check`
Checks if files are properly formatted without making changes.

**Usage:**
```bash
npm run format:check
```

### `npm run type-check`
Runs TypeScript compiler in check mode (no emit).

**Usage:**
```bash
npm run type-check
```

## 🔍 Code Analysis

### `npm run knip`
Runs Knip to detect unused exports, dependencies, and files.

**Usage:**
```bash
npm run knip
```

### `npm run audit:dead-code`
Alias for `npm run knip` - detects dead code.

**Usage:**
```bash
npm run audit:dead-code
```

### `npm run audit:all`
Runs comprehensive code quality audit:
- Linting
- Type checking
- Tests
- Dead code detection

**Usage:**
```bash
npm run audit:all
```

### `npm run analyze:bundle`
Analyzes bundle size and composition using vite-bundle-visualizer.

**Usage:**
```bash
npm run analyze:bundle
```

### `npm run size:check`
Checks bundle size against configured limits.

**Usage:**
```bash
npm run size:check
```

## 📚 Documentation

### `npm run docs`
Generates API documentation using TypeDoc.

**Usage:**
```bash
npm run docs
```

Output: `docs/api/` directory

### `npm run docs:serve`
Generates and serves documentation with live reload.

**Usage:**
```bash
npm run docs:serve
```

## 🚀 Runtime & Deployment

### `npm start`
Starts the HTTP server (requires build first).

**Usage:**
```bash
npm run build
npm start
```

### `npm run server`
Builds and starts the HTTP server in one command.

**Usage:**
```bash
npm run server
```

## 🛠️ CLI Tools

### `npm run cli`
Runs the Monarch CLI tool.

**Usage:**
```bash
npm run cli -- --help
npm run cli init ./db
npm run cli create users ./db
```

### `npm run cli:build`
Builds the project and runs CLI.

**Usage:**
```bash
npm run cli:build
```

## 🔄 Migration Tools

### `npm run migrate:redis`
Runs Redis migration tool to import data from Redis.

**Usage:**
```bash
npm run migrate:redis -- --redis-host localhost --redis-port 6379
npm run migrate:redis -- --types string,hash --key-pattern "user:*"
npm run migrate:redis -- --dry-run --verbose
```

### `npm run migrate:mongodb`
Runs MongoDB migration tool to import data from MongoDB.

**Usage:**
```bash
npm run migrate:mongodb -- --mongo-database myapp
npm run migrate:mongodb -- --collections users,products --batch-size 500
```

## 📊 Benchmarking

### `npm run benchmark`
Runs performance benchmarks.

**Usage:**
```bash
npm run benchmark
```

## 🔧 Pre-publish

### `npm run prepublishOnly`
Automatically runs before publishing to npm:
1. Cleans build artifacts
2. Builds the project

**Usage:**
```bash
# Automatically runs on npm publish
npm publish
```

### `npm run prepare`
Sets up git hooks using Husky (runs after `npm install`).

**Usage:**
```bash
# Automatically runs on npm install
npm install
```

## 🎯 Common Workflows

### Development Workflow
```bash
# Start development
npm run dev

# In another terminal, run tests
npm run test:watch

# Format code before commit
npm run format
```

### Pre-Commit Checklist
```bash
# Run all quality checks
npm run audit:all

# Or individually:
npm run lint
npm run type-check
npm run test
npm run format:check
```

### Release Preparation
```bash
# Clean everything
npm run clean

# Run full audit
npm run audit:all

# Build for production
npm run build

# Generate docs
npm run docs

# Check bundle size
npm run size:check
```

### CI/CD Pipeline
```bash
# Install dependencies
npm ci

# Type check
npm run type-check

# Lint
npm run lint

# Format check
npm run format:check

# Run tests with coverage
npm run test:coverage

# Build
npm run build

# Bundle analysis (optional)
npm run analyze:bundle
```

## 📋 Script Summary

| Script | Purpose | Run in CI? |
|--------|---------|------------|
| `build` | Production build | ✅ |
| `test` | Run tests | ✅ |
| `test:coverage` | Tests with coverage | ✅ |
| `lint` | Code linting | ✅ |
| `lint:fix` | Auto-fix lint issues | ❌ |
| `format` | Format code | ❌ |
| `format:check` | Check formatting | ✅ |
| `type-check` | TypeScript validation | ✅ |
| `knip` | Dead code detection | ✅ |
| `docs` | Generate documentation | ❌ |
| `clean` | Clean artifacts | ❌ |
| `server` | Start HTTP server | ❌ |
| `benchmark` | Performance tests | ⚠️ (optional) |

## 🔗 Related Documentation

- [Getting Started Guide](./getting-started.md)
- [API Reference](./api-reference.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Project Structure](./PROJECT_STRUCTURE.md)

