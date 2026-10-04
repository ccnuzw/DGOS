export class ApiError extends Error {
  constructor(message:string, public status:number, public requestId?:string, public errorKey?:string){super(message)}
}
export async function api<T=any>(path:string, options:RequestInit={}):Promise<T>{
  if (mockEnabled() && (!options.method || options.method === 'GET')) {
    const mock = mockResource(path);
    if (mock !== undefined) return mock as T;
  }
  if (mockEnabled() && options.method && options.method !== 'GET' && path.startsWith('/api/v1/')) {
    const mockMutation = mockMutationResult<T>(path, options);
    if (mockMutation !== undefined) return mockMutation;
  }
  let response:Response;
  try{response=await fetch(path,{credentials:'include',...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.method&&options.method!=='GET'?{'x-dgos-csrf':'web'}:{}),...options.headers}})}
  catch{throw new ApiError('Network unavailable. Check the API connection and retry.',0)}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new ApiError(body.message||body.errorKey||`Request failed (${response.status})`,response.status,body.requestId||response.headers.get('x-request-id')||undefined,body.errorKey)}
  return response.status===204?null as T:response.json();
}
export const json=(body:unknown,method='POST'):RequestInit=>({method,body:JSON.stringify(body)});
export const items=(value:any):any[]=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[];
export const message=(error:unknown)=>error instanceof Error?error.message:String(error);
export const receiptError=(error:unknown)=>error instanceof ApiError&&error.requestId?`${error.message} · request ${error.requestId}`:message(error);

