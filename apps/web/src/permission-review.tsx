import { Alert, Button, Panel, Status } from '@dgos/dgos-ui';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

export function RiskBadge({ level }: { level: string }) {
  const riskColors: Record<string, string> = {
    low: 'risk-low',
    medium: 'risk-medium',
    high: 'risk-high',
    critical: 'risk-critical',
  };

  return (
    <span className={`risk-badge ${riskColors[level] || 'risk-unknown'}`}>
      {level.toUpperCase()}
    </span>
  );
}

export function SideEffectsWarning({ hasSideEffects }: { hasSideEffects: boolean }) {
  if (!hasSideEffects) return null;

  return (
    <Alert kind="error">
      ⚠️ This operation may have side effects (file modifications, external API calls, etc.)
    </Alert>
  );
}

export function PermissionReviewPanel({
  t,
  extension,
  permissions,
  onApprove,
  onDeny,
  busy = false,
}: {
  t: T;
  extension: Dict;
  permissions: string[];
  onApprove: () => void;
  onDeny: () => void;
  busy?: boolean;
}) {
  const permissionDescriptions: Record<string, { label: string; description: string; risk: string }> = {
    'file.read': {
      label: t.permissionFileRead || 'Read Files',
      description: t.permissionFileReadDesc || 'Read files and directories in the project',
      risk: 'low',
    },
    'file.write': {
      label: t.permissionFileWrite || 'Write Files',
      description: t.permissionFileWriteDesc || 'Create, modify, or delete files',
      risk: 'high',
    },
    'network.fetch': {
      label: t.permissionNetworkFetch || 'Network Access',
      description: t.permissionNetworkFetchDesc || 'Make HTTP requests to external services',
      risk: 'medium',
    },
    'process.spawn': {
      label: t.permissionProcessSpawn || 'Execute Commands',
      description: t.permissionProcessSpawnDesc || 'Run external programs and scripts',
      risk: 'critical',
    },
    'env.read': {
      label: t.permissionEnvRead || 'Read Environment',
      description: t.permissionEnvReadDesc || 'Access environment variables',
      risk: 'medium',
    },
    'secret.read': {
      label: t.permissionSecretRead || 'Read Secrets',
      description: t.permissionSecretReadDesc || 'Access stored credentials and API keys',
      risk: 'high',
    },
  };

  const groupedPermissions = permissions.map((perm) => ({
    permission: perm,
    ...permissionDescriptions[perm] || {
      label: perm,
      description: t.unknownPermission || 'Unknown permission',
      risk: 'medium',
    },
  }));

  const highestRisk = groupedPermissions.reduce((max, p) => {
    const risks = ['low', 'medium', 'high', 'critical'];
    return risks.indexOf(p.risk) > risks.indexOf(max) ? p.risk : max;
  }, 'low');

  return (
    <Panel>
      <div className="permission-review">
        <h2>{t.reviewPermissions || 'Review Permissions'}</h2>

        <div className="extension-summary">
          <strong>{extension.displayName || extension.id}</strong>
          <small>{extension.id} · {extension.version}</small>
          <Status value={extension.state} />
        </div>

        <Alert kind={highestRisk === 'critical' || highestRisk === 'high' ? 'error' : 'info'}>
          {t.permissionReviewNotice ||
            'This extension requests the following permissions. Review carefully before approving.'}
        </Alert>

        {groupedPermissions.length === 0 ? (
          <p className="muted">{t.noPermissionsRequested || 'No special permissions requested'}</p>
        ) : (
          <ul className="permission-list">
            {groupedPermissions.map((perm, index) => (
              <li key={index} className="permission-item">
                <div className="permission-header">
                  <strong>{perm.label}</strong>
                  <RiskBadge level={perm.risk} />
                </div>
                <p className="permission-description">{perm.description}</p>
                <code className="permission-code">{perm.permission}</code>
              </li>
            ))}
          </ul>
        )}

        <div className="permission-actions row">
          <Button variant="primary" onClick={onApprove} busy={busy}>
            {t.approvePermissions || 'Approve & Install'}
          </Button>
          <Button onClick={onDeny} disabled={busy}>
            {t.deny}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

export function ToolPermissionReview({
  t,
  tool,
  input,
  onConfirm,
  onCancel,
  busy = false,
}: {
  t: T;
  tool: Dict;
  input: Dict;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal tool-permission-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.confirmToolInvocation || 'Confirm Tool Invocation'}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{t.confirmToolInvocation || 'Confirm Tool Invocation'}</h2>

        <div className="tool-summary">
          <div className="tool-header">
            <strong>{tool.operationId}</strong>
            <RiskBadge level={tool.risk || 'medium'} />
          </div>

          <dl className="data-grid">
            <div>
              <dt>{t.permission || 'Permission'}</dt>
              <dd>{tool.permission}</dd>
            </div>
            <div>
              <dt>{t.risk || 'Risk'}</dt>
              <dd><RiskBadge level={tool.risk || 'medium'} /></dd>
            </div>
            <div>
              <dt>{t.sideEffects || 'Side Effects'}</dt>
              <dd>{String(tool.sideEffects)}</dd>
            </div>
          </dl>
        </div>

        <SideEffectsWarning hasSideEffects={tool.sideEffects} />

        {tool.description && (
          <div className="tool-description">
            <strong>{t.description || 'Description'}</strong>
            <p>{tool.description}</p>
          </div>
        )}

        <div className="tool-input">
          <strong>{t.inputParameters || 'Input Parameters'}</strong>
          <pre>{JSON.stringify(input, null, 2)}</pre>
        </div>

        {(tool.risk === 'high' || tool.risk === 'critical') && (
          <Alert kind="error">
            {t.highRiskWarning ||
              'This is a high-risk operation. Verify the input parameters before proceeding.'}
          </Alert>
        )}

        <div className="row">
          <Button variant={tool.risk === 'high' || tool.risk === 'critical' ? 'danger' : 'primary'} onClick={onConfirm} busy={busy}>
            {t.confirm} {t.invokeTool || 'Invoke Tool'}
          </Button>
          <Button onClick={onCancel} disabled={busy}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
