# Contributing to Monarch Database

Thank you for your interest in contributing to Monarch Database! We welcome contributions from the community and are grateful for any help in improving this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Community](#community)

## 🤝 Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. By participating, you agree to:

- Be respectful and inclusive
- Focus on constructive feedback
- Accept responsibility for mistakes
- Show empathy towards other contributors
- Help create a positive community

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- TypeScript 5.0+
- Git

### Quick Setup

```bash
# Fork and clone the repository
git clone https://github.com/bantoinese83/Monarch-Database.git
cd monarch-database

# Install dependencies
npm install

# Run tests to ensure everything works
npm test

# Start development
npm run dev
```

## 🛠️ Development Setup

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bantoinese83/Monarch-Database.git
   cd monarch-database
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up pre-commit hooks (optional):**
   ```bash
   npm run prepare  # Sets up husky if configured
   ```

### Development Scripts

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Build the project
npm run build

# Run benchmarks
npm run benchmark

# Development server (if available)
npm run dev
```

## 🤝 How to Contribute

### Types of Contributions

- **🐛 Bug fixes** - Fix existing issues
- **✨ New features** - Add new functionality
- **📚 Documentation** - Improve docs, guides, examples
- **🧪 Tests** - Add or improve test coverage
- **🔧 Tools** - Development tools, scripts, CI/CD
- **🎨 UI/UX** - Improve user interfaces, CLIs

### Finding Issues to Work On

1. Check [GitHub Issues](https://github.com/bantoinese83/Monarch-Database/issues) for open tasks
2. Look for issues labeled `good first issue` or `help wanted`
3. Check the [Roadmap](https://github.com/bantoinese83/Monarch-Database/blob/main/docs/ROADMAP_ENTERPRISE_FEATURES.md)

### Reporting Bugs

When reporting bugs, please include:

- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Node.js version, etc.)
- **Code samples** if applicable
- **Error messages** and stack traces

## 📏 Development Guidelines

### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused (single responsibility)
- Use async/await over Promises when possible

### Commit Messages

Use conventional commit format:

```bash
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

Examples:
```
feat: add vector search support
fix: resolve memory leak in transaction manager
docs: update API reference for new methods
```

### Branch Naming

```bash
feature/description-of-feature
fix/issue-description
docs/update-documentation
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- collection.test.ts

# Run tests in watch mode
npm run test:watch
```

### Test Guidelines

- Write tests for all new features
- Include edge cases and error conditions
- Use descriptive test names
- Maintain high test coverage (>90%)
- Test both success and failure scenarios

### Benchmarking

```bash
# Run performance benchmarks
npm run benchmark
```

When making performance changes, include benchmark results in your PR.

## 📝 Submitting Changes

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes with tests
4. **Run** the full test suite: `npm test && npm run type-check && npm run lint`
5. **Update** documentation if needed
6. **Commit** with conventional commit messages
7. **Push** to your fork
8. **Create** a Pull Request with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/videos if UI changes
   - Benchmark results if performance changes

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation updated
- [ ] Benchmarks run (if performance changes)
- [ ] Commit messages follow conventional format

### Review Process

1. **Automated checks** run (tests, linting, type checking)
2. **Code review** by maintainers
3. **Feedback** and iterations
4. **Approval** and merge

## 🌐 Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussion
- **Pull Requests**: Code contributions

### Getting Help

- Check existing issues and documentation first
- Use GitHub Discussions for questions
- Join community calls (announced in Discussions)

### Recognition

Contributors are recognized through:
- GitHub contributor statistics
- Mention in release notes for significant contributions
- Community contributor badges

## 🙏 Thank You

Your contributions help make Monarch Database better for everyone. We appreciate all contributors, from bug fixes to major features, documentation improvements to community support.

Happy contributing! 🎉
