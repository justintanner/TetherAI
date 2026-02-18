# TetherAI Agent Guidelines

This document provides essential information for agents working in the TetherAI repository.

## Project Overview

TetherAI is a TypeScript monorepo providing standalone AI provider packages. Each package is self-contained with no external dependencies.

- **Package Manager**: pnpm (v9.0.0+)
- **Node Version**: >=18.12.0
- **Monorepo Structure**: `packages/provider/*` contains provider packages
- **Providers**: OpenAI, Anthropic, Mistral, Grok, Local LLM

## Build Commands

```bash
pnpm run build              # Build all providers
pnpm run build:openai       # Build specific provider (anthropic, mistral, grok, local)
pnpm run clean              # Clean build artifacts
pnpm install                # Install dependencies
```

## Lint Commands

```bash
pnpm run lint              # Check linting (builds first via prelint hook)
pnpm run lint:fix          # Fix linting issues
pnpm run format            # Format with Prettier
```

## Test Commands

```bash
pnpm run test              # Run tests in watch mode
pnpm run test:run          # Run tests once (CI mode)
pnpm run test:ui           # Run tests with UI
pnpm run test:run -- tests/unit/providers/openai.test.ts     # Run single test file
pnpm run test:run -- --testNamePattern="should accept valid" # Run matching pattern
pnpm run test:run -- tests/unit/middleware/                  # Run specific directory
```

## Code Style Guidelines

### TypeScript Configuration

- **Target**: ES2022 with ESNext modules
- **Module Resolution**: Bundler
- **Strict Mode**: Enabled (`strict: true`)
- **Declaration Files**: Generate `.d.ts` for all packages

### Formatting (Prettier)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 80,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Naming Conventions

- **Files**: kebab-case (e.g., `openai-provider.test.ts`)
- **Types/Interfaces**: PascalCase (e.g., `ChatRequest`, `OpenAIOptions`)
- **Functions**: camelCase (e.g., `streamChat`, `sseToIterable`)
- **Constants**: camelCase for local, UPPER_SNAKE for true constants
- **Classes**: PascalCase with Error suffix (e.g., `OpenAIError`)

### Imports

- Use ES modules (`"type": "module"`)
- Group imports: external, internal, types
- Use explicit `.js` extensions for internal imports
- Prefer named exports over default exports

```typescript
// Good
import { openAI } from "./openai.js";
import type { ChatRequest } from "./types.js";

// Avoid
import openAI from "./openai";
```

### Types

- **Never use `any`**: ESLint rule `@typescript-eslint/no-explicit-any` is error
- Prefer `unknown` over `any` for runtime validation
- Use type guards (e.g., `isOpenAIErrorBody`)
- Explicit return types on exported functions

### Error Handling

Create provider-specific error classes extending `Error` with HTTP status codes and readonly properties:

```typescript
export class OpenAIError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}
```

### Testing

- **Framework**: Vitest with globals enabled
- **File Pattern**: `*.test.ts`
- **Mocking**: Use `vi.fn()` and `vi.mock()` from Vitest
- **Structure**: Arrange → Act → Assert
- Place tests in `tests/unit/`, `tests/integration/`, or `tests/e2e/`

## Architecture Patterns

### Standalone Packages

Each provider package (`packages/provider/*/`) must be completely self-contained:

- No external runtime dependencies
- Include all types, utilities, and middleware
- Export everything from `src/index.ts`

### Provider Interface

All providers implement: `streamChat()`, `chat()`, `getModels()`, `validateModel()`, `getMaxTokens()`

### Middleware Pattern

Providers export composable middleware: `withRetry()`, `withFallback()`

## CI/CD Requirements

CI runs in order: `pnpm install --frozen-lockfile` → `pnpm run build` → verify dist artifacts → `pnpm run lint` → `pnpm run test:run` → type check Next.js example → build Next.js example

## Common Pitfalls

- Provider packages must have zero dependencies in `package.json`
- Always build before running lint (prelint hook)
- Tests should not make real API calls - use mocks
- Import paths must use `.js` extension for ES modules
- Use `.nvmrc` for Node version (currently 18+)
- API keys should be environment variables, never hardcoded
