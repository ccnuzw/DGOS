# Skill Templates

This directory contains templates for creating new DGOS skills quickly.

## Available Templates

### 1. Basic Skill (`basic-skill/`)
A minimal skill template with simple trigger and parameter handling.

**Use for:**
- Simple text processing
- Quick utilities
- Learning skill development

### 2. API Integration (`api-integration/`)
Template for integrating external APIs and web services.

**Use for:**
- Weather services
- Social media integration
- Third-party data sources

### 3. Data Processing (`data-processing/`)
Template for processing and transforming data.

**Use for:**
- File conversions
- Data analysis
- Report generation

### 4. Automation (`automation/`)
Template for automating repetitive tasks.

**Use for:**
- Scheduled tasks
- Workflow automation
- Batch operations

### 5. Notification (`notification/`)
Template for sending notifications and alerts.

**Use for:**
- Status updates
- Reminders
- System alerts

### 6. Workflow (`workflow/`)
Template for multi-step workflows that chain multiple skills.

**Use for:**
- Complex processes
- Multi-stage operations
- Coordinated tasks

## Usage

### Using the CLI
```bash
# Create a new skill from template
dgos skill create my-skill --template basic-skill

# List available templates
dgos skill templates
```

### Manual Creation
1. Copy the template directory
2. Rename to your skill name
3. Update `skill.json` with your details
4. Implement `src/handler.ts`
5. Test with `dgos skill test`

## Template Structure

```
template-name/
├── skill.json          # Skill manifest
├── src/
│   ├── index.ts        # Entry point
│   └── handler.ts      # Implementation
├── tests/
│   └── skill.test.ts   # Tests
├── assets/
│   └── icon.svg        # Icon
└── README.md           # Documentation
```

## Development Workflow

1. **Create**: Use template or start from scratch
2. **Develop**: Implement handler logic
3. **Test**: Run tests locally
4. **Package**: Bundle skill
5. **Deploy**: Install to DGOS

## Best Practices

- **Single Responsibility**: Each skill should do one thing well
- **Clear Naming**: Use descriptive skill IDs and parameter names
- **Good Defaults**: Provide sensible default values
- **Error Handling**: Handle errors gracefully with clear messages
- **Documentation**: Document parameters and examples
- **Testing**: Write tests for main functionality
- **Performance**: Keep execution times under 5 seconds when possible
- **Permissions**: Request minimal necessary permissions

## Example: Creating a Simple Skill

```typescript
import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'hello-world',
    version: '1.0.0',
    name: {
      en: 'Hello World',
      zh: '你好世界',
    },
    description: {
      en: 'A simple greeting skill',
      zh: '简单的问候技能',
    },
    author: {
      name: 'Your Name',
    },
    triggers: [
      { type: 'keyword', value: 'hello' },
    ],
    parameters: [
      {
        name: 'name',
        type: 'string',
        required: false,
        description: 'Name to greet',
        default: 'World',
      },
    ],
    permissions: [],
    execution: {
      timeout: 3000,
    },
    category: 'productivity',
    tags: ['greeting', 'example'],
  },
  
  async handler(context, api) {
    const { name } = context.parameters;
    
    return {
      success: true,
      output: {
        greeting: `Hello, ${name}!`,
      },
    };
  },
});
```

## Resources

- [Skill Development Guide](../../docs/skills/getting-started.md)
- [API Reference](../../docs/skills/api-reference.md)
- [Best Practices](../../docs/skills/best-practices.md)
- [Examples](../../docs/skills/examples/)