type MockTask = { taskId: string; status: string; text: string; prompt: string; events: Array<Record<string, unknown>>; artifactIds?: string[] };
const mockTasks = new Map<string, MockTask>();
const mockEnabled = () => (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_DGOS_MOCK === '1' || new URLSearchParams(window.location.search).has('mock');
const mockProvider = { id: 'mock-provider', providerConfigId: 'mock-provider', displayName: 'Local Mock Provider', name: 'Local Mock Provider', status: 'ready', protocolType: 'openai-compatible', baseUrl: 'https://mock.invalid' };
const mockModels = [{ modelId: 'mock-text-model', displayName: 'Local Text Model', intent: 'text.chat', taskModes: ['text.chat'], capabilities: ['text'], providerConfigId: mockProvider.id }];
const mockActions = [
  { actionId: 'system.navigate.system.settings', actionVersion: '1', appId: 'dgos.system', displayName: 'Open system settings', label: { 'en-US': 'Open system settings' }, quickInput: { target: 'system.settings' }, requiredCapabilities: ['system.navigate'], riskLevel: 'low', sideEffects: 'navigation', state: 'enabled', inputSchema: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] } },
  { actionId: 'system.info.read', actionVersion: '1', appId: 'dgos.system', displayName: 'Check system status', requiredCapabilities: ['system.info.read'], riskLevel: 'read', sideEffects: 'none', state: 'enabled', inputSchema: { type: 'object', properties: {} } },
];
function mockResource(path: string): unknown {
  if (path === '/api/v1/provider/configs') return { items: [mockProvider] };
  if (path === `/api/v1/provider/configs/${mockProvider.id}/models`) return { items: mockModels };
  if (path === `/api/v1/provider/configs/${mockProvider.id}/model-policies`) return { items: [{ modelId: 'mock-text-model', enabled: true, capabilities: ['text'], policyVersion: '1' }] };
  if (path === '/api/v1/actions') return { items: mockActions };
  if (path === '/api/v1/audit/events?limit=10') return { items: [] };
  if (path === '/api/v1/skills') return { items: [{ skillId: 'mock.summarize', state: 'enabled', manifest: { name: { en: 'Summarize text' }, description: { en: 'Local demo Skill' }, version: '1.0.0', category: 'text', triggers: [] } }] };
  if (path === '/api/v1/mcp') return { items: [{ id: 'mock-mcp', displayName: 'Local MCP Demo', state: 'enabled', connectionState: 'connected', credentialStatus: 'configured' }] };
  if (path === '/api/v1/apps') return { items: [] };
  if (path === '/api/v1/system/context') return { contextVersion: 'mock-1', locale: { effectiveLocale: 'en-US', regionFormat: 'en-US', assistantLanguage: 'en-US', projectContentLanguage: 'en-US' } };
  if (path === '/api/v1/identity/admin/session') return { sessionId: 'mock-session', principalId: 'mock-owner' };
  return undefined;
}
function mockMutationResult<T>(path: string, options: RequestInit): T | undefined {
  if (path === '/api/v1/provider/configs' && options.method === 'POST') return { ...mockProvider } as T;
  if (/\/provider\/configs\/[^/]+\/(validate|models)$/.test(path)) return { status: 'ready', items: mockModels } as T;
  if (path.endsWith('/model-policies')) return { modelId: 'mock-text-model', enabled: true, capabilities: ['text'], policyVersion: '2' } as T;
  if (path === '/api/v1/permissions/check') return { decision: 'allow' } as T;
  if (path === '/api/v1/permissions/request') return { decision: 'allow', confirmationRequired: false } as T;
  if (/\/actions\/[^/]+\/plan$/.test(path)) return { planId: `mock-plan-${Date.now()}`, riskLevel: 'low', permission: { decision: 'allow' }, confirmationRequired: false, inputSummary: {} } as T;
  if (/\/actions\/[^/]+\/execute$/.test(path)) return { runId: `mock-run-${Date.now()}`, state: 'succeeded', resultSummary: { message: 'Mock action completed' } } as T;
  if (/\/action-runs\/[^/]+$/.test(path)) return { runId: path.split('/').pop(), state: options.method === 'DELETE' ? 'cancelled' : 'succeeded', resultSummary: { message: 'Mock action completed' } } as T;
  if (path === '/api/v1/actions/resolve') return { candidates: [{ ...mockActions[0], input: { target: 'system.settings' }, permission: 'allow', risk: 'low', executable: false }] } as T;
  if (path.startsWith('/api/v1/skills')) return { items: [] } as T;
  if (path.startsWith('/api/v1/mcp')) return { state: 'enabled', connectionState: 'connected' } as T;
  return undefined;
}
const mockSnapshot = (task: MockTask) => ({ taskId: task.taskId, status: task.status, text: task.text, artifactIds: task.artifactIds });
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function mockSubmit(body: any) {
  const taskId = `mock-task-${Date.now().toString(36)}`;
  const task: MockTask = { taskId, status: 'queued', text: '', prompt: body.input?.text || '', events: [] };
  mockTasks.set(taskId, task);
  void (async () => {
    await mockDelay(180); task.status = 'running';
    const response = `Mock response for: ${task.prompt}`;
    for (const delta of response.match(/.{1,12}/g) || []) {
      await mockDelay(120); task.text += delta;
      task.events.push({ eventId: `${taskId}-${task.events.length + 1}`, taskId, sequence: task.events.length + 1, type: 'text.delta', delta, createdAt: new Date().toISOString() });
    }
    task.status = 'succeeded'; task.artifactIds = [`${taskId}-artifact`];
    task.events.push({ eventId: `${taskId}-${task.events.length + 1}`, taskId, sequence: task.events.length + 1, type: 'task.completed', createdAt: new Date().toISOString() });
  })();
  return { taskId, status: task.status, descriptorVersion: 'mock-v1' };
}
export async function taskApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  if (!mockEnabled()) return api<T>(path, options);
  const match = path.match(/^\/api\/v1\/ai-tasks\/([^/]+)(?:\/events.*)?$/);
  if (path === '/api/v1/ai-tasks' && options.method === 'POST') return mockSubmit(JSON.parse(String(options.body))).then(value => value as T);
  if (!match) return api<T>(path, options);
  const task = mockTasks.get(decodeURIComponent(match[1]));
  if (!task) throw new ApiError('Mock task not found', 404, undefined, 'task_not_found');
  if (path.includes('/events')) {
    const cursor = Number(new URL(path, window.location.origin).searchParams.get('cursor') || 0);
    const frames = task.events.filter(event => Number(event.sequence) > cursor).map(event => `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
    return frames as T;
  }
  if (options.method === 'DELETE') { task.status = 'cancelled'; return mockSnapshot(task) as T; }
  return mockSnapshot(task) as T;
}
