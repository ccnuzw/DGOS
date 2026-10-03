# DGOS Application Development Standards

> Comprehensive standards and best practices for DGOS application development

## Table of Contents

1. [Project Structure](#project-structure)
2. [Naming Conventions](#naming-conventions)
3. [Code Organization](#code-organization)
4. [Testing Requirements](#testing-requirements)
5. [Documentation Requirements](#documentation-requirements)
6. [Performance Budgets](#performance-budgets)
7. [Accessibility Requirements](#accessibility-requirements)
8. [Security Standards](#security-standards)
9. [Manifest Requirements](#manifest-requirements)
10. [Build and Packaging](#build-and-packaging)

---

## 1. Project Structure

### Standard Directory Layout

```
my-app/
├── dgos.json                  # Application manifest (required)
├── package.json               # Node.js dependencies
├── tsconfig.json              # TypeScript configuration
├── README.md                  # Project documentation
├── LICENSE                    # License file
├── .gitignore                 # Git ignore rules
│
├── src/                       # Source code
│   ├── index.html            # Main entry point
│   ├── main.ts               # Application bootstrap
│   ├── app.tsx               # Root component
│   ├── components/           # UI components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── Button.module.css
│   │   └── ...
│   ├── services/             # Business logic services
│   ├── hooks/                # React hooks
│   ├── utils/                # Utility functions
│   ├── types/                # TypeScript type definitions
│   ├── constants/            # Application constants
│   └── styles/               # Global styles
│
├── public/                    # Static assets
│   ├── icon.png              # App icon (required, 512x512)
│   ├── assets/               # Images, fonts, etc.
│   └── locales/              # i18n translation files
│       ├── zh-CN.json
│       └── en-US.json
│
├── tests/                     # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
│
├── migrations/                # Data migration scripts
│   ├── 1.json
│   └── 2.json
│
├── docs/                      # Additional documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
│
└── dist/                      # Build output (gitignored)
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `Button.tsx`, `UserProfile.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`, `apiClient.ts`)
- **Constants**: UPPER_SNAKE_CASE for files (e.g., `API_ENDPOINTS.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`, `useLocalStorage.ts`)
- **Types**: PascalCase with `.types.ts` suffix (e.g., `User.types.ts`)
- **Tests**: Same as source file with `.test.ts(x)` or `.spec.ts(x)` suffix

---

## 2. Naming Conventions

### Application IDs

**Format**: Reverse domain notation
```
com.company.product
dev.yourname.appname
org.project.component
```

**Rules**:
- Lowercase letters, numbers, dots, and hyphens only
- Must start with a letter
- Maximum 64 characters
- Must be globally unique
- Cannot be changed after publication

**Examples**:
```
✓ com.example.task-manager
✓ dev.alice.notes
✓ org.dgos.file-explorer

✗ TaskManager (not reverse domain)
✗ com.example.Task_Manager (underscore not allowed)
✗ com.example (too generic)
```

### Version Numbers

**Format**: Semantic Versioning (SemVer 2.0.0)
```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

**Rules**:
- **MAJOR**: Incompatible API changes
- **MINOR**: Backward-compatible new features
- **PATCH**: Backward-compatible bug fixes
- **PRERELEASE**: Optional alpha, beta, rc labels
- **BUILD**: Optional build metadata

**Examples**:
```
1.0.0         # Initial release
1.1.0         # New feature
1.1.1         # Bug fix
2.0.0         # Breaking change
2.0.0-beta.1  # Beta release
2.0.0+20240101 # With build metadata
```

### Constants and Enums

```typescript
// Constants - UPPER_SNAKE_CASE
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const API_BASE_URL = 'https://api.example.com';
export const DEFAULT_TIMEOUT = 5000;

// Enums - PascalCase for enum name, UPPER_SNAKE_CASE for values
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST'
}

// String unions for simple cases
export type Theme = 'light' | 'dark' | 'auto';
```

### Functions and Methods

```typescript
// Functions - camelCase, verb-based names
function fetchUserData(userId: string): Promise<User> { }
function calculateTotalPrice(items: Item[]): number { }
function validateEmail(email: string): boolean { }

// Event handlers - handle prefix
function handleButtonClick(event: MouseEvent): void { }
function handleFormSubmit(data: FormData): void { }

// Boolean functions - is/has/can/should prefix
function isValidEmail(email: string): boolean { }
function hasPermission(user: User, permission: string): boolean { }
function canEditDocument(user: User, doc: Document): boolean { }
```

---

## 3. Code Organization

### Component Structure

```typescript
// Button.tsx
import { FC, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

/**
 * Button component with variants and loading state
 * 
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  children,
  className,
  ...props
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className || ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
};

Button.displayName = 'Button';
```

### Service Layer Pattern

```typescript
// userService.ts
import { DGOSClient } from '@dgos/sdk';

export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  constructor(private client: DGOSClient) {}

  async getUser(userId: string): Promise<User> {
    // Implementation
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    // Implementation
  }

  async deleteUser(userId: string): Promise<void> {
    // Implementation
  }
}

// Export singleton instance
export const userService = new UserService(client);
```

### Custom Hooks Pattern

```typescript
// useLocalStorage.ts
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Read from localStorage
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Write to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
```

### Error Handling

```typescript
// errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

// Usage
try {
  const user = await userService.getUser(userId);
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle not found
  } else if (error instanceof ValidationError) {
    // Handle validation error
  } else {
    // Handle generic error
  }
}
```

---

## 4. Testing Requirements

### Coverage Requirements

| Type | Minimum Coverage | Target Coverage |
|------|-----------------|-----------------|
| Unit Tests | 70% | 85% |
| Integration Tests | 50% | 70% |
| E2E Tests | Critical paths | All user flows |

### Unit Testing

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant styles', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toHaveClass('danger');
  });
});
```

### Integration Testing

```typescript
// userService.test.ts
import { UserService } from './userService';
import { mockClient } from './mocks';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService(mockClient);
  });

  it('fetches user successfully', async () => {
    const user = await service.getUser('123');
    expect(user).toEqual({
      id: '123',
      name: 'Test User',
      email: 'test@example.com'
    });
  });

  it('handles errors gracefully', async () => {
    mockClient.get.mockRejectedValue(new Error('Network error'));
    
    await expect(service.getUser('123')).rejects.toThrow('Network error');
  });
});
```

### E2E Testing

```typescript
// app.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Task Manager', () => {
  test('creates a new task', async ({ page }) => {
    await page.goto('/');
    
    await page.click('button:has-text("New Task")');
    await page.fill('input[name="title"]', 'Test Task');
    await page.fill('textarea[name="description"]', 'Test Description');
    await page.click('button:has-text("Create")');
    
    await expect(page.locator('text=Test Task')).toBeVisible();
  });
});
```

---

## 5. Documentation Requirements

### Code Documentation

```typescript
/**
 * Fetches user data from the API
 * 
 * @param userId - The unique identifier of the user
 * @returns Promise resolving to the user object
 * @throws {NotFoundError} If user doesn't exist
 * @throws {ValidationError} If userId is invalid
 * 
 * @example
 * ```typescript
 * const user = await fetchUser('user-123');
 * console.log(user.name);
 * ```
 */
