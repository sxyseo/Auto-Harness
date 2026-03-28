# Architectural Context Prompt Template

## Purpose

This template provides architectural context for PR review agents. Include this context in agent prompts to help them understand the project's architecture, design patterns, and architectural decisions before performing code review.

## Template Variables

Use these placeholders when invoking review agents:

```markdown
## Architectural Context

### Technology Stack
- **Frontend**: {frontend_stack}
- **Backend**: {backend_stack}
- **Database**: {database}
- **Key Libraries**: {key_libraries}
- **Runtime**: {runtime}

### Architecture Pattern
{architecture_pattern_description}

### Directory Structure
```
{project_directory_tree}
```

### Design Patterns Used
{design_patterns_description}

### Key Architectural Decisions
{architectural_decisions}

### Layer Responsibilities
| Layer | Purpose | Entry Points |
|-------|---------|--------------|
| {layer_1} | {purpose_1} | {entry_points_1} |
| {layer_2} | {purpose_2} | {entry_points_2} |
| {layer_3} | {purpose_3} | {entry_points_3} |

### Dependency Rules
{dependency_rules}

### Configuration Patterns
{configuration_patterns}

### API Conventions
{api_conventions}

### Error Handling Patterns
{error_handling_patterns}

### Testing Strategy
{testing_strategy}
```

## Example Usage

### For a React + Node.js Application

```markdown
## Architectural Context

### Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Prisma ORM
- **Key Libraries**: Zustand (state), React Query (data fetching)
- **Runtime**: Node.js 20+

### Architecture Pattern
Layered architecture with clear separation:
- **UI Layer**: React components, hooks, stores
- **Service Layer**: Business logic, API calls
- **Data Layer**: Database queries via Prisma
- **Shared Layer**: Types, utilities, constants

### Directory Structure
```
src/
├── components/     # Reusable UI components
│   ├── shared/     # Generic components (Button, Modal)
│   └── features/   # Feature-specific components
├── features/       # Feature modules
│   └── {feature}/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types/
├── hooks/          # Shared custom hooks
├── services/       # Shared services
├── stores/         # Zustand state stores
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

### Design Patterns Used
1. **Feature-based organization**: Each feature is self-contained
2. **Custom hooks**: Encapsulate reusable logic
3. **Presentational/Container components**: Separate UI from logic
4. **Repository pattern**: Data access abstraction via services

### Layer Responsibilities
| Layer | Purpose | Entry Points |
|-------|---------|--------------|
| Components | Render UI, handle user interaction | User clicks, form submissions |
| Hooks | Encapsulate logic, manage local state | Used by components |
| Services | Business logic, API calls | Hooks, other services |
| Stores | Global state management | Any component/hook |
| Types | TypeScript definitions | Import by all layers |

### Dependency Rules
- Components can only import hooks and types
- Hooks can import services, stores, types, and other hooks
- Services can import other services, types, and utilities
- **Never**: UI imports database, components import stores directly (use hooks)

### Configuration Patterns
- Environment variables: `.env` files with `.env.example` reference
- Feature flags: `src/config/flags.ts`
- App config: `src/config/app.ts`

### API Conventions
- RESTful endpoints: `/api/{resource}` plural nouns
- Request/Response: JSON with consistent structure
- Error format: `{ error: string, code: string, details?: any }`

### Error Handling Patterns
```typescript
// Service errors
throw new AppError('USER_NOT_FOUND', 404);

// Hook error handling
const { data, error } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
if (error) { /* handle */ }
```

### Testing Strategy
- **Unit**: Jest with React Testing Library
- **Integration**: Test handlers with supertest
- **Coverage target**: 80% for new code
```

### For a Python Django Application

```markdown
## Architectural Context

### Technology Stack
- **Backend**: Python 3.11+, Django 4.2
- **Database**: PostgreSQL
- **Cache**: Redis
- **Task Queue**: Celery
- **API**: Django REST Framework

### Architecture Pattern
Django MTV (Model-Template-View) with service layer:
- **Models**: Database schema definitions
- **Views**: Request handling, business logic delegation
- **Services**: Business logic, reusable across views
- **Serializers**: Data transformation for API responses

### Directory Structure
```
{app_name}/
├── models/         # Django models
├── views/          # View classes and functions
├── serializers/   # DRF serializers
├── services/      # Business logic layer
├── urls/          # URL routing
├── admin.py       # Admin configuration
└── tests/         # Unit tests
```

### Design Patterns Used
1. **Service layer**: Business logic in dedicated services
2. **Repository pattern**: Data access via model managers
3. **Serializer pattern**: Data validation and transformation
4. **Signals**: Decoupled event handling

### Dependency Rules
- Views delegate to services (no business logic in views)
- Services access data via models
- Models define schema only (no business logic)

### API Conventions
- RESTful with DRF conventions
- Pagination: cursor-based for lists
- Filtering: Query parameters

### Error Handling Patterns
```python
# Custom exceptions
raise ValidationError({'field': 'Invalid value'})

# Service layer
if not entity:
    raise NotFoundError('Entity not found')
```
```

## Injection Guidelines

### When to Include Architectural Context

1. **Large PRs** (10+ files) - Help agents understand the big picture
2. **Architecture-sensitive changes** - New services, refactors, pattern introductions
3. **Cross-cutting concerns** - Changes affecting multiple layers
4. **New contributors** - First-time changes to unfamiliar parts

### What to Include vs Exclude

**Include:**
- Directory structure relevant to the changed files
- Design patterns used in the affected area
- Key dependencies and their relationships
- Architectural decisions relevant to the change
- Configuration and convention patterns

**Exclude:**
- Full codebase documentation (focus on relevant portions)
- Historical context not relevant to the change
- Implementation details not visible in the diff
- General programming best practices

### Context Granularity

| Change Type | Context Needed |
|-------------|----------------|
| UI component update | Component patterns, state management |
| API endpoint change | API conventions, service layer |
| Database model change | ORM patterns, migrations |
| Configuration change | Config loading patterns |
| New feature | Full architecture, patterns, conventions |

## Review Integration

### Adding to Orchestrator Prompt

Include at the start of orchestrator analysis phase:

```markdown
## Phase 0: Architectural Context (Before Analysis)

Before analyzing the PR, gather relevant architectural context:

1. **Identify affected layers** - Which parts of the architecture are touched?
2. **Load relevant patterns** - What patterns exist in these layers?
3. **Check architectural decisions** - Are there ADRs or decisions relevant to this change?

Use this context to:
- Identify if changes violate architectural principles
- Spot potential cross-cutting concerns
- Determine if new patterns are consistent with existing ones
```

### Adding to Subagent Prompts

Include lightweight context for specialized agents:

```markdown
## Context for {agent_type} Review

**Relevant Architecture:**
- Affected layer: {layer}
- Patterns to check: {patterns}
- Key dependencies: {dependencies}

**What to verify:**
1. {architectural_check_1}
2. {architectural_check_2}
```

## Quality Checklist

- [ ] Technology stack is current and accurate
- [ ] Directory structure matches actual project layout
- [ ] Design patterns reflect actual implementation
- [ ] Dependency rules are enforceable
- [ ] API conventions match actual API structure
- [ ] Error handling patterns are representative
- [ ] Testing strategy reflects actual project setup

## Maintenance

Update this template when:
- New architectural patterns are introduced
- Technology stack changes significantly
- Directory structure is reorganized
- New conventions or rules are established

---

*Part of the PR Review System - Auto Claude*
