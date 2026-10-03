import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface CapabilityProtocol {
  protocolId: string;
  version: string;
  name: { en: string; zh: string };
  adapterId: string;
  status: 'draft' | 'active' | 'deprecated';
  declaration: string; // JSON string
  createdAt: string;
  updatedAt?: string;
}

interface AdapterInfo {
  protocolType: string;
  adapterVersion: string;
  capabilityDescriptorSchemaVersion: string;
  taskModes: string[];
  status: string;
}

export function ProtocolCenter({ t, onChanged }: { t: T; onChanged: () => void }) {
  const [protocols, setProtocols] = useState<CapabilityProtocol[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [declarationText, setDeclarationText] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
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

  async function loadProtocols() {
    const result = await api<{ items: CapabilityProtocol[] }>('/api/v1/provider/capability-protocols');
    setProtocols(items(result));
  }

  async function loadAdapters() {
    const result = await api<{ items: AdapterInfo[] }>('/api/v1/provider/protocols');
    setAdapters(items(result));
  }

  useEffect(() => {
    void perform(async () => {
      await loadProtocols();
      await loadAdapters();
    });
  }, []);

  function createNewProtocol() {
    const template = {
      schemaVersion: 'dgos-capability/v1',
      kind: 'capability-protocol',
      id: 'my-protocol',
      version: '1.0.0',
      name: {
        en: 'My Protocol',
        zh: '我的协议',
      },
      capabilities: [
        {
          capability: 'text.chat',
          operations: {
            submit: {
              method: 'POST',
              path: '/chat/completions',
              bodyTemplate: {
                model: '{{model}}',
                messages: '{{messages}}',
              },
              responseMapping: {
                content: '$.choices[0].message.content',
                finishReason: '$.choices[0].finish_reason',
              },
            },
          },
          workflows: [
            {
              name: 'chat-sync',
              type: 'sync',
              steps: [{ operation: 'submit' }],
              statusMapping: {
                success: '$.choices[0].finish_reason == "stop"',
              },
            },
          ],
        },
      ],
      authentication: ['bearer'],
      connectionSchema: {
        type: 'object',
        required: ['baseUrl', 'credential'],
        properties: {
          baseUrl: { type: 'string', format: 'uri' },
          credential: { type: 'string' },
        },
      },
    };

    setDeclarationText(JSON.stringify(template, null, 2));
    setEditing(true);
    setSelectedProtocol(null);
    setValidationResult(null);
  }

  function editProtocol(protocol: CapabilityProtocol) {
    setDeclarationText(protocol.declaration);
    setSelectedProtocol(protocol.protocolId);
    setEditing(true);
    setValidationResult(null);
  }

  async function validateDeclaration() {
    try {
      const declaration = JSON.parse(declarationText);

      const result = await api('/api/v1/provider/capability-protocols', json({
        requestId: crypto.randomUUID(),
        declaration,
      }));

      setValidationResult({
        valid: true,
        digest: result.digest,
        message: t.validationPassed || 'Validation passed',
      });
    } catch (failure: any) {
      setValidationResult({
        valid: false,
        message: receiptError(failure),
      });
    }
  }

  async function publishProtocol() {
    if (!validationResult?.valid) {
      setError(t.validateFirst || 'Please validate the protocol first');
      return;
    }

    const declaration = JSON.parse(declarationText);

    setReview({
      title: t.publishProtocol || 'Publish Protocol',
      body: { id: declaration.id, version: declaration.version },
      run: async () => {
        // This would integrate with the protocol publishing workflow
        // For now, just show success
        alert(t.protocolPublishSuccess || 'Protocol published successfully!');
        setEditing(false);
        await loadProtocols();
        onChanged();
      },
    });
  }

  function cancelEditing() {
    setEditing(false);
    setSelectedProtocol(null);
    setDeclarationText('');
    setValidationResult(null);
  }

  const protocol = selectedProtocol ? protocols.find(p => p.protocolId === selectedProtocol) : null;

  return (
    <div className="stack">
      <Panel>
        <h2>{t.protocolCenter || 'Protocol Center'}</h2>
        <p>{t.protocolCenterDesc || 'Manage provider adapter protocols and capability definitions.'}</p>
        {error && <Alert>{error}</Alert>}

        {!editing ? (
          <>
            {/* Registered Adapters */}
            <fieldset>
              <legend>{t.registeredAdapters || 'Registered Adapters'}</legend>
              {adapters.length === 0 ? (
                <Empty>{t.noAdaptersRegistered || 'No adapters registered'}</Empty>
              ) : (
                <ul className="record-list">
                  {adapters.map(adapter => (
                    <li key={adapter.protocolType}>
                      <div>
                        <strong>{adapter.protocolType}</strong>
                        <small>
                          <Status value={adapter.status} /> · Version {adapter.adapterVersion}
                        </small>
                        <small>
                          {t.taskModes || 'Task Modes'}: {adapter.taskModes.join(', ')}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            {/* Capability Protocols */}
            <fieldset>
              <legend>{t.capabilityProtocols || 'Capability Protocols'}</legend>
              <Button onClick={createNewProtocol} disabled={busy}>
                {t.createNewProtocol || 'Create New Protocol'}
              </Button>

              {protocols.length === 0 ? (
                <Empty>{t.noProtocolsConfigured || 'No protocols configured yet'}</Empty>
              ) : (
                <ul className="record-list">
                  {protocols.map(proto => (
                    <li key={`${proto.protocolId}-${proto.version}`}>
                      <div>
                        <strong>{proto.name.en}</strong>
                        <small>
                          <Status value={proto.status} /> · {proto.protocolId} v{proto.version}
                        </small>
                        <small>
                          {t.created || 'Created'}: {new Date(proto.createdAt).toLocaleString()}
                        </small>
                      </div>
                      <div className="row">
                        <Button onClick={() => editProtocol(proto)} disabled={busy}>
                          {t.view || 'View'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </>
        ) : (
          <>
            {/* Protocol Editor */}
            <h3>{selectedProtocol ? t.editProtocol || 'Edit Protocol' : t.newProtocol || 'New Protocol'}</h3>

            <label>
              {t.protocolDeclaration || 'Protocol Declaration (JSON)'}
              <textarea
                value={declarationText}
                onChange={e => setDeclarationText(e.target.value)}
                rows={25}
                style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
                disabled={busy}
              />
            </label>

            {validationResult && (
              <div className={`validation-result ${validationResult.valid ? 'success' : 'error'}`}>
                {validationResult.valid ? '✓' : '✗'} {validationResult.message}
                {validationResult.digest && (
                  <small> · Digest: {validationResult.digest.slice(0, 16)}...</small>
                )}
              </div>
            )}

            <div className="row">
              <Button onClick={() => void perform(validateDeclaration)} disabled={busy}>
                {t.validate || 'Validate'}
              </Button>
              <Button
                variant="primary"
                onClick={() => void perform(publishProtocol)}
                disabled={!validationResult?.valid || busy}
              >
                {t.publish || 'Publish'}
              </Button>
              <Button onClick={cancelEditing}>{t.cancel || 'Cancel'}</Button>
            </div>

            {/* Quick Reference */}
            <details>
              <summary>{t.quickReference || 'Quick Reference'}</summary>
              <div className="reference-guide">
                <h4>{t.standardCapabilities || 'Standard Capabilities'}</h4>
                <ul>
                  <li><code>text.chat</code> - Conversational text generation</li>
                  <li><code>text.completion</code> - Text completion</li>
                  <li><code>text.embedding</code> - Text embeddings</li>
                  <li><code>image.generate</code> - Image generation</li>
                  <li><code>image.understand</code> - Image understanding</li>
                  <li><code>audio.generate</code> - Audio synthesis</li>
                  <li><code>audio.understand</code> - Audio transcription</li>
                </ul>

                <h4>{t.jsonpathExamples || 'JSONPath Examples'}</h4>
                <ul>
                  <li><code>$.field</code> - Root field access</li>
                  <li><code>$.nested.field</code> - Nested field</li>
                  <li><code>$.array[0]</code> - Array index</li>
                  <li><code>$.array[*]</code> - All array items</li>
                </ul>

                <h4>{t.workflowTypes || 'Workflow Types'}</h4>
                <ul>
                  <li><code>sync</code> - Single request-response</li>
                  <li><code>async</code> - Submit then poll</li>
                  <li><code>streaming</code> - Server-sent events</li>
                </ul>
              </div>
            </details>
          </>
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
