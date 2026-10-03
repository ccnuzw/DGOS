# Basic DGOS App Template

A minimal DGOS application template with core functionality.

## Features

- Application lifecycle management
- System context integration
- Basic UI interactions
- Permission handling

## Structure

```
basic-app/
├── dgos.json           # Application manifest
├── src/
│   ├── index.html      # Main entry point
│   ├── app.js          # Application logic
│   └── styles.css      # Styles
├── public/
│   └── icon.png        # Application icon
└── tests/
    └── app.test.js     # Tests
```

## Getting Started

1. Create from template:
   ```bash
   dgos app create my-app --template basic
   ```

2. Install dependencies:
   ```bash
   cd my-app
   pnpm install
   ```

3. Start development:
   ```bash
   dgos app dev
   ```

## API Usage

The template demonstrates:

- `onActivate()` - Initialize app
- `onDeactivate()` - Cleanup
- `ui.notify()` - Show notifications
- `system.getContext()` - Read system state
