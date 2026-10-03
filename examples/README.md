# DGOS Application Examples

Complete example applications demonstrating DGOS SDK capabilities.

## Available Examples

### 1. Hello World
**Location:** `examples/hello-world/`

The simplest possible DGOS application.

**Features:**
- Minimal manifest
- Basic activation/deactivation
- Single notification

**Quick Start:**
```bash
cd examples/hello-world
pnpm install
dgos app test-install
```

### 2. Todo App
**Location:** `examples/todo-app/`

A complete todo list application with persistence.

**Features:**
- Task creation and management
- Local storage using Storage API
- UI state management
- Data persistence

### 3. Weather App
**Location:** `examples/weather-app/`

Weather information app with API integration.

**Features:**
- External API calls (with permission)
- Data caching
- Auto-refresh
- Error handling

### 4. Chat Assistant
**Location:** `examples/chat-assistant/`

AI-powered chat application.

**Features:**
- AI task submission
- Streaming responses
- Chat history
- Model selection

### 5. Image Generator
**Location:** `examples/image-generator/`

Generate images using AI models.

**Features:**
- Image generation tasks
- Artifact handling
- Result display
- Parameter configuration

### 6. File Manager
**Location:** `examples/file-manager/`

File browsing and management.

**Features:**
- File system operations
- File upload/download
- Directory navigation
- Search functionality

## Running Examples

```bash
# Navigate to example directory
cd examples/chat-assistant

# Install dependencies
pnpm install

# Run in development mode
dgos app dev

# Or build and test install
dgos app build
dgos app package
dgos app test-install ./dist/chat-assistant.dgos
```

## Learning Path

1. **Start with Hello World** - Understand basic app structure
2. **Todo App** - Learn storage and state management
3. **Weather App** - Work with external APIs and permissions
4. **Chat Assistant** - Master AI tasks and streaming
5. **Advanced Examples** - Explore specific use cases

## Example Structure

Each example follows this structure:

```
example-name/
├── dgos.json           # Application manifest
├── package.json        # Dependencies
├── src/
│   ├── index.html      # Entry point
│   ├── app.js          # Application logic
│   ├── styles.css      # Styles
│   └── components/     # Additional components
├── public/
│   ├── icon.png        # App icon
│   └── assets/         # Static assets
├── tests/
│   └── app.test.js     # Tests
└── README.md           # Example-specific documentation
```

## Key Concepts Demonstrated

### Application Lifecycle
- Hello World, Todo App

### Storage and Persistence
- Todo App, Chat Assistant

### AI Tasks and Streaming
- Chat Assistant, Image Generator

### Permissions and Security
- Weather App, File Manager

### UI and Theming
- All examples

## Contributing Examples

Want to contribute an example? Follow these guidelines:

1. Use a clear, descriptive name
2. Include comprehensive README
3. Add inline code comments
4. Provide test coverage
5. Follow DGOS best practices
6. Include error handling

Submit via pull request to the main repository.
