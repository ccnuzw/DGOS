import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

// Capability types based on FR-007 specification
const CAPABILITY_TYPES = [
  'text',
  'image-generation',
  'video-generation',
  'audio-generation',
  'image-understanding',
  'video-understanding',
  'audio-understanding',
  'embedding',
  'multimodal'
] as const;

type CapabilityType = typeof CAPABILITY_TYPES[number];

const CAPABILITY_LABELS: Record<CapabilityType, string> = {
  'text': 'Text Generation',
  'image-generation': 'Image Generation',
  'video-generation': 'Video Generation',
  'audio-generation': 'Audio Generation',
  'image-understanding': 'Image Understanding',
  'video-understanding': 'Video Understanding',
  'audio-understanding': 'Audio Understanding',
  'embedding': 'Embeddings',
  'multimodal': 'Multimodal'
};

interface ModelItem {
  modelId: string;
  displayName?: string;
  taskModes: string[];
  availability: string;
  capabilities?: string[];
  userCapabilities?: string[];
}

interface ModelPolicy {
  modelId: string;
  enabled: boolean;
  capabilities?: string[];
  isDefault?: boolean;
  defaultForCapability?: string;
}

interface ProviderCatalog {
  providerConfigId: string;
  catalogVersion: string;
  status: string;
  items: ModelItem[];
  refreshedAt: string | null;
}

interface ProviderConfig {
  providerConfigId: string;
  displayName: string;
  status: string;
  version: string;
  protocolType: string;
}

