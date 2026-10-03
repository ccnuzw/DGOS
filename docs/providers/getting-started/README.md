# Provider Adapter System - Getting Started

DGOS V1 Provider Adapter system enables seamless integration with AI providers through a unified, extensible architecture.

## Overview

The Provider Adapter system consists of:

- **Adapter Registry**: Central registry for managing provider adapters
- **Protocol System**: Declarative capability definitions with operation mappings
- **Executor Framework**: Base classes for implementing provider integrations
- **Provider Presets**: Pre-configured popular providers
- **Model Catalog**: Automatic model discovery and management

## Quick Start for Users

### 1. Configure a Provider

Navigate to **Settings > Providers** in the DGOS interface.

#### Using a Preset

1. Click "Add Provider"
2. Select from popular providers:
   - **OpenAI** - GPT-4, GPT-3.5
   - **DeepSeek** - DeepSeek Chat, DeepSeek Coder
   - **Zhipu AI** - GLM-4, GLM-3
   - **Moonshot AI** - Moonshot V1
   - **Groq** - Fast inference
3. Enter your API key
4. Click "Test Connection"
5. If successful, click "Create Provider"

#### Custom OpenAI-Compatible API

1. Select "Custom OpenAI-Compatible"
2. Enter:
   - **Display Name**: A friendly name for your provider
   - **Base URL**: Your API endpoint (e.g., `https://api.example.com/v1`)
   - **API Key**: Your authentication token
3. Test and create

### 2. Manage Models

After creating a provider, go to **Model Management**:

1. Select your provider from the dropdown
2. Click "Refresh Catalog" to fetch available models
3. For each model:
   - **Enable/Disable**: Control which models are available
   - **Configure**: Assign capabilities (text, image, audio, etc.)
   - **Set as Default**: Mark as default for a capability

### 3. Use in Tasks

When creating a task, models from active providers will be available:

```typescript
// In Task creation
const task = await dgos.tasks.create({
  prompt: 'Hello, world!',
  model: 'gpt-4', // Model from configured provider
});
```

## Supported Provider Types

### OpenAI-Compatible APIs

Works with any API that implements OpenAI's `/chat/completions` endpoint:

- OpenAI
- Azure OpenAI
- DeepSeek
- Zhipu AI
- Moonshot AI
- Together AI
- Groq
- Any custom implementation

**Requirements:**
- `POST /chat/completions` endpoint
- Bearer token authentication
- Standard request/response format

### Coming Soon

- **Anthropic** - Native Claude API support
- **Google Gemini** - Native Gemini API support
- **Custom REST APIs** - Visual adapter builder

## Provider Capabilities

Each model can support multiple capabilities:

- **text** - Text generation (chat, completion)
- **image-generation** - Image creation
- **image-understanding** - Image analysis
- **video-generation** - Video creation
- **video-understanding** - Video analysis
- **audio-generation** - Audio/speech synthesis
- **audio-understanding** - Audio transcription
- **embedding** - Text embeddings
- **multimodal** - Multiple modalities

## Best Practices

### Security

1. **Never share API keys** - They provide full access to your provider account
2. **Use environment-specific keys** - Different keys for dev/staging/prod
3. **Rotate keys regularly** - Update keys periodically
4. **Monitor usage** - Track API calls and costs

### Configuration

1. **Test before deploying** - Always test connection before saving
2. **Name clearly** - Use descriptive names (e.g., "OpenAI Production")
3. **Set defaults** - Configure default models for each capability
4. **Disable unused models** - Reduce clutter and prevent accidental use

### Model Selection

1. **Understand capabilities** - Match model to task requirements
2. **Consider costs** - Larger models cost more per token
3. **Check context windows** - Ensure model supports your input size
4. **Test performance** - Benchmark models for your use case

## Troubleshooting

### Connection Test Failed

**Authentication Failed (401/403)**
- Verify API key is correct
- Check key has required permissions
- Ensure key is not expired

**Connection Timeout**
- Check base URL is correct
- Verify network connectivity
- Check firewall/proxy settings

**Invalid Response Format**
- Verify endpoint is OpenAI-compatible
- Check API version compatibility
- Review endpoint documentation

### Models Not Appearing

1. **Refresh catalog** - Click "Refresh Catalog" button
2. **Check provider status** - Ensure provider is active
3. **Verify credentials** - Re-test connection
4. **Enable models** - Models are disabled by default after refresh

### Model Not Available in Task

1. **Check provider is active** - Provider must be in "active" state
2. **Verify model is enabled** - Enable in Model Management
3. **Confirm capabilities** - Model must support required capability
4. **Check default settings** - Set as default if needed

## Next Steps

- [Adapter Development Guide](../development/adapter-development.md) - Build custom adapters
- [Protocol Reference](../reference/protocol-reference.md) - Protocol specification
- [API Reference](../reference/api-reference.md) - SDK and API documentation
- [Examples](../examples/) - Sample implementations

## Support

- **Documentation**: `/docs/providers/`
- **GitHub Issues**: Report bugs and request features
- **Community**: Join our Discord for help and discussions
