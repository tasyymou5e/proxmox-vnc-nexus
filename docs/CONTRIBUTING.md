# Contributing to Proxmox VNC Nexus

Thank you for your interest in contributing! This guide will help you get started with development.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style Guidelines](#code-style-guidelines)
- [Component Guidelines](#component-guidelines)
- [Testing](#testing)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)

---

## Development Setup

### Prerequisites

- **Node.js 18+** - [Install with nvm](https://github.com/nvm-sh/nvm)
- **npm** - Comes with Node.js
- **Git** - For version control

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd proxmox-vnc-nexus

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Supabase Local Development

For local Supabase development:

```bash
# Start Supabase locally
npx supabase start

# Apply migrations
npx supabase db push

# Deploy edge functions locally
npx supabase functions serve
```

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── auth/           # Authentication components
│   ├── console/        # VNC console components
│   ├── dashboard/      # Dashboard & VM components
│   ├── layout/         # Layout components
│   ├── servers/        # Server management components
│   └── theme/          # Theme components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and types
├── pages/              # Route page components
├── integrations/       # External service integrations
└── test/               # Test setup and utilities

supabase/
├── functions/          # Edge Functions
├── migrations/         # Database migrations
└── config.toml         # Supabase configuration

docs/                   # Documentation
```

---

## Code Style Guidelines

### TypeScript

- **Strict typing** - Avoid `any` type; use proper interfaces/types
- **Explicit return types** - Define return types for functions
- **Interface naming** - Use PascalCase without `I` prefix

```typescript
// ✅ Good
interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
}

function getUserById(id: string): Promise<UserProfile | null> {
  // ...
}

// ❌ Bad
interface IUserProfile { ... }
function getUserById(id: any): any { ... }
```

### React Components

- **Functional components** - Use function declarations
- **Named exports** - Prefer named exports over default
- **Props interface** - Define props interface above component

```typescript
// ✅ Good
interface VMCardProps {
  vm: VM;
  onConnect: (vmId: number) => void;
}

export function VMCard({ vm, onConnect }: VMCardProps) {
  return (
    // ...
  );
}

// ❌ Bad
export default function VMCard(props: any) { ... }
```

### Styling with Tailwind

- **Use semantic tokens** - Never use raw colors in components
- **HSL format** - All colors must be in HSL
- **Design system** - Use tokens from `index.css` and `tailwind.config.ts`

```tsx
// ✅ Good - Using semantic tokens
<div className="bg-background text-foreground border-border">
  <Button variant="default">Click me</Button>
</div>

// ❌ Bad - Using raw colors
<div className="bg-white text-black border-gray-200">
  <button className="bg-blue-500">Click me</button>
</div>
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `VMCard.tsx` |
| Hooks | camelCase with `use` prefix | `useVMs.ts` |
| Utilities | camelCase | `utils.ts` |
| Types | camelCase | `types.ts` |
| Tests | Same as source + `.test` | `VMCard.test.tsx` |

### Import Order

```typescript
// 1. React and external libraries
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal components
import { Button } from '@/components/ui/button';
import { VMCard } from '@/components/dashboard/VMCard';

// 3. Hooks
import { useVMs } from '@/hooks/useVMs';

// 4. Utilities and types
import { cn } from '@/lib/utils';
import type { VM } from '@/lib/types';
```

---

## Component Guidelines

### Creating New Components

1. **Single responsibility** - One component, one purpose
2. **Small and focused** - Break large components into smaller ones
3. **Reusable** - Design for reuse when appropriate
4. **Documented** - Add JSDoc comments for complex props

```typescript
/**
 * Displays a VM's resource usage as a progress bar
 * @param value - Current usage (0-100)
 * @param max - Maximum value (default: 100)
 * @param label - Label to display
 */
interface ResourceMeterProps {
  value: number;
  max?: number;
  label: string;
}

export function ResourceMeter({ value, max = 100, label }: ResourceMeterProps) {
  // ...
}
```

### Using shadcn/ui Components

- Import from `@/components/ui/`
- Extend with custom variants when needed
- Don't modify base components directly

```typescript
// Creating a custom button variant
const buttonVariants = cva("...", {
  variants: {
    variant: {
      proxmox: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
  },
});
```

### State Management

- **Local state** - `useState` for component-specific state
- **Server state** - React Query for API data
- **Form state** - React Hook Form for forms
- **Global state** - Context for auth/theme (avoid prop drilling)

```typescript
// ✅ Using React Query for server state
const { data: vms, isLoading } = useQuery({
  queryKey: ['vms'],
  queryFn: fetchVMs,
});

// ✅ Using React Hook Form
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
});
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/components/dashboard/VMCard.test.tsx

# Run with coverage
npm test -- --coverage
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VMCard } from './VMCard';

describe('VMCard', () => {
  const mockVM = {
    vmid: 100,
    name: 'test-vm',
    status: 'running',
    node: 'pve',
  };

  it('renders VM name', () => {
    render(<VMCard vm={mockVM} onConnect={() => {}} />);
    expect(screen.getByText('test-vm')).toBeInTheDocument();
  });

  it('shows running status badge', () => {
    render(<VMCard vm={mockVM} onConnect={() => {}} />);
    expect(screen.getByText('running')).toBeInTheDocument();
  });
});
```

### Test File Location

Place tests alongside source files:

```
src/components/dashboard/
├── VMCard.tsx
├── VMCard.test.tsx
├── VMTable.tsx
└── VMTable.test.tsx
```

---

## Git Workflow

### Branch Naming

```
feature/add-vm-scheduling
fix/vnc-connection-timeout
docs/update-api-reference
refactor/optimize-vm-queries
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add VM power scheduling
fix: resolve VNC connection timeout issue
docs: update API documentation
refactor: optimize VM list queries
test: add VMCard component tests
chore: update dependencies
```

### Commit Guidelines

- Keep commits atomic and focused
- Write clear, descriptive messages
- Reference issues when applicable: `fix: resolve timeout (#123)`

---

## Pull Request Process

### Before Submitting

1. **Test locally** - Ensure all tests pass
2. **Lint code** - Run `npm run lint`
3. **Update docs** - Update relevant documentation
4. **Self-review** - Review your own changes

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
```

### Review Process

1. Submit PR with clear description
2. Address review feedback
3. Ensure CI checks pass
4. Squash commits if requested
5. Merge after approval

---

## Need Help?

- Check [README.md](./README.md) for project overview
- See [API.md](./API.md) for API documentation
- Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Check [CHANGELOG.md](./CHANGELOG.md) for recent changes

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something great together.
