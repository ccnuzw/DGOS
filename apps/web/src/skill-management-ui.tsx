// Enhanced Skill Management UI for DGOS V1

import { useState, useEffect, type FormEvent } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface SkillListProps {
  t: T;
  skills: Dict[];
  selectedSkill: string | null;
  onSelect: (skillId: string) => void;
  onAction: (skillId: string, action: string) => void;
  filter: SkillFilter;
}

interface SkillFilter {
  search: string;
  category: string;
  state: string;
  sort: string;
}

function SkillCard({ skill, selected, onSelect, onAction, t }: any) {
  return (
    <div
      className={`skill-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(skill.skillId)}
    >
      <div className="skill-card-header">
        {skill.manifest?.icon && <span className="skill-icon">{skill.manifest.icon}</span>}
        <div className="skill-info">
          <h3>{skill.manifest?.name?.en || skill.skillId}</h3>
          <p className="skill-description">{skill.manifest?.description?.en}</p>
        </div>
        <Status value={skill.state} />
      </div>
      <div className="skill-card-meta">
        <span className="skill-category">{skill.manifest?.category}</span>
        <span className="skill-version">v{skill.manifest?.version}</span>
      </div>
      {skill.manifest?.triggers?.length > 0 && (
        <div className="skill-triggers">
          <small>Triggers: {skill.manifest.triggers.map((t: any) => t.value).join(', ')}</small>
        </div>
      )}
      {skill.stats && (
        <div className="skill-stats">
          <small>
            {skill.stats.invocationCount} calls · {Math.round(skill.stats.averageDuration)}ms avg
          </small>
        </div>
      )}
      <div className="skill-card-actions">
        <Button
          size="small"
          onClick={(e: any) => {
            e.stopPropagation();
            onAction(skill.skillId, skill.state === 'enabled' ? 'disable' : 'enable');
          }}
        >
          {skill.state === 'enabled' ? t.disable : t.enable}
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={(e: any) => {
            e.stopPropagation();
            onAction(skill.skillId, 'test');
          }}
        >
          Test
        </Button>
      </div>
    </div>
  );
}

function SkillDetailPanel({ skill, t, onAction, onClose }: any) {
  useDialogKeyboard(true, onClose);

  if (!skill) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal skill-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {skill.manifest?.icon} {skill.manifest?.name?.en || skill.skillId}
          </h2>
          <Button onClick={onClose}>{t.close}</Button>
        </div>

        <div className="skill-detail-content">
          {/* Basic Information */}
          <section>
            <h3>Basic Information</h3>
            <dl>
              <dt>Skill ID</dt>
              <dd>{skill.skillId}</dd>
              <dt>Version</dt>
              <dd>{skill.manifest?.version}</dd>
              <dt>Category</dt>
              <dd>{skill.manifest?.category}</dd>
              <dt>Status</dt>
              <dd><Status value={skill.state} /></dd>
              {skill.manifest?.author && (
                <>
                  <dt>Author</dt>
                  <dd>{skill.manifest.author.name}</dd>
                </>
              )}
            </dl>
          </section>

          {/* Description */}
          <section>
            <h3>Description</h3>
            <p>{skill.manifest?.description?.en}</p>
            {skill.manifest?.description?.zh && (
              <p className="secondary">{skill.manifest.description.zh}</p>
            )}
          </section>

          {/* Triggers */}
          {skill.manifest?.triggers?.length > 0 && (
            <section>
              <h3>Triggers</h3>
              <ul>
                {skill.manifest.triggers.map((trigger: any, i: number) => (
                  <li key={i}>
                    <strong>{trigger.type}:</strong> {trigger.value}
                    {trigger.examples && (
                      <div className="trigger-examples">
                        Examples: {trigger.examples.join(', ')}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Parameters */}
          {skill.manifest?.parameters?.length > 0 && (
            <section>
              <h3>Parameters</h3>
              <table className="params-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {skill.manifest.parameters.map((param: any) => (
                    <tr key={param.name}>
                      <td><code>{param.name}</code></td>
                      <td>{param.type}</td>
                      <td>{param.required ? 'Yes' : 'No'}</td>
                      <td>{param.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Permissions */}
          {skill.manifest?.permissions?.length > 0 && (
            <section>
              <h3>Permissions</h3>
              <ul>
                {skill.manifest.permissions.map((perm: any, i: number) => (
                  <li key={i}>
                    <strong>{perm.capability}</strong>: {perm.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Execution Config */}
          {skill.manifest?.execution && (
            <section>
              <h3>Execution Configuration</h3>
              <dl>
                <dt>Timeout</dt>
                <dd>{skill.manifest.execution.timeout || 30000}ms</dd>
                <dt>Retryable</dt>
                <dd>{skill.manifest.execution.retryable ? 'Yes' : 'No'}</dd>
                <dt>Async</dt>
                <dd>{skill.manifest.execution.async ? 'Yes' : 'No'}</dd>
              </dl>
            </section>
          )}

          {/* Statistics */}
          {skill.stats && (
            <section>
              <h3>Usage Statistics</h3>
              <dl>
                <dt>Total Invocations</dt>
                <dd>{skill.stats.invocationCount}</dd>
                <dt>Success Rate</dt>
                <dd>
                  {skill.stats.invocationCount > 0
                    ? Math.round((skill.stats.successCount / skill.stats.invocationCount) * 100)
                    : 0}%
                </dd>
                <dt>Average Duration</dt>
                <dd>{Math.round(skill.stats.averageDuration)}ms</dd>
                {skill.stats.lastInvocation && (
                  <>
                    <dt>Last Invocation</dt>
                    <dd>{new Date(skill.stats.lastInvocation).toLocaleString()}</dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {/* Tags */}
          {skill.manifest?.tags?.length > 0 && (
            <section>
              <h3>Tags</h3>
              <div className="tag-list">
                {skill.manifest.tags.map((tag: string) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="modal-actions">
          <Button
            variant={skill.state === 'enabled' ? 'secondary' : 'primary'}
            onClick={() => onAction(skill.skillId, skill.state === 'enabled' ? 'disable' : 'enable')}
          >
            {skill.state === 'enabled' ? t.disable : t.enable}
          </Button>
          <Button onClick={() => onAction(skill.skillId, 'test')}>
            Test Skill
          </Button>
          <Button variant="secondary" onClick={() => onAction(skill.skillId, 'edit')}>
            Edit
          </Button>
          <Button variant="danger" onClick={() => onAction(skill.skillId, 'delete')}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SkillManagementUI({ t }: { t: T }) {
  const [skills, setSkills] = useState<Dict[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [detailSkill, setDetailSkill] = useState<Dict | null>(null);
  const [filter, setFilter] = useState<SkillFilter>({
    search: '',
    category: 'all',
    state: 'all',
    sort: 'name',
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/v1/skills');
      setSkills(items(result));
    } catch (err) {
      setError(receiptError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(skillId: string, action: string) {
    try {
      setError('');
      switch (action) {
        case 'enable':
          await api(`/api/v1/skills/${encodeURIComponent(skillId)}/enable`, json({}, 'POST'));
          break;
        case 'disable':
          await api(`/api/v1/skills/${encodeURIComponent(skillId)}/disable`, json({}, 'POST'));
          break;
        case 'delete':
          if (confirm(`Delete skill ${skillId}?`)) {
            await api(`/api/v1/skills/${encodeURIComponent(skillId)}`, json({}, 'DELETE'));
          }
          break;
        case 'test':
          // Open test dialog
          alert('Test dialog not yet implemented');
          return;
        case 'edit':
          alert('Edit dialog not yet implemented');
          return;
      }
      await loadSkills();
    } catch (err) {
      setError(receiptError(err));
    }
  }

  const filteredSkills = skills.filter((skill) => {
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const matchesSearch =
        skill.skillId.toLowerCase().includes(search) ||
        skill.manifest?.name?.en?.toLowerCase().includes(search) ||
        skill.manifest?.name?.zh?.toLowerCase().includes(search) ||
        skill.manifest?.description?.en?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    if (filter.category !== 'all' && skill.manifest?.category !== filter.category) {
      return false;
    }

    if (filter.state !== 'all' && skill.state !== filter.state) {
      return false;
    }

    return true;
  });

  const sortedSkills = [...filteredSkills].sort((a, b) => {
    switch (filter.sort) {
      case 'name':
        return (a.manifest?.name?.en || a.skillId).localeCompare(b.manifest?.name?.en || b.skillId);
      case 'recent':
        return (b.stats?.lastInvocation || '').localeCompare(a.stats?.lastInvocation || '');
      case 'usage':
        return (b.stats?.invocationCount || 0) - (a.stats?.invocationCount || 0);
      default:
        return 0;
    }
  });

  return (
    <div className="skill-management">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="search"
            placeholder={t.search}
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="search-input"
          />
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          >
            <option value="all">All Categories</option>
            <option value="productivity">Productivity</option>
            <option value="automation">Automation</option>
            <option value="data">Data</option>
            <option value="communication">Communication</option>
            <option value="creative">Creative</option>
            <option value="system">System</option>
          </select>
          <select
            value={filter.state}
            onChange={(e) => setFilter({ ...filter, state: e.target.value })}
          >
            <option value="all">All States</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            value={filter.sort}
            onChange={(e) => setFilter({ ...filter, sort: e.target.value })}
          >
            <option value="name">Sort by Name</option>
            <option value="recent">Recently Used</option>
            <option value="usage">Most Used</option>
          </select>
        </div>
        <div className="toolbar-right">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="small"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button onClick={loadSkills}>{t.refresh}</Button>
          <Button variant="primary" onClick={() => alert('Create skill not yet implemented')}>
            New Skill
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {/* Skills Display */}
      {loading ? (
        <p>{t.loading}</p>
      ) : sortedSkills.length === 0 ? (
        <Empty>No skills found</Empty>
      ) : (
        <div className={`skills-${viewMode}`}>
          {sortedSkills.map((skill) => (
            <SkillCard
              key={skill.skillId}
              skill={skill}
              selected={selectedSkillId === skill.skillId}
              onSelect={(id: string) => {
                setSelectedSkillId(id);
                setDetailSkill(skill);
              }}
              onAction={handleAction}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {detailSkill && (
        <SkillDetailPanel
          skill={detailSkill}
          t={t}
          onAction={handleAction}
          onClose={() => {
            setDetailSkill(null);
            setSelectedSkillId(null);
          }}
        />
      )}
    </div>
  );
}