export function ModelManagement({ t, onChanged }: { t: T; onChanged: () => void }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [catalog, setCatalog] = useState<ProviderCatalog | null>(null);
  const [policies, setPolicies] = useState<ModelPolicy[]>([]);
  const [filter, setFilter] = useState<CapabilityType | 'all' | 'unclassified'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
    if (items(result).length && !selectedProvider) {
      setSelectedProvider(items(result)[0].providerConfigId);
    }
  }

  async function loadCatalog(providerId: string) {
    const result = await api<ProviderCatalog>(`/api/v1/provider/configs/${encodeURIComponent(providerId)}/models`);
    setCatalog(result);
  }

  async function loadPolicies(providerId: string) {
    const result = await api<{ items: ModelPolicy[] }>(`/api/v1/provider/configs/${encodeURIComponent(providerId)}/model-policies`);
    setPolicies(items(result));
  }

  async function refreshCatalog() {
    if (!selectedProvider) return;
    const result = await api<Dict>(
      `/api/v1/provider/configs/${encodeURIComponent(selectedProvider)}/models`,
      json({ requestId: crypto.randomUUID() })
    );
    await loadCatalog(selectedProvider);
    onChanged();
  }

  async function updateModelPolicy(modelId: string, updates: Partial<ModelPolicy>) {
    if (!selectedProvider || !catalog) return;

    const currentPolicy = policies.find(p => p.modelId === modelId) || { modelId, enabled: false };
    const patch = { ...currentPolicy, ...updates };

    const body = {
      requestId: crypto.randomUUID(),
      modelId,
      enabled: patch.enabled,
      capabilities: patch.capabilities || [],
      defaultForCapability: patch.defaultForCapability
    };

    setReview({
      title: t.updateModelPolicy || 'Update Model Policy',
      body: { modelId, ...updates },
      run: async () => {
        await api(
          `/api/v1/provider/configs/${encodeURIComponent(selectedProvider)}/model-policies`,
          json(body)
        );
        await loadPolicies(selectedProvider);
        onChanged();
      }
    });
  }

  async function toggleModelEnabled(modelId: string, enabled: boolean) {
    const policy = policies.find(p => p.modelId === modelId);
    await updateModelPolicy(modelId, { enabled, capabilities: policy?.capabilities || [] });
  }

  async function updateModelCapabilities(modelId: string, capabilities: string[]) {
    const policy = policies.find(p => p.modelId === modelId);
    await updateModelPolicy(modelId, { capabilities, enabled: policy?.enabled || false });
  }

  async function setDefaultModel(capability: string, modelId: string) {
    await updateModelPolicy(modelId, { defaultForCapability: capability });
  }

  useEffect(() => {
    void perform(loadProviders);
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      void perform(async () => {
        await loadCatalog(selectedProvider);
        await loadPolicies(selectedProvider);
      });
    }
  }, [selectedProvider]);

  const filteredModels = catalog?.items.filter(model => {
    const policy = policies.find(p => p.modelId === model.modelId);
    const modelCapabilities = policy?.capabilities || model.userCapabilities || [];

    // Search filter
    if (searchQuery && !model.modelId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(model.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Capability filter
    if (filter === 'all') return true;
    if (filter === 'unclassified') return modelCapabilities.length === 0;
    return modelCapabilities.includes(filter);
  }) || [];

  const groupedByCapability = () => {
    const grouped: Record<string, ModelItem[]> = {};
    CAPABILITY_TYPES.forEach(cap => {
      grouped[cap] = (catalog?.items || []).filter(model => {
        const policy = policies.find(p => p.modelId === model.modelId);
        const modelCapabilities = policy?.capabilities || model.userCapabilities || [];
        return modelCapabilities.includes(cap);
      });
    });
    grouped['unclassified'] = (catalog?.items || []).filter(model => {
      const policy = policies.find(p => p.modelId === model.modelId);
      const modelCapabilities = policy?.capabilities || model.userCapabilities || [];
      return modelCapabilities.length === 0;
    });
    return grouped;
  };

  const getDefaultModel = (capability: string): string | null => {
    const defaultPolicy = policies.find(p => p.defaultForCapability === capability);
    return defaultPolicy?.modelId || null;
  };

  return (
    <div className="stack">
      <Panel>
        <h2>{t.modelManagement || 'Model Management'}</h2>
        {error && <Alert>{error}</Alert>}

        {/* Provider Selection */}
        <div className="row between">
          <label>
            {t.selectProvider || 'Select Provider'}
            <select
              value={selectedProvider}
              onChange={e => setSelectedProvider(e.target.value)}
              disabled={busy}
            >
              <option value="">{t.chooseProvider || 'Choose Provider'}</option>
              {providers.map(p => (
                <option key={p.providerConfigId} value={p.providerConfigId}>
                  {p.displayName} ({p.status})
                </option>
              ))}
            </select>
          </label>

          <Button onClick={() => void perform(refreshCatalog)} disabled={!selectedProvider || busy}>
            {t.refreshCatalog || 'Refresh Catalog'}
          </Button>
        </div>

        {catalog && (
          <>
            {/* Catalog Status */}
            <div className="row">
              <p>
                <Status value={catalog.status} />
                {t.catalogVersion || 'Catalog Version'}: {catalog.catalogVersion} ·
                {catalog.refreshedAt ? new Date(catalog.refreshedAt).toLocaleString() : t.notRefreshed || 'Not refreshed'}
              </p>
            </div>

            {/* Search and Filter */}
            <div className="row between">
              <label>
                {t.search || 'Search'}
                <input
                  type="text"
                  placeholder={t.searchModels || 'Search models...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </label>

              <label>
                {t.filterByCapability || 'Filter by Capability'}
                <select value={filter} onChange={e => setFilter(e.target.value as any)}>
                  <option value="all">{t.allModels || 'All Models'}</option>
                  <option value="unclassified">{t.unclassified || 'Unclassified'}</option>
                  {CAPABILITY_TYPES.map(cap => (
                    <option key={cap} value={cap}>{CAPABILITY_LABELS[cap]}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Model List */}
            {filteredModels.length > 0 ? (
              <ul className="record-list">
                {filteredModels.map(model => {
                  const policy = policies.find(p => p.modelId === model.modelId);
                  const modelCapabilities = policy?.capabilities || model.userCapabilities || [];
                  const isDefault = policy?.defaultForCapability;

                  return (
                    <li key={model.modelId}>
                      <div>
                        <strong>{model.displayName || model.modelId}</strong>
                        <small>
                          {model.modelId} · <Status value={model.availability} />
                          {isDefault && ` · Default for ${CAPABILITY_LABELS[isDefault as CapabilityType]}`}
                        </small>
                        <div className="row">
                          {modelCapabilities.map(cap => (
                            <span key={cap} className="badge">{CAPABILITY_LABELS[cap as CapabilityType] || cap}</span>
                          ))}
                          {modelCapabilities.length === 0 && (
                            <span className="badge warning">{t.unclassified || 'Unclassified'}</span>
                          )}
                        </div>
                      </div>
                      <div className="row">
                        <Button
                          onClick={() => void perform(() => toggleModelEnabled(model.modelId, !policy?.enabled))}
                          disabled={busy}
                        >
                          {policy?.enabled ? (t.disable || 'Disable') : (t.enable || 'Enable')}
                        </Button>
                        <details>
                          <summary>{t.configure || 'Configure'}</summary>
                          <ModelCapabilityEditor
                            modelId={model.modelId}
                            currentCapabilities={modelCapabilities}
                            onUpdate={caps => void perform(() => updateModelCapabilities(model.modelId, caps))}
                            onSetDefault={cap => void perform(() => setDefaultModel(cap, model.modelId))}
                            isDefault={isDefault}
                            t={t}
                          />
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>{t.noModelsFound || 'No models found'}</Empty>
            )}

            {/* Capability Groups View */}
            <details>
              <summary>{t.viewByCapability || 'View by Capability'}</summary>
              {Object.entries(groupedByCapability()).map(([capability, models]) => (
                models.length > 0 && (
                  <div key={capability} className="stack">
                    <h3>{CAPABILITY_LABELS[capability as CapabilityType] || capability} ({models.length})</h3>
                    {getDefaultModel(capability) && (
                      <p><strong>{t.default || 'Default'}:</strong> {getDefaultModel(capability)}</p>
                    )}
                    <ul>
                      {models.map(m => (
                        <li key={m.modelId}>{m.displayName || m.modelId}</li>
                      ))}
                    </ul>
                  </div>
                )
              ))}
            </details>
          </>
        )}
      </Panel>

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

function ModelCapabilityEditor({
  modelId,
  currentCapabilities,
  onUpdate,
  onSetDefault,
  isDefault,
  t
}: {
  modelId: string;
  currentCapabilities: string[];
  onUpdate: (capabilities: string[]) => void;
  onSetDefault: (capability: string) => void;
  isDefault?: string;
  t: T;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentCapabilities));

  const toggleCapability = (cap: string) => {
    const next = new Set(selected);
    if (next.has(cap)) {
      next.delete(cap);
    } else {
      next.add(cap);
    }
    setSelected(next);
  };

  return (
    <div className="stack">
      <fieldset>
        <legend>{t.selectCapabilities || 'Select Capabilities'}</legend>
        {CAPABILITY_TYPES.map(cap => (
          <label key={cap} className="checkline">
            <input
              type="checkbox"
              checked={selected.has(cap)}
              onChange={() => toggleCapability(cap)}
            />
            {CAPABILITY_LABELS[cap]}
          </label>
        ))}
      </fieldset>

      <Button onClick={() => onUpdate(Array.from(selected))}>
        {t.saveCapabilities || 'Save Capabilities'}
      </Button>

      {selected.size > 0 && (
        <div className="stack">
          <label>
            {t.setAsDefault || 'Set as Default for'}
            <select onChange={e => e.target.value && onSetDefault(e.target.value)}>
              <option value="">{t.chooseCapability || 'Choose capability'}</option>
              {Array.from(selected).map(cap => (
                <option key={cap} value={cap}>
                  {CAPABILITY_LABELS[cap as CapabilityType]}
                  {isDefault === cap ? ` (${t.current || 'current'})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
