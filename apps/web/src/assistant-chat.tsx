import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Button, Panel, Alert, Badge, Spinner } from '@dgos/dgos-ui';
import { api, receiptError } from './api';
import { useDialogKeyboard } from './dialog';
import './assistant-chat.css';

type Dict = Record<string, any>;
type T = {
  assistant: string;
  send: string;
  cancel: string;
  confirm: string;
  retry: string;
  loading: string;
  error: string;
  action: string;
  permission: string;
  execute: string;
  risk: string;
  approve: string;
  reject: string;
  executing: string;
  completed: string;
  failed: string;
  [key: string]: string;
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'completed' | 'failed';
  error?: string;
}

interface ActionRequest {
  id: string;
  actionId: string;
  description: string;
  risk: string;
  input: Dict;
  requiredPermissions: string[];
}

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'system-status', label: 'Check system status', prompt: 'Show me the current system status' },
  { id: 'list-apps', label: 'List installed apps', prompt: 'List all installed applications' },
  { id: 'check-providers', label: 'Check providers', prompt: 'Show provider configurations and status' },
  { id: 'review-permissions', label: 'Review permissions', prompt: 'Review current permission settings' },
];

export function AssistantChat({ t, session }: { t: T; session: Dict }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Add welcome message on mount
    if (messages.length === 0) {
      setMessages([{
        id: crypto.randomUUID(),
        role: 'system',
        content: t.assistantWelcome || 'Hello! I can help you manage your DGOS system. What would you like to do?',
        timestamp: new Date(),
        status: 'completed',
      }]);
    }
  }, []);

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string, status: Message['status'] = 'completed'): Message => {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
      status,
    };
    setMessages(prev => [...prev, message]);
    return message;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg));
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;

    setInput('');
    addMessage('user', text);

    const assistantMsg = addMessage('assistant', '', 'sending');

    try {
      // Resolve intent to action
      const resolution = await api<Dict>('/api/v1/actions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), text }),
      });

      const candidates = resolution.candidates || [];

      if (candidates.length === 0) {
        updateMessage(assistantMsg.id, {
          content: t.noCandidates || "I couldn't find an action that matches your request. Could you try rephrasing?",
          status: 'completed',
        });
        return;
      }

      const candidate = candidates[0];
      updateMessage(assistantMsg.id, {
        content: `I understand you want to: ${candidate.actionId}. Let me prepare this action...`,
        status: 'completed',
      });

      // Create action request for confirmation
      setActionRequest({
        id: crypto.randomUUID(),
        actionId: candidate.actionId,
        description: candidate.description || candidate.actionId,
        risk: candidate.risk || 'unknown',
        input: candidate.input || {},
        requiredPermissions: candidate.requiredCapabilities || [],
      });

    } catch (error) {
      updateMessage(assistantMsg.id, {
        content: `Error: ${receiptError(error)}`,
        status: 'failed',
        error: receiptError(error),
      });
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setInput(action.prompt);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  return (
    <div className="assistant-chat">
      <Panel className="chat-container">
        <div className="messages-list">
          {messages.map(msg => (
            <div key={msg.id} className={`message message-${msg.role}`}>
              <div className="message-header">
                <strong>{msg.role === 'user' ? 'You' : msg.role === 'assistant' ? t.assistant : 'System'}</strong>
                <span className="message-time">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {msg.status === 'sending' ? (
                  <Spinner size="sm" label={t.loading} />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.status === 'failed' && msg.error && (
                <Alert kind="error">{msg.error}</Alert>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="quick-actions">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.id}
              className="quick-action-btn"
              onClick={() => handleQuickAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>

        <form className="input-area" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.assistantPlaceholder || 'Type your request... (Cmd/Ctrl + Enter to send)'}
            disabled={executingAction}
            className="message-input"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!input.trim() || executingAction}
          >
            {t.send || 'Send'}
          </Button>
        </form>

        {input.length > 0 && (
          <div className="input-hint">
            {input.length} / 2000 characters
          </div>
        )}
      </Panel>

      {actionRequest && (
        <ActionConfirmDialog
          t={t}
          request={actionRequest}
          session={session}
          onConfirm={async () => {
            setExecutingAction(true);
            setActionRequest(null);

            const executionMsg = addMessage('system', `Executing: ${actionRequest.description}...`, 'sending');

            try {
              // This would integrate with the actual action execution flow
              // For now, showing the concept
              updateMessage(executionMsg.id, {
                content: `Action completed: ${actionRequest.description}`,
                status: 'completed',
              });
            } catch (error) {
              updateMessage(executionMsg.id, {
                content: `Action failed: ${receiptError(error)}`,
                status: 'failed',
                error: receiptError(error),
              });
            } finally {
              setExecutingAction(false);
            }
          }}
          onCancel={() => {
            setActionRequest(null);
            addMessage('system', 'Action cancelled.');
          }}
        />
      )}
    </div>
  );
}

function ActionConfirmDialog({
  t,
  request,
  session,
  onConfirm,
  onCancel,
}: {
  t: T;
  request: ActionRequest;
  session: Dict;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useDialogKeyboard(true, onCancel);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal action-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t.confirmAction || 'Confirm Action'}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{t.confirmAction || 'Confirm Action'}</h2>

        <div className="action-details">
          <dl>
            <dt>{t.action}</dt>
            <dd><strong>{request.actionId}</strong></dd>

            <dt>Description</dt>
            <dd>{request.description}</dd>

            <dt>{t.risk}</dt>
            <dd>
              <Badge variant={request.risk === 'high' ? 'danger' : request.risk === 'medium' ? 'warning' : 'info'}>
                {request.risk}
              </Badge>
            </dd>

            {request.requiredPermissions.length > 0 && (
              <>
                <dt>{t.permission}</dt>
                <dd>
                  <ul className="permission-list">
                    {request.requiredPermissions.map(perm => (
                      <li key={perm}>{perm}</li>
                    ))}
                  </ul>
                </dd>
              </>
            )}

            {Object.keys(request.input).length > 0 && (
              <>
                <dt>Input Parameters</dt>
                <dd>
                  <pre>{JSON.stringify(request.input, null, 2)}</pre>
                </dd>
              </>
            )}
          </dl>
        </div>

        <div className="row">
          <Button variant="primary" onClick={onConfirm}>
            {t.confirm}
          </Button>
          <Button onClick={onCancel}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
