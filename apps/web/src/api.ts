export class ApiError extends Error {
  constructor(message:string, public status:number, public requestId?:string, public errorKey?:string){super(message)}
}
export async function api<T=any>(path:string, options:RequestInit={}):Promise<T>{
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
