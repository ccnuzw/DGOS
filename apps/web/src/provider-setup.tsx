import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface ProviderPreset {
  presetId: string;
  name: { en: string; zh: string };
  logo?: string;
  adapterId: string;
  defaultBaseUrl: string;
  documentation?: string;
  authMethod: string;
  popularModels?: string[];
  tags?: string[];
  official?: boolean;
}

interface ProviderConfig {
  providerConfigId: string;
  displayName: string;
  status: string;
  protocolType: string;
  baseUrl?: string;
  version: string;
  createdAt: string;
  lastTestAt?: string;
}

interface ConnectionTest {
  testId: string;
  status: 'pending' | 'passed' | 'failed';
  result?: {
    success: boolean;
    message?: string;
    details?: any;
  };
  createdAt: string;
  completedAt?: string;
}

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    presetId: 'openai',
    name: { en: 'OpenAI', zh: 'OpenAI' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    documentation: 'https://platform.openai.com/docs',
    authMethod: 'bearer',
    popularModels: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
    tags: ['official', 'popular'],
    official: true,
  },
  deepseek: {
    presetId: 'deepseek',
    name: { en: 'DeepSeek', zh: '深度求索' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    documentation: 'https://platform.deepseek.com/docs',
    authMethod: 'bearer',
    popularModels: ['deepseek-chat', 'deepseek-coder'],
    tags: ['official', 'china'],
    official: true,
  },
  zhipu: {
    presetId: 'zhipu',
    name: { en: 'Zhipu AI', zh: '智谱AI' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    documentation: 'https://open.bigmodel.cn/dev/api',
    authMethod: 'bearer',
    popularModels: ['glm-4', 'glm-4-plus', 'glm-3-turbo'],
    tags: ['official', 'china'],
    official: true,
  },
  moonshot: {
    presetId: 'moonshot',
    name: { en: 'Moonshot AI', zh: '月之暗面' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    documentation: 'https://platform.moonshot.cn/docs',
    authMethod: 'bearer',
    popularModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    tags: ['official', 'china'],
    official: true,
  },
  groq: {
    presetId: 'groq',
    name: { en: 'Groq', zh: 'Groq' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    documentation: 'https://console.groq.com/docs',
    authMethod: 'bearer',
    popularModels: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    tags: ['official', 'fast'],
    official: true,
  },
  custom: {
    presetId: 'custom',
    name: { en: 'Custom OpenAI-Compatible', zh: '自定义兼容API' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: '',
    authMethod: 'bearer',
    tags: ['custom'],
    official: false,
  },
};

export function ProviderSetup({ t, onChanged }: { t: T; onChanged: () => void }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [review, setReview] = useState<{ title: string; body: Dict; run: () => Promise<void> } | null>(null);

  useDialogKeyboard(Boolean(review), () => setReview(null));

  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function loadProviders() {
    const result = await api<{ items: ProviderConfig[] }>('/api/v1/provider/configs');
    setProviders(items(result));
  }

  useEffect(() => {
    void perform(loadProviders);
  }, []);

  // Update form when preset changes
  useEffect(() => {
    if (selectedPreset && PROVIDER_PRESETS[selectedPreset]) {
      const preset = PROVIDER_PRESETS[selectedPreset];
      setDisplayName(preset.name.en);
      setBaseUrl(preset.defaultBaseUrl);
      setTestResult(null);
    }
  }, [selectedPreset]);

  async function testConnection() {
    if (!baseUrl || !apiKey) {
      setError(t.fillRequiredFields || 'Please fill in all required fields');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError('');

    try {
      const config = {
        protocolType: 'openai-compatible',
        displayName: displayName || 'Test',
        credential: apiKey,
        scope: { endpoint: baseUrl },
        requestId: crypto.randomUUID(),
      };

      const test = await api<ConnectionTest>('/api/v1/provider/connection-tests', json(config));

      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await api<ConnectionTest>(`/api/v1/provider/connection-tests/${test.testId}`);

        if (result.status === 'passed' || result.status === 'failed') {
          setTestResult(result);
          break;
        }
        attempts++;
      }
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setTesting(false);
    }
  }

  async function createProvider() {
    if (!displayName || !baseUrl || !apiKey) {
      setError(t.fillRequiredFields || 'Please fill in all required fields');
      return;
    }

    if (!testResult || testResult.status !== 'passed') {
      setError(t.testConnectionFirst || 'Please test connection first');
      return;
    }

    const body = {
      protocolType: 'openai-compatible',
      displayName,
      credential: apiKey,
      scope: { endpoint: baseUrl },
      defaultForProtocol: false,
      requestId: crypto.randomUUID(),
    };

    setReview({
      title: t.createProvider || 'Create Provider',
      body: { displayName, baseUrl, protocolType: 'openai-compatible' },
      run: async () => {
        await api('/api/v1/provider/configs', json(body));
        await loadProviders();
        onChanged();
        // Reset form
        setSelectedPreset('');
        setDisplayName('');
        setBaseUrl('');
        setApiKey('');
        setTestResult(null);
      },
    });
  }

  async function deleteProvider(providerId: string) {
    setReview({
      title: t.deleteProvider || 'Delete Provider',
      body: { providerId },
      run: async () => {
        await api(`/api/v1/provider/configs/${encodeURIComponent(providerId)}`, { method: 'DELETE' });
        await loadProviders();
        onChanged();
      },
    });
  }

  async function testExistingProvider(providerId: string) {
    try {
      const config = await api<ProviderConfig>(`/api/v1/provider/configs/${encodeURIComponent(providerId)}`);
      const test = await api<ConnectionTest>(
        `/api/v1/provider/configs/${encodeURIComponent(providerId)}/test`,
        json({ requestId: crypto.randomUUID() })
      );

      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await api<ConnectionTest>(`/api/v1/provider/connection-tests/${test.testId}`);

        if (result.status === 'passed' || result.status === 'failed') {
          alert(result.result?.message || result.status);
          break;
        }
        attempts++;
      }
    } catch (failure) {
      setError(receiptError(failure));
    }
  }

  const canCreate = displayName && baseUrl && apiKey && testResult?.status === 'passed';

  return (
    <div className="stack">
      <Panel>
        <h2>{t.providerSetup || 'Provider Setup'}</h2>
        {error && <Alert>{error}</Alert>}

        {/* Quick Setup Wizard */}
        <fieldset>
          <legend>{t.quickSetup || 'Quick Setup'}</legend>

          <label>
            {t.selectProvider || 'Select Provider'}
            <select
              value={selectedPreset}
              onChange={e => setSelectedPreset(e.target.value)}
              disabled={busy}
            >
              <option value="">{t.chooseProvider || 'Choose a provider...'}</option>
              <optgroup label={t.popularProviders || 'Popular Providers'}>
                {Object.values(PROVIDER_PRESETS)
                  .filter(p => p.official)
                  .map(preset => (
                    <option key={preset.presetId} value={preset.presetId}>
                      {preset.name.en} {preset.name.zh && `(${preset.name.zh})`}
                    </option>
                  ))}
              </optgroup>
              <optgroup label={t.custom || 'Custom'}>
                <option value="custom">{t.customOpenAICompatible || 'Custom OpenAI-Compatible'}</option>
              </optgroup>
            </select>
          </label>

          {selectedPreset && PROVIDER_PRESETS[selectedPreset]?.documentation && (
            <p>
              <a
                href={PROVIDER_PRESETS[selectedPreset].documentation}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.viewDocumentation || 'View Documentation'} ↗
              </a>
            </p>
          )}

          <label>
            {t.displayName || 'Display Name'} *
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={t.providerDisplayName || 'My Provider'}
              disabled={busy}
            />
          </label>

          <label>
            {t.baseUrl || 'Base URL'} *
            <input
              type="url"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              disabled={busy}
            />
          </label>

          <label>
            {t.apiKey || 'API Key'} *
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={t.enterApiKey || 'Enter your API key'}
              disabled={busy}
              autoComplete="off"
            />
          </label>

          <div className="row">
            <Button onClick={() => void perform(testConnection)} disabled={!baseUrl || !apiKey || testing || busy}>
              {testing ? (t.testing || 'Testing...') : (t.testConnection || 'Test Connection')}
            </Button>

            {testResult && (
              <div className={`test-result ${testResult.status}`}>
                {testResult.status === 'passed' ? '✓' : '✗'} {testResult.result?.message}
                {testResult.result?.details?.modelsFound && (
                  <small> · {testResult.result.details.modelsFound} models</small>
                )}
              </div>
            )}
          </div>

          <Button variant="primary" onClick={() => void perform(createProvider)} disabled={!canCreate || busy}>
            {t.createProvider || 'Create Provider'}
          </Button>
        </fieldset>
      </Panel>

      {/* Provider List */}
      <Panel>
        <h2>{t.configuredProviders || 'Configured Providers'}</h2>

        {providers.length === 0 ? (
          <Empty>{t.noProvidersConfigured || 'No providers configured yet'}</Empty>
        ) : (
          <ul className="record-list">
            {providers.map(provider => (
              <li key={provider.providerConfigId}>
                <div>
                  <strong>{provider.displayName}</strong>
                  <small>
                    <Status value={provider.status} /> · {provider.protocolType}
                    {provider.baseUrl && ` · ${new URL(provider.baseUrl).hostname}`}
                  </small>
                  <small>
                    {t.created || 'Created'}: {new Date(provider.createdAt).toLocaleString()}
                    {provider.lastTestAt && (
                      <> · {t.lastTested || 'Last tested'}: {new Date(provider.lastTestAt).toLocaleString()}</>
                    )}
                  </small>
                </div>
                <div className="row">
                  <Button onClick={() => void perform(() => testExistingProvider(provider.providerConfigId))} disabled={busy}>
                    {t.test || 'Test'}
                  </Button>
                  <Button onClick={() => setShowDetails(provider.providerConfigId)}>
                    {t.details || 'Details'}
                  </Button>
                  <Button onClick={() => void perform(() => deleteProvider(provider.providerConfigId))} disabled={busy}>
                    {t.delete || 'Delete'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Review Modal */}
      {review && (
        <div className="modal-backdrop" onClick={() => setReview(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={review.title} onClick={e => e.stopPropagation()}>
            <h2>{review.title}</h2>
            <pre>{JSON.stringify(review.body, null, 2)}</pre>
            <div className="row">
              <Button variant="primary" busy={busy} onClick={() => void perform(async () => { await review.run(); setReview(null); })}>
                {t.confirm || 'Confirm'}
              </Button>
              <Button onClick={() => setReview(null)}>{t.cancel || 'Cancel'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
