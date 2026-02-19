# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TetherAI is a pnpm monorepo of standalone TypeScript AI provider packages. Each provider (`packages/provider/*`) is fully self-contained with zero runtime dependencies — types, middleware, SSE utilities, and error classes are all bundled in.

**Providers**: OpenAI, Anthropic, Mistral, Grok, Local (Ollama/LM Studio)

## Commands

```bash
# Build
pnpm run build                # All providers
pnpm run build:openai         # Single provider (anthropic, mistral, grok, local)
pnpm run clean                # Remove dist artifacts

# Test (Vitest)
pnpm run test                 # Watch mode
pnpm run test:run             # Single run (CI mode)
pnpm run test:run -- tests/unit/providers/openai.test.ts   # Single file
pnpm run test:run -- --testNamePattern="pattern"           # By name

# Lint & Format
pnpm run lint                 # Lint (auto-builds first via prelint hook)
pnpm run lint:fix             # Lint + fix
pnpm run format               # Prettier
```

## Architecture

### Provider structure

Every provider package follows this layout:

- `src/index.ts` — re-exports everything
- `src/<provider>.ts` — implements the `Provider` interface: `streamChat()`, `chat()`, `getModels()`, `validateModel()`, `getMaxTokens()`
- `src/types.ts` — types + provider-specific Error class (extends Error with `status: number`)
- `src/middleware.ts` — `withRetry()` and `withFallback()` composable wrappers
- `src/sse.ts` — `sseToIterable()` for streaming

### Build pipeline

Each provider uses `tsc` + a custom `scripts/dist.mjs` that compiles to `dist/build/`, adds `.js` extensions to imports, then moves artifacts to `dist/src/`.

### Standalone constraint

Provider packages must have **zero** `dependencies` in `package.json`. Everything needed at runtime is included in the package source.

## Code Conventions

- **No `any`** — ESLint enforces `@typescript-eslint/no-explicit-any` as error; use `unknown` + type guards
- **ES modules** — `"type": "module"` everywhere; internal imports require explicit `.js` extensions
- **Named exports** over default exports
- **Naming**: files in kebab-case, types in PascalCase, functions in camelCase, error classes end with `Error`
- **Imports grouped**: external → internal → types
- **Formatting**: Prettier with double quotes, semicolons, trailing commas (es5), 80 char width

## CI Pipeline Order

`pnpm install --frozen-lockfile` → `build` → verify dist artifacts exist → `lint` → `test:run` → type-check & build Next.js example