export async function fetchUser(userId: string): Promise<User> {
  // Implementation
}
```

### README.md Requirements

Every application must include:

1. **Title and description**
2. **Features list**
3. **Installation instructions**
4. **Usage examples**
5. **Development setup**
6. **Testing instructions**
7. **Contributing guidelines**
8. **License information**

```markdown
# Task Manager

A powerful task management application for DGOS.

## Features

- Create, edit, and delete tasks
- Organize tasks with tags and projects
- Set due dates and reminders
- Collaborate with team members

## Installation

\`\`\`bash
dgos app install com.example.task-manager
\`\`\`

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
\`\`\`

## License

MIT
```

---

## 6. Performance Budgets

### Bundle Size Limits

| Type | Maximum Size | Recommended Size |
|------|-------------|------------------|
| Initial Bundle | 500 KB | 250 KB |
| Total Assets | 5 MB | 2 MB |
| Single Asset | 1 MB | 500 KB |

### Runtime Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| Startup Time | < 1s | < 2s |
| Initial Render | < 500ms | < 1s |
| Time to Interactive | < 2s | < 3.5s |
| Memory Usage | < 100 MB | < 200 MB |
| CPU Usage (idle) | < 5% | < 10% |

### Performance Monitoring

```typescript
// performance.ts
export function measurePerformance(name: string, fn: () => void): void {
  const start = performance.now();
  fn();
  const duration = performance.now() - start;
  
  console.log(`${name}: ${duration.toFixed(2)}ms`);
  
  // Report to analytics
  if (duration > 1000) {
    console.warn(`Performance warning: ${name} took ${duration.toFixed(2)}ms`);
  }
}
```

### Optimization Strategies

1. **Code Splitting**: Lazy load routes and components
2. **Tree Shaking**: Remove unused code
3. **Image Optimization**: Use WebP, lazy loading
4. **Caching**: Implement proper cache strategies
5. **Minification**: Minify JS, CSS, and HTML

---

## 7. Accessibility Requirements

### WCAG Compliance

**Minimum**: WCAG 2.1 Level AA

### Key Requirements

