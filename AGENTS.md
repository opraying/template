# AGENTS.md

TypeScript monorepo guidance for LLM Agents

## Code Conventions

- **TypeScript**: Strict configuration across all packages for type safety
- **Naming**: `@xstack/*` (platform packages), `@infra/*` (infrastructure services)
- **State Management**: Use Effect-Atom for reactive React components
- **Data Layer**: SQLite for local storage, Effect for sync operations
- **Testing**: `@xstack/testing` utilities required for all packages
- **Imports**: Path aliases defined in tsconfig (e.g., `@xstack/lib`)
- **Style**: Functional programming, immutable data structures

## Root Structure

- infra: Infrastructure packages (@infra/\*)
- packages: Platform libraries (@xstack/\*)
- apps: Applications
- docs: Documentation

## Packages

- `toaster`: Toast notification components
- `router`: Routing utilities
- `i18n`: Internationalization support
- `form`: Form handling and validation
- `server`: Server utilities and middleware
- `db`: Database abstractions for both frontend SQLite and backend databases
- `event-log`: Event sourcing and logging for local-first sync
- `lib`: Core utility functions
- `fx`: Effect-TS utilities
- `atom-react`: Effect & React state management like jotai
- `app`: Application framework
- `app-kit`: Application development kit
- `user-kit`: User management utilities

## Applications Structure

- web: Frontend applications
- server: Backend services and APIs (cloudflare workers)
- mobile: React Native/Expo applications
- shared: Shared libraries and utilities
- client: Pure client business logic shared across all apps
- emails: Email templates and services

## Development Workflow

Nx is our primary development orchestrator, managing 50+ packages and applications with intelligent caching, dependency tracking, and parallel execution.

### Nx Commands

```bash
nx show projects                          # List all projects

nx serve <project>                        # Start development server
nx app-build <project>                    # Build applications
nx app-deploy <project>                   # Deploy applications
nx typecheck <project>                    # Type checking
nx test <project>                         # Run tests
nx madge <project>                        # Check circular dependencies

nx db <project> --configuration=seed      # seed, push, dump, execute, dev, reset, deploy

nx run-many -t <target> -p "apps-*"       # All application
nx run-many -t <target> -p "*-web"        # All web apps

nx run-many -t <target> --all             # All projects
nx run-many -t test --exclude="*-e2e"     # Exclude patterns
nx run-many -t typecheck --parallel=4     # Control parallelism

nx affected -t <target>                   # Only changed projects
nx affected -t <target> --base=main       # Changed from main branch
```

- Always run from monorepo root
- Always prefer `nx affected` over `nx run-many --all` for efficiency.
  ll` for efficiency.
