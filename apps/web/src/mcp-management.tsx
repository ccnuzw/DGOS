/**
 * MCP Server Management UI
 * Complete interface for managing MCP servers, tools, and configurations
 */

import { useState, useEffect } from 'react';
import { Alert, Button, Empty, Panel, Status, Tabs } from '@dgos/dgos-ui';
import { EnhancedMcpList } from './mcp-enhanced-list';
import { ManualMcpConfig } from './mcp-manual-config';
import { MCPServerDetails } from './mcp-server-details';
import { MCPPresetSelector } from './mcp-preset-selector';
import { MCPToolInvoker } from './mcp-tool-invoker';
import { MCPMarketplace } from './mcp-marketplace';
import { api, receiptError } from './api';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

export function MCPManagementApp({ t, lang }: { t: T; lang: string }) {
  const [activeTab, setActiveTab] = useState<
    'servers' | 'add' | 'presets' | 'tools' | 'marketplace'
  >('servers');
  const [selectedServer, setSelectedServer] = useState<Dict | null>(null);
  const [selectedForConfig, setSelectedForConfig] = useState<Dict | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleServerInstalled = () => {
    handleRefresh();
    setActiveTab('servers');
  };

  const handleSelectForTools = (server: Dict) => {
    setSelectedServer(server);
    setActiveTab('tools');
  };

  const handleSelectForConfig = (server: Dict) => {
    setSelectedForConfig(server);
    setActiveTab('add');
  };

  return (
    <div className="mcp-management-app">
      <header className="app-header">
        <h1>{t.mcpManagement || 'MCP Server Management'}</h1>
        <p className="app-description">
          {t.mcpManagementDescription ||
            'Manage Model Context Protocol servers, discover tools, and integrate external capabilities'}
        </p>
      </header>

      <Tabs
        active={activeTab}
        onChange={(value) => setActiveTab(value as any)}
        tabs={[
          {
            id: 'servers',
            label: t.servers || 'Servers',
          },
          {
            id: 'add',
            label: t.addServer || 'Add Server',
          },
          {
            id: 'presets',
            label: t.presets || 'Presets',
          },
          {
            id: 'tools',
            label: t.tools || 'Tools',
          },
          {
            id: 'marketplace',
            label: t.marketplace || 'Marketplace',
          },
        ]}
      />

      <div className="tab-content">
        {activeTab === 'servers' && (
          <>
            <EnhancedMcpList
              t={t}
              onSelectForConfig={handleSelectForConfig}
              onSelectForTools={handleSelectForTools}
              key={refreshTrigger}
            />
            {selectedServer && (
              <MCPServerDetails
                t={t}
                server={selectedServer}
                onClose={() => setSelectedServer(null)}
                onRefresh={handleRefresh}
              />
            )}
          </>
        )}

        {activeTab === 'add' && (
          <div className="add-server-section">
            <ManualMcpConfig t={t} onInstalled={handleServerInstalled} />
          </div>
        )}

        {activeTab === 'presets' && (
          <MCPPresetSelector
            t={t}
            lang={lang}
            onPresetSelected={(preset) => {
              handleServerInstalled();
            }}
          />
        )}

        {activeTab === 'tools' && (
          <MCPToolInvoker
            t={t}
            selectedServer={selectedServer}
            onServerChange={setSelectedServer}
          />
        )}

        {activeTab === 'marketplace' && <MCPMarketplace t={t} lang={lang} />}
      </div>
    </div>
  );
}