1. **Keyboard Navigation**: All functionality accessible via keyboard
2. **Screen Reader Support**: Proper ARIA labels and roles
3. **Color Contrast**: Minimum 4.5:1 for text, 3:1 for UI components
4. **Focus Indicators**: Visible focus states
5. **Text Alternatives**: Alt text for images
6. **Responsive Text**: Support text scaling up to 200%

### Implementation

```typescript
// Accessible Button
<button
  aria-label="Close dialog"
  aria-pressed={isPressed}
  aria-disabled={isDisabled}
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={handleKeyDown}
>
  {children}
</button>

// Accessible Form
<form role="form" aria-labelledby="form-title">
  <h2 id="form-title">User Registration</h2>
  
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <div id="email-error" role="alert">
      Please enter a valid email
    </div>
  )}
</form>
```

### Testing Accessibility

```typescript
// accessibility.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 8. Security Standards

### Input Validation

```typescript
// Always validate user input
function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

// Use schema validation
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
  name: z.string().min(1).max(100)
});

function validateUser(data: unknown): User {
  return userSchema.parse(data);
}
```

### Secure Data Handling

1. **Never log sensitive data**
2. **Use HTTPS for all network requests**
3. **Store secrets securely** (use DGOS secret management)
4. **Implement CSP headers**
5. **Sanitize HTML content**

```typescript
// Content Security Policy
const csp = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": ["'self'", "https://api.example.com"]
};
```

### Authentication & Authorization

```typescript
// Check permissions before actions
async function deleteDocument(docId: string): Promise<void> {
  const user = await getCurrentUser();
  const doc = await getDocument(docId);
  
  if (!canDelete(user, doc)) {
    throw new ForbiddenError('You do not have permission to delete this document');
  }
  
  await doc.delete();
}
```

---

## 9. Manifest Requirements

### Required Fields Checklist

- [ ] `format` - Must be "dgos-app/v1" or "dgos-app/v2"
- [ ] `appId` - Unique, reverse domain notation
- [ ] `version` - Valid SemVer
- [ ] `build` - Monotonic build number
- [ ] `releaseChannel` - stable, beta, or dev
- [ ] `minRuntimeVersion` - Minimum DGOS version
- [ ] `dataVersion` - Data schema version
- [ ] `name` - Localized (zh-CN, en-US)
- [ ] `description` - Localized (zh-CN, en-US)
- [ ] `category` - Valid category
- [ ] `icon` - 512x512 PNG
- [ ] `entrypoints` - At least "main"
- [ ] `defaultWindow` - Window configuration
- [ ] `trustLevel` - standard, trusted, or system
- [ ] `backgroundPolicy` - release or keep-alive
- [ ] `uninstallPolicy` - user-removable or protected-preinstall
- [ ] `permissions` - Array of permission strings
- [ ] `capabilityAllowlist` - Array of capabilities

### Best Practices

1. **Use meaningful categories**: productivity, utilities, creative, etc.
2. **Provide rich metadata**: author, homepage, screenshots
3. **Document permissions**: Explain why each permission is needed
4. **Version data schema**: Increment `dataVersion` on schema changes
5. **Include migration scripts**: For data schema updates

---

## 10. Build and Packaging

### Build Process

```bash
# Standard build commands
pnpm install       # Install dependencies
pnpm test          # Run tests
pnpm lint          # Check code quality
pnpm build         # Build for production
pnpm package       # Create .dgos package
```

### Package Structure

```
app-name-1.0.0.dgos/
├── dgos.json
├── dist/
│   ├── index.html
│   ├── assets/
│   └── ...
├── public/
│   └── icon.png
└── migrations/
```

### Pre-publish Checklist

- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] Manifest validated
- [ ] Performance budget met
- [ ] Accessibility tested
- [ ] Documentation complete
- [ ] License file included
- [ ] Version numbers updated
- [ ] Changelog updated
- [ ] Security audit passed

### Continuous Integration

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
      - run: dgos app validate
```

---

## Enforcement

These standards are enforced through:

1. **Automated linting** (ESLint, Prettier)
2. **Pre-commit hooks** (Husky, lint-staged)
3. **CI/CD pipelines** (GitHub Actions, GitLab CI)
4. **Code review** (Pull request reviews)
5. **Manifest validation** (dgos app validate)
6. **Security scanning** (npm audit, Snyk)
7. **Accessibility audits** (axe, Lighthouse)

## Resources

- [DGOS Developer Guide](./getting-started.md)
- [Manifest Schema](../04-技术架构/当前版本/V2-app-manifest.schema.json)
- [SDK Documentation](../sdk-cli-guide.md)
- [Example Applications](../../examples/)
- [Community Forum](https://community.dgos.dev)

---

**Version**: 2.0.0  
**Last Updated**: 2024-10-03  
**Status**: Active
