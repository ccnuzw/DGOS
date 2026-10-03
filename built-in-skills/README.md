# Built-in Skills

This directory contains the official built-in skills for DGOS V1.

## Available Skills

### 🔍 File Search (`file-search`)
Search for files in the workspace.

**Triggers:**
- `search files`
- `find file [filename]`

**Parameters:**
- `query` (string, required): Search query or file pattern
- `maxResults` (number, optional): Maximum number of results (default: 10)

### 🌐 Translator (`translator`)
Translate text between languages using AI.

**Triggers:**
- `translate`
- `translate [text] to [language]`

**Parameters:**
- `text` (string, required): Text to translate
- `targetLanguage` (enum, required): Target language (en, zh, ja, ko, es, fr, de)
- `sourceLanguage` (string, optional): Source language (auto-detect if not specified)

### ⚙️ System Information (`system-info`)
Query system information like version, platform, and resources.

**Triggers:**
- `system info`
- `version`

**Parameters:**
- `detail` (enum, optional): Level of detail (basic, detailed, full)

### 🔢 Calculator (`calculator`)
Perform mathematical calculations.

**Triggers:**
- `calculate [expression]`
- `calc [expression]`

**Parameters:**
- `expression` (string, required): Mathematical expression to evaluate

### 📋 Clipboard Manager (`clipboard`)
Manage clipboard history and operations.

**Triggers:**
- `clipboard`

**Parameters:**
- `action` (enum, required): Action to perform (history, get, set, clear)
- `content` (string, optional): Content to set (for set action)

### 📸 Screenshot (`screenshot`)
Capture screenshots of the screen or window.

**Triggers:**
- `screenshot`
- `capture`

**Parameters:**
- `type` (enum, optional): Screenshot type (fullscreen, window, region)
- `delay` (number, optional): Delay in seconds before capture

## Usage

Built-in skills are automatically registered when DGOS starts. They can be invoked through:

1. Natural language triggers in the assistant
2. Direct API calls
3. Skill workflows

## Development

To add a new built-in skill:

1. Create a new `.ts` file in this directory
2. Use `defineSkill()` from `@dgos/skill-sdk`
3. Export the skill as default
4. Add to `package.json` exports
5. Document in this README
