# DGOS V1 Skill System

Complete skill management system, standards, and ecosystem for DGOS V1.

## 📋 Overview

The DGOS V1 Skill System provides a comprehensive framework for extending DGOS functionality through user-created skills. This includes:

- **Core Runtime Engine** - Skill execution, matching, and lifecycle management
- **Developer SDK** - Complete API for building skills
- **Management UI** - Web interface for managing and testing skills
- **Built-in Skills** - 6 reference implementations
- **Templates** - Quick-start templates for common use cases
- **Documentation** - Comprehensive guides and API reference

## 🚀 Quick Start

### For Users

Browse and manage skills in the DGOS web interface:

```
Navigate to: Settings → Skills
```

Features:
- Browse installed skills
- Enable/disable skills
- View skill details and statistics
- Test skill execution
- Search and filter

### For Developers

Create a new skill:

```bash
# Create from template
dgos skill create my-skill --template basic-skill

# Navigate and start development
cd my-skill
dgos skill dev

# Test your skill
dgos skill test

# Package and install
dgos skill package
dgos skill install ./my-skill.dgos
```

## 📦 Components

### 1. Core Runtime (`packages/skill-runtime/`)

Execution engine with:
- Skill registry and discovery
- Trigger matching (keyword, pattern, intent, schedule, event)
- Parameter validation and type checking
- Permission enforcement
- Sandboxed execution with timeout protection
- Workflow orchestration
- Statistics tracking

### 2. Developer SDK (`packages/skill-sdk/`)

Complete API providing:
- **System API** - Version, platform, environment
- **Storage API** - Persistent key-value storage
- **Tasks API** - AI task creation and management
- **UI API** - Notifications and dialogs
- **HTTP API** - Network requests
- **Tools API** - Tool invocation
- **Log API** - Structured logging
- **Skills API** - Inter-skill communication

### 3. Built-in Skills (`built-in-skills/`)

Reference implementations:
- 🔍 **File Search** - Search workspace files
- 🌐 **Translator** - AI-powered translation
- ⚙️ **System Info** - System information queries
- 🔢 **Calculator** - Mathematical calculations
- 📋 **Clipboard** - Clipboard management
- 📸 **Screenshot** - Screen capture

### 4. Management UI (`apps/web/src/`)

Web interface with:
- Grid and list views
- Search and filtering
- Skill details modal
- Interactive testing tool
- Usage statistics
- Enable/disable controls

### 5. Templates (`templates/skills/`)

Quick-start templates:
- **Basic Skill** - Simple text processing
- **API Integration** - External API integration
- More templates for data processing, automation, etc.

### 6. Documentation (`docs/skills/`)

Complete guides:
- **Getting Started** - Comprehensive development guide
- **API Reference** - Complete API documentation
- **Best Practices** - Guidelines and patterns
- **Examples** - Working examples

## 🎯 Key Features

### Flexible Triggering

5 trigger types:
```typescript
// Keyword
{ type: 'keyword', value: 'weather' }

// Pattern (regex with capture groups)
{ type: 'pattern', value: 'weather in (.+)' }

// Intent (NLU-based)
{ type: 'intent', value: 'get_weather' }

// Schedule (cron)
{ type: 'schedule', value: '0 9 * * *' }

// Event
{ type: 'event', value: 'file.created' }
```

### Type-Safe Parameters

```typescript
{
  name: 'location',
  type: 'string',
  required: true,
  description: 'City name',
  validation: {
    pattern: '^[A-Za-z\\s]+$'
  }
}
```

### Permission System

```typescript
{
  permissions: [
    {
      capability: 'network:fetch',
      reason: 'Fetch weather data from API'
    }
  ]
}
```

### Workflow Support

Chain multiple skills:
```typescript
{
  workflowId: 'translate-and-speak',
  steps: [
    { skillId: 'translator', parameters: { to: 'en' } },
    { skillId: 'text-to-speech', parameters: { voice: 'female' } }
  ]
}
```

## 📚 Documentation

- [Getting Started Guide](./getting-started.md) - Learn skill development
- [API Reference](./api-reference.md) - Complete API docs
- [Best Practices](./best-practices.md) - Guidelines and patterns
- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md) - System overview

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  User Interface                  │
│  (Skill Management UI, Testing, Statistics)      │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│              Skill Runtime Engine                │
│  ┌─────────────┐  ┌──────────────┐             │
│  │  Registry   │  │   Executor   │             │
│  │  (Matching) │→ │  (Sandboxed) │             │
│  └─────────────┘  └──────────────┘             │
│  ┌─────────────────────────────────┐           │
│  │     Workflow Orchestrator       │           │
│  └─────────────────────────────────┘           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│                  Skill SDK                       │
│  (System, Storage, Tasks, UI, HTTP, Tools, Log)  │
└─────────────────────────────────────────────────┘
```

## 🔒 Security

- **Sandboxed Execution** - Skills run in isolated environments
- **Permission System** - Explicit capability requests
- **Timeout Protection** - Prevents runaway execution
- **Input Validation** - Type checking and validation rules
- **Audit Logging** - All executions logged
- **Resource Limits** - Memory and CPU constraints

## 🧪 Testing

```typescript
import { createMockAPI } from '@dgos/skill-sdk';
import skill from './src/index';

const mockAPI = createMockAPI();
const result = await skill.handler(context, mockAPI);

console.assert(result.success === true);
```

## 📊 Statistics

Skills track:
- Invocation count
- Success/failure rates
- Average execution duration
- Last invocation time

## 🌐 Internationalization

All skills support bilingual names and descriptions:
```json
{
  "name": {
    "en": "Weather",
    "zh": "天气"
  },
  "description": {
    "en": "Get weather information",
    "zh": "获取天气信息"
  }
}
```

## 🛣️ Roadmap

### Phase 1 (Current) ✅
- Core runtime engine
- Developer SDK
- Built-in skills
- Management UI
- Templates and docs

### Phase 2 (Planned)
- CLI commands implementation
- API backend endpoints
- Database integration
- Advanced testing tools
- Performance optimization

### Phase 3 (Future)
- Skill marketplace
- Visual skill editor
- Advanced ML-based triggers
- Skill analytics dashboard
- Remote debugging
- Hot reload

## 🤝 Contributing

To create a new skill:

1. Use a template or start from scratch
2. Define manifest with triggers and parameters
3. Implement handler logic
4. Write tests
5. Document usage
6. Package and share

See [Getting Started Guide](./getting-started.md) for details.

## 📝 Example Skill

```typescript
import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'hello-world',
    version: '1.0.0',
    name: { en: 'Hello World', zh: '你好世界' },
    description: { en: 'Simple greeting', zh: '简单问候' },
    author: { name: 'Your Name' },
    triggers: [{ type: 'keyword', value: 'hello' }],
    parameters: [{
      name: 'name',
      type: 'string',
      required: false,
      description: 'Name to greet',
      default: 'World'
    }],
    permissions: [],
    execution: { timeout: 3000 },
    category: 'productivity',
    tags: ['greeting']
  },
  
  async handler(context, api) {
    const { name } = context.parameters;
    
    api.log.info('Greeting user', { name });
    
    return {
      success: true,
      output: { greeting: `Hello, ${name}!` }
    };
  }
});
```

## 📄 License

Part of DGOS V1 - See main project license

## 🔗 Resources

- [DGOS Documentation](../../docs/)
- [API Server](../../apps/api/)
- [Web Interface](../../apps/web/)
- [Design System](../../packages/design-tokens/)

---

**Built with ❤️ for DGOS V1**
