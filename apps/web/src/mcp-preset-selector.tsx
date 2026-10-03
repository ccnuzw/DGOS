/**
 * MCP Preset Selector Component
 * Quick setup from predefined MCP server presets
 */

import { useState } from 'react';
import { Alert, Button, Panel, Empty, Badge } from '@dgos/dgos-ui';
import { api, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

// Import presets (would come from @dgos/mcp-client in real implementation)
const presets = [
  {
    id: 'filesystem',
    name: { en: 'Filesystem', zh: '文件系统' },
    description: { en: 'Access local filesystem', zh: '访问本地文件系统' },
    category: 'system',
    icon: '📁',
    requiresCredentials: false,
  },
  {
    id: 'github',
    name: { en: 'GitHub', zh: 'GitHub' },
    description: { en: 'GitHub API integration', zh: 'GitHub API 集成' },
    category: 'api',
    icon: '🐙',
    requiresCredentials: true,
    credentialFields: [
      { key: 'GITHUB_TOKEN', label: { en: 'GitHub Token', zh: 'GitHub 令牌' }, type: 'password', required: true },
    ],
  },
  {
    id: 'postgres',
    name: { en: 'PostgreSQL', zh: 'PostgreSQL' },
    description: { en: 'PostgreSQL database access', zh: 'PostgreSQL 数据库访问' },
    category: 'database',
    icon: '🐘',
    requiresCredentials: true,
    credentialFields: [
      { key: 'POSTGRES_CONNECTION_STRING', label: { en: 'Connection String', zh: '连接字符串' }, type: 'password', required: true },
    ],
  },
  {
    id: 'brave_search',
    name: { en: 'Brave Search', zh: 'Brave 搜索' },
    description: { en: 'Web search using Brave', zh: '使用 Brave 进行网络搜索' },
    category: 'api',
    icon: '🔍',
    requiresCredentials: true,
    credentialFields: [
      { key: 'BRAVE_API_KEY', label: { en: 'API Key', zh: 'API 密钥' }, type: 'password', required: true },
    ],
  },
  {
    id: 'memory',
    name: { en: 'Memory', zh: '记忆' },
    description: { en: 'Persistent memory storage', zh: '持久记忆存储' },
    category: 'utility',
    icon: '🧠',
    requiresCredentials: false,
  },
  {
    id: 'puppeteer',
    name: { en: 'Puppeteer', zh: 'Puppeteer' },
    description: { en: 'Browser automation', zh: '浏览器自动化' },
    category: 'automation',
    icon: '🤖',
    requiresCredentials: false,
  },
];

const categories = [
  { id: 'all', label: { en: 'All', zh: '全部' } },
  { id: 'system', label: { en: 'System', zh: '系统' } },
  { id: 'api', label: { en: 'API', zh: 'API' } },
  { id: 'database', label: { en: 'Database', zh: '数据库' } },
  { id: 'utility', label: { en: 'Utility', zh: '工具' } },
  { id: 'automation', label: { en: 'Automation', zh: '自动化' } },
];

interface MCPPresetSelectorProps {
  t: T;
  lang: string;
  onPresetSelected: (preset: Dict) => void;
}

export function MCPPresetSelector({ t, lang, onPresetSelected }: MCPPresetSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPreset, setSelectedPreset] = useState<Dict | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useDialogKeyboard(Boolean(selectedPreset), () => setSelectedPreset(null));

  const filteredPresets =
    selectedCategory === 'all'
      ? presets
      : presets.filter((p) => p.category === selectedCategory);

  async function handleInstall() {
    if (!selectedPreset) return;

    setBusy(true);
    setError('');

    try {
      const config = {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', `@modelcontextprotocol/server-${selectedPreset.id}`],
      };

      const body = {
        requestId: crypto.randomUUID(),
        source: `preset:${selectedPreset.id}`,
        config,
        confirmed: true,
        ...(Object.keys(credentials).length ? { credentials } : {}),
      };

      await api('/api/v1/mcp', json(body));

      // Reset and notify
      setSelectedPreset(null);
      setCredentials({});
      onPresetSelected(selectedPreset);
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(false);
    }
  }

  function handleSelectPreset(preset: Dict) {
    setSelectedPreset(preset);
    setCredentials({});
    setError('');
  }

  return (
    <div className="mcp-preset-selector">
      <Panel>
        <h2>{t.quickSetup || 'Quick Setup'}</h2>
        <p className="section-note">
          {t.presetDescription ||
            'Choose from popular MCP servers for quick installation'}
        </p>

        <div className="category-filter">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'primary' : 'default'}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label[lang as 'en' | 'zh'] || cat.label.en}
            </Button>
          ))}
        </div>

        {filteredPresets.length === 0 ? (
          <Empty>{t.noPresetsFound || 'No presets found'}</Empty>
        ) : (
          <div className="preset-grid">
            {filteredPresets.map((preset) => (
              <div
                key={preset.id}
                className="preset-card"
                onClick={() => handleSelectPreset(preset)}
              >
                <div className="preset-icon">{preset.icon}</div>
                <h3>{preset.name[lang as 'en' | 'zh'] || preset.name.en}</h3>
                <p className="preset-description">
                  {preset.description[lang as 'en' | 'zh'] || preset.description.en}
                </p>
                <div className="preset-meta">
                  <Badge variant="info">{preset.category}</Badge>
                  {preset.requiresCredentials && (
                    <Badge variant="warning">{t.needsCredentials || 'Needs Credentials'}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {selectedPreset && (
        <div className="modal-backdrop" onClick={() => setSelectedPreset(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.installPreset || 'Install Preset'}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {selectedPreset.icon} {selectedPreset.name[lang as 'en' | 'zh'] || selectedPreset.name.en}
            </h2>
            <p>
              {selectedPreset.description[lang as 'en' | 'zh'] || selectedPreset.description.en}
            </p>

            {error && <Alert kind="error">{error}</Alert>}

            {selectedPreset.requiresCredentials && (
              <div className="credential-form">
                <h3>{t.configureCredentials || 'Configure Credentials'}</h3>
                {selectedPreset.credentialFields?.map((field: any) => (
                  <label key={field.key}>
                    {field.label[lang as 'en' | 'zh'] || field.label.en}
                    {field.required && <span className="required">*</span>}
                    <input
                      type={field.type || 'text'}
                      value={credentials[field.key] || ''}
                      onChange={(e) =>
                        setCredentials({ ...credentials, [field.key]: e.target.value })
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  </label>
                ))}
              </div>
            )}

            {!selectedPreset.requiresCredentials && (
              <Alert kind="info">
                {t.readyToInstall || 'This server is ready to install without additional configuration.'}
              </Alert>
            )}

            <div className="row">
              <Button variant="primary" onClick={handleInstall} busy={busy}>
                {t.install}
              </Button>
              <Button onClick={() => setSelectedPreset(null)}>{t.cancel}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
