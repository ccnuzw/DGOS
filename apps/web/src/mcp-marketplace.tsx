/**
 * MCP Marketplace Component
 * Browse and discover MCP servers from the community
 */

import { useState, useEffect } from 'react';
import { Alert, Button, Panel, Empty, Badge } from '@dgos/dgos-ui';
import { allLabels } from './i18n';

type T = ReturnType<typeof allLabels>;

interface MCPMarketplaceItem {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  author: string;
  icon: string;
  category: string;
  downloads: number;
  rating: number;
  tags: string[];
  requiresCredentials: boolean;
  source: string;
}

// Mock marketplace data
const marketplaceItems: MCPMarketplaceItem[] = [
  {
    id: 'filesystem',
    name: { en: 'Filesystem', zh: '文件系统' },
    description: { en: 'Access and manage local filesystem', zh: '访问和管理本地文件系统' },
    author: 'Anthropic',
    icon: '📁',
    category: 'system',
    downloads: 15420,
    rating: 4.8,
    tags: ['filesystem', 'files', 'local'],
    requiresCredentials: false,
    source: '@modelcontextprotocol/server-filesystem',
  },
  {
    id: 'github',
    name: { en: 'GitHub', zh: 'GitHub' },
    description: { en: 'GitHub API integration for repository management', zh: 'GitHub API 集成，用于仓库管理' },
    author: 'Anthropic',
    icon: '🐙',
    category: 'api',
    downloads: 12350,
    rating: 4.7,
    tags: ['github', 'git', 'api', 'repositories'],
    requiresCredentials: true,
    source: '@modelcontextprotocol/server-github',
  },
  {
    id: 'postgres',
    name: { en: 'PostgreSQL', zh: 'PostgreSQL' },
    description: { en: 'PostgreSQL database access and queries', zh: 'PostgreSQL 数据库访问和查询' },
    author: 'Anthropic',
    icon: '🐘',
    category: 'database',
    downloads: 8920,
    rating: 4.6,
    tags: ['postgresql', 'database', 'sql'],
    requiresCredentials: true,
    source: '@modelcontextprotocol/server-postgres',
  },
  {
    id: 'brave_search',
    name: { en: 'Brave Search', zh: 'Brave 搜索' },
    description: { en: 'Web search using Brave Search API', zh: '使用 Brave Search API 进行网络搜索' },
    author: 'Anthropic',
    icon: '🔍',
    category: 'api',
    downloads: 7650,
    rating: 4.5,
    tags: ['search', 'web', 'api'],
    requiresCredentials: true,
    source: '@modelcontextprotocol/server-brave-search',
  },
  {
    id: 'slack',
    name: { en: 'Slack', zh: 'Slack' },
    description: { en: 'Slack workspace integration', zh: 'Slack 工作区集成' },
    author: 'Anthropic',
    icon: '💬',
    category: 'api',
    downloads: 6420,
    rating: 4.4,
    tags: ['slack', 'chat', 'communication'],
    requiresCredentials: true,
    source: '@modelcontextprotocol/server-slack',
  },
  {
    id: 'puppeteer',
    name: { en: 'Puppeteer', zh: 'Puppeteer' },
    description: { en: 'Browser automation and web scraping', zh: '浏览器自动化和网页抓取' },
    author: 'Anthropic',
    icon: '🤖',
    category: 'automation',
    downloads: 5890,
    rating: 4.3,
    tags: ['automation', 'browser', 'scraping'],
    requiresCredentials: false,
    source: '@modelcontextprotocol/server-puppeteer',
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

interface MCPMarketplaceProps {
  t: T;
  lang: string;
}

export function MCPMarketplace({ t, lang }: MCPMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  const [selectedItem, setSelectedItem] = useState<MCPMarketplaceItem | null>(null);

  const filteredItems = marketplaceItems
    .filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        item.name.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.zh.includes(searchQuery) ||
        item.description.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.zh.includes(searchQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        case 'recent':
          return 0; // Would use timestamp in real implementation
        default:
          return 0;
      }
    });

  return (
    <div className="mcp-marketplace">
      <Panel>
        <h2>{t.marketplace || 'MCP Marketplace'}</h2>
        <p className="section-note">
          {t.marketplaceDescription || 'Discover and install MCP servers from the community'}
        </p>

        <div className="marketplace-controls">
          <div className="search-box">
            <input
              type="search"
              placeholder={t.searchPlaceholder || 'Search servers, tools, categories...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

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

          <div className="sort-controls">
            <label>
              {t.sortBy || 'Sort by'}:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="popular">{t.popular || 'Popular'}</option>
                <option value="rating">{t.rating || 'Rating'}</option>
                <option value="recent">{t.recent || 'Recent'}</option>
              </select>
            </label>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <Empty>{t.noServersFound || 'No servers found'}</Empty>
        ) : (
          <div className="marketplace-grid">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="marketplace-card"
                onClick={() => setSelectedItem(item)}
              >
                <div className="card-header">
                  <div className="server-icon">{item.icon}</div>
                  <div className="server-info">
                    <h3>{item.name[lang as 'en' | 'zh'] || item.name.en}</h3>
                    <p className="author">by {item.author}</p>
                  </div>
                </div>

                <p className="description">
                  {item.description[lang as 'en' | 'zh'] || item.description.en}
                </p>

                <div className="card-tags">
                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="info">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="card-meta">
                  <span className="rating">
                    ⭐ {item.rating}
                  </span>
                  <span className="downloads">
                    ⬇️ {item.downloads.toLocaleString()}
                  </span>
                  {item.requiresCredentials && (
                    <Badge variant="warning">
                      {t.needsCredentials || 'Needs Credentials'}
                    </Badge>
                  )}
                </div>

                <Button variant="primary">
                  {t.viewDetails || 'View Details'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {selectedItem && (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="modal modal-large"
            role="dialog"
            aria-modal="true"
            aria-label={t.serverDetails || 'Server Details'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="server-header">
                <div className="server-icon-large">{selectedItem.icon}</div>
                <div>
                  <h2>{selectedItem.name[lang as 'en' | 'zh'] || selectedItem.name.en}</h2>
                  <p className="author">by {selectedItem.author}</p>
                  <div className="server-stats">
                    <span className="rating">⭐ {selectedItem.rating}</span>
                    <span className="downloads">⬇️ {selectedItem.downloads.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <Button onClick={() => setSelectedItem(null)}>
                {t.close}
              </Button>
            </div>

            <div className="modal-content">
              <section className="server-description">
                <h3>{t.description || 'Description'}</h3>
                <p>{selectedItem.description[lang as 'en' | 'zh'] || selectedItem.description.en}</p>
              </section>

              <section className="server-metadata">
                <dl className="data-grid">
                  <div>
                    <dt>{t.category || 'Category'}</dt>
                    <dd>
                      <Badge variant="info">{selectedItem.category}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.source || 'Source'}</dt>
                    <dd className="code">{selectedItem.source}</dd>
                  </div>
                  <div>
                    <dt>{t.tags || 'Tags'}</dt>
                    <dd>
                      {selectedItem.tags.map((tag) => (
                        <Badge key={tag} variant="info">
                          {tag}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.requirements || 'Requirements'}</dt>
                    <dd>
                      {selectedItem.requiresCredentials ? (
                        <Badge variant="warning">{t.needsCredentials || 'Needs Credentials'}</Badge>
                      ) : (
                        <Badge variant="success">{t.readyToUse || 'Ready to Use'}</Badge>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <Alert kind="info">
                {t.installInstructions ||
                  'Click Install to add this server to your DGOS instance. You can configure credentials and settings after installation.'}
              </Alert>
            </div>

            <div className="modal-footer">
              <Button variant="primary" onClick={() => alert('Install functionality would go here')}>
                {t.install}
              </Button>
              <Button onClick={() => setSelectedItem(null)}>{t.cancel}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
