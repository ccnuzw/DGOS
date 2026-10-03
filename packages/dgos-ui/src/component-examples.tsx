// DGOS UI Components - Comprehensive Examples
// This file demonstrates all 7 new components with realistic usage

import React, { useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  Tree,
  type TreeNode,
  SplitPane,
  EnhancedTabs,
  TabPanel,
  type Tab,
  EnhancedBreadcrumbs,
  type BreadcrumbItem,
  EmptyState,
  ErrorState,
} from './index';

// ============================================
// DataTable Example
// ============================================

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastSeen: string;
}

export function DataTableExample() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set());

  const columns: DataTableColumn<User>[] = [
    {
      id: 'name',
      label: 'Name',
      accessor: (row) => row.name,
      sortable: true,
      filterable: true,
    },
    {
      id: 'email',
      label: 'Email',
      accessor: (row) => row.email,
      sortable: true,
      filterable: true,
    },
    {
      id: 'role',
      label: 'Role',
      accessor: (row) => row.role,
      sortable: true,
      filterable: true,
      width: 120,
    },
    {
      id: 'status',
      label: 'Status',
      accessor: (row) => row.status,
      render: (value) => (
        <span className={`dgos-badge ${value === 'active' ? 'success' : 'default'}`}>
          {value}
        </span>
      ),
      width: 100,
    },
    {
      id: 'lastSeen',
      label: 'Last Seen',
      accessor: (row) => row.lastSeen,
      sortable: true,
      numeric: true,
      align: 'right',
      width: 150,
    },
  ];

  const data: User[] = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'active', lastSeen: '2024-01-15' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'User', status: 'active', lastSeen: '2024-01-14' },
    { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'Editor', status: 'inactive', lastSeen: '2024-01-10' },
    { id: 4, name: 'David Brown', email: 'david@example.com', role: 'User', status: 'active', lastSeen: '2024-01-15' },
    { id: 5, name: 'Eve Davis', email: 'eve@example.com', role: 'Admin', status: 'active', lastSeen: '2024-01-13' },
  ];

  return (
    <div>
      <h2>DataTable Component</h2>
      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row.id}
        selectable
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        height="400px"
        rowHeight={44}
      />
      <p>Selected: {selectedKeys.size} rows</p>
    </div>
  );
}

// ============================================
// Tree Example
// ============================================

export function TreeExample() {
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const treeData: TreeNode[] = [
    {
      id: 'root',
      label: 'Project Root',
      isFolder: true,
      children: [
        {
          id: 'src',
          label: 'src',
          isFolder: true,
          children: [
            { id: 'index.ts', label: 'index.ts' },
            { id: 'app.tsx', label: 'app.tsx' },
            {
              id: 'components',
              label: 'components',
              isFolder: true,
              children: [
                { id: 'button.tsx', label: 'Button.tsx' },
                { id: 'input.tsx', label: 'Input.tsx' },
              ],
            },
          ],
        },
        {
          id: 'public',
          label: 'public',
          isFolder: true,
          children: [
            { id: 'index.html', label: 'index.html' },
            { id: 'favicon.ico', label: 'favicon.ico' },
          ],
        },
        { id: 'package.json', label: 'package.json' },
        { id: 'tsconfig.json', label: 'tsconfig.json' },
      ],
    },
  ];

  return (
    <div>
      <h2>Tree Component</h2>
      <Tree
        data={treeData}
        selectedId={selectedId}
        onSelect={(node) => setSelectedId(node.id)}
        defaultExpandedIds={['root', 'src']}
        showIcons
      />
      <p>Selected: {selectedId || 'None'}</p>
    </div>
  );
}

// ============================================
// SplitPane Example
// ============================================

export function SplitPaneExample() {
  return (
    <div style={{ height: '400px' }}>
      <h2>SplitPane Component</h2>
      <SplitPane
        direction="horizontal"
        initialSize="30%"
        minSize={150}
        storageKey="example-split"
      >
        <div style={{ padding: '16px', background: 'var(--surface)' }}>
          <h3>Sidebar</h3>
          <p>This pane is resizable. Drag the handle to adjust.</p>
        </div>
        <div style={{ padding: '16px', background: 'var(--canvas)' }}>
          <h3>Main Content</h3>
          <p>The split position is saved to localStorage.</p>
          <p>Use arrow keys when the handle is focused.</p>
        </div>
      </SplitPane>
    </div>
  );
}

// ============================================
// EnhancedTabs Example
// ============================================

export function EnhancedTabsExample() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'users', label: 'Users', icon: '👥', badge: 12 },
    { id: 'logs', label: 'Logs', icon: '📝' },
    { id: 'disabled', label: 'Disabled', icon: '🚫', disabled: true },
  ];

  return (
    <div>
      <h2>Enhanced Tabs Component</h2>
      <EnhancedTabs
        tabs={tabs}
        activeId={activeTab}
        onChange={setActiveTab}
        size="md"
      />

      <TabPanel tabId="overview" activeId={activeTab}>
        <h3>Overview</h3>
        <p>Dashboard overview content goes here.</p>
      </TabPanel>

      <TabPanel tabId="settings" activeId={activeTab}>
        <h3>Settings</h3>
        <p>Settings panel content goes here.</p>
      </TabPanel>

      <TabPanel tabId="users" activeId={activeTab}>
        <h3>Users (12)</h3>
        <p>User management content goes here.</p>
      </TabPanel>

      <TabPanel tabId="logs" activeId={activeTab}>
        <h3>Logs</h3>
        <p>System logs content goes here.</p>
      </TabPanel>
    </div>
  );
}

// ============================================
// EnhancedBreadcrumbs Example
// ============================================

export function EnhancedBreadcrumbsExample() {
  const shortPath: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects' },
    { label: 'DGOS' },
  ];

  const longPath: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects' },
    { label: 'DGOS', href: '/projects/dgos' },
    { label: 'Packages', href: '/projects/dgos/packages' },
    { label: 'UI', href: '/projects/dgos/packages/ui' },
    { label: 'Components', href: '/projects/dgos/packages/ui/components' },
    { label: 'DataTable.tsx' },
  ];

  return (
    <div>
      <h2>Enhanced Breadcrumbs Component</h2>

      <h3>Short Path</h3>
      <EnhancedBreadcrumbs items={shortPath} />

      <h3>Long Path (with overflow)</h3>
      <EnhancedBreadcrumbs items={longPath} maxItems={4} />
    </div>
  );
}

// ============================================
// EmptyState Example
// ============================================

export function EmptyStateExample() {
  return (
    <div>
      <h2>EmptyState Component</h2>

      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
        <EmptyState
          icon="📭"
          title="No messages"
          description="You don't have any messages yet. Start a conversation to see them here."
          action={{
            label: 'New Message',
            onClick: () => alert('Create new message'),
          }}
          size="md"
        />
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '8px' }}>
        <EmptyState
          icon="🔍"
          title="No results found"
          description="Try adjusting your search or filters."
          action={{
            label: 'Clear Filters',
            onClick: () => alert('Clear filters'),
          }}
          secondaryAction={{
            label: 'View All',
            onClick: () => alert('View all'),
          }}
          size="sm"
        />
      </div>
    </div>
  );
}

// ============================================
// ErrorState Example
// ============================================

export function ErrorStateExample() {
  return (
    <div>
      <h2>ErrorState Component</h2>

      <ErrorState
        severity="warning"
        title="Connection is slow"
        description="The server is responding slowly. Your request may take longer than usual."
        onDismiss={() => alert('Dismissed')}
      />

      <ErrorState
        severity="error"
        title="Failed to load data"
        description="We couldn't retrieve the requested data. Please try again."
        requestId="req_abc123xyz"
        code="FETCH_ERROR"
        onRetry={() => alert('Retrying...')}
        actions={[
          {
            label: 'View Details',
            onClick: () => alert('View details'),
            variant: 'default',
          },
        ]}
      />

      <ErrorState
        severity="critical"
        title="Service Unavailable"
        description="The service is temporarily unavailable. Our team has been notified and is working on a fix."
        requestId="req_critical_789"
        code="SERVICE_DOWN"
        actions={[
          {
            label: 'Check Status',
            onClick: () => alert('Check status'),
            variant: 'primary',
          },
          {
            label: 'Contact Support',
            onClick: () => alert('Contact support'),
            variant: 'default',
          },
        ]}
      />
    </div>
  );
}

// ============================================
// All Examples Combined
// ============================================

export function AllComponentExamples() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>DGOS UI Component Library - New Components</h1>

      <section style={{ marginBottom: '48px' }}>
        <DataTableExample />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <TreeExample />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <SplitPaneExample />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <EnhancedTabsExample />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <EnhancedBreadcrumbsExample />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <EmptyStateExample />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <ErrorStateExample />
      </section>
    </div>
  );
}
