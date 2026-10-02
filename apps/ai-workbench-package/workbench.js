const pending = new Map();
const words = {
  en: { title: 'AI Workbench', model: 'Model', prompt: 'Prompt', run: 'Run task', retrySubmit: 'Retry submission', task: 'Task', taskId: 'Task ID', resume: 'Resume', cancel: 'Cancel', refresh: 'Refresh', connecting: 'Connecting', ready: 'Ready', choose: 'Choose a model', noModels: 'No enabled text models', selectModel: 'Select a model', unavailable: 'Model is unavailable', submitting: 'Submitting…', uncertain: 'Submission outcome unknown. Retry the same request.', noTask: 'No task yet.', invalidTask: 'Enter a task ID', temperature: 'Temperature', maxOutputTokens: 'Max output tokens', artifact: 'Open artifact', invalidParameter: 'Check the model parameters', tooLong: 'Prompt exceeds the model limit' },
  zh: { title: 'AI 工作台', model: '模型', prompt: '提示词', run: '运行任务', retrySubmit: '重试提交', task: '任务', taskId: '任务 ID', resume: '恢复任务', cancel: '取消', refresh: '刷新', connecting: '连接中', ready: '已连接', choose: '选择模型', noModels: '没有可用的文本模型', selectModel: '请选择模型', unavailable: '模型不可用', submitting: '提交中…', uncertain: '提交结果未知。使用同一请求重试。', noTask: '暂无任务', invalidTask: '请输入任务 ID', temperature: '温度', maxOutputTokens: '最大输出 Token', artifact: '打开产物', invalidParameter: '请检查模型参数', tooLong: '提示词超过模型限制' },
};
const elements = Object.fromEntries(['status', 'result', 'model', 'task', 'prompt', 'parameters', 'submit', 'retry-submit', 'cancel', 'refresh', 'artifacts', 'task-id', 'resume'].map((id) => [id, document.getElementById(id)]));
const terminalStates = new Set(['succeeded', 'failed', 'cancelled', 'timed_out']);
const supportedParameters = new Set(['temperature', 'maxOutputTokens']);
let instanceId;
let parentOrigin;
let activeTaskId;
let taskCursor = 0;
let taskText = '';
let taskTerminal = false;
let pollTimer;
let contextTimer;
let contextCursor = '0';
let currentLocale = 'en';
let regionFormat = 'en-US';
let assistantLanguage = 'en-US';
let modelEntries = [];
let descriptor;
let submission;
let taskBusy = false;
let contextBusy = false;
let contextRevoked = false;
let visible = true;
const t = (key) => words[currentLocale][key] ?? key;
const message = (error) => error?.message ?? String(error);
const putStatus = (text) => { elements.status.textContent = text; };
const showError = (error) => putStatus(message(error));

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
  const incoming = event.data;
  if (incoming.type === 'dgos.host.hello' && !instanceId && typeof incoming.instanceId === 'string' && incoming.bridgeVersion === 1) {
    instanceId = incoming.instanceId; parentOrigin = event.origin;
    putStatus(t('ready'));
    window.parent.postMessage({ type: 'dgos.app.ready', instanceId, bridgeVersion: 1 }, parentOrigin);
    loadModels().catch(showError);
    loadContext().catch(handleContextError);
    return;
  }
  if (event.origin !== parentOrigin || incoming.type !== 'dgos.host.result' || incoming.instanceId !== instanceId) return;
  const entry = pending.get(incoming.requestId);
  if (!entry) return;
  pending.delete(incoming.requestId);
  clearTimeout(entry.timeout);
  if (incoming.error) entry.reject(new Error(incoming.error.message ?? incoming.error.errorKey ?? String(incoming.error)));
  else entry.resolve(incoming.result);
});

function invoke(capability, input, requestId = crypto.randomUUID()) {
  if (!instanceId || !visible) return Promise.reject(new Error('Host connection unavailable'));
  if (pending.has(requestId)) return Promise.reject(new Error('Request already pending'));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error('Bridge request timed out')); }, 10000);
    pending.set(requestId, { resolve, reject, timeout });
    window.parent.postMessage({ type: 'dgos.app.invoke', instanceId, requestId, capability, input }, parentOrigin);
  });
}
function applyLanguage() {
  document.documentElement.lang = currentLocale === 'zh' ? 'zh-CN' : 'en';
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  putStatus(instanceId ? t('ready') : t('connecting'));
  if (!activeTaskId && !submission) elements.result.textContent = t('noTask');
  if (!elements.model.value) elements.model.options[0].textContent = modelEntries.length ? t('choose') : t('noModels');
  for (const node of elements.parameters.querySelectorAll('[data-parameter]')) node.querySelector('span').textContent = t(node.dataset.parameter);
}
function applyContext(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const version = String(snapshot.contextVersion ?? '');
  if (!/^(0|[1-9]\d*)$/.test(version) || BigInt(version) < BigInt(contextCursor)) return;
  contextCursor = version;
  const locale = snapshot.locale ?? {};
  const appearance = snapshot.appearance ?? {};
  currentLocale = String(locale.effectiveLocale ?? locale.uiLocale ?? 'en-US').startsWith('zh') ? 'zh' : 'en';
  regionFormat = typeof locale.regionFormat === 'string' ? locale.regionFormat : 'en-US';
  assistantLanguage = typeof locale.assistantLanguage === 'string' ? locale.assistantLanguage : 'en-US';
  document.documentElement.dataset.theme = appearance.appearanceMode === 'dark' ? 'dark' : appearance.appearanceMode === 'light' ? 'light' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.region = regionFormat;
  document.documentElement.dataset.assistantLanguage = assistantLanguage;
  applyLanguage();
}
async function loadContext() {
  if (!visible || !instanceId || contextBusy || contextRevoked) return;
  contextBusy = true;
  try {
    const snapshot = await invoke('dgos.system.context.read', {});
    applyContext(snapshot);
    scheduleContext();
  } finally { contextBusy = false; }
}
function scheduleContext() {
  clearTimeout(contextTimer);
  if (visible && instanceId && !contextRevoked) contextTimer = setTimeout(() => pollContext().catch((error) => { handleContextError(error); scheduleContext(); }), 2000);
}
function handleContextError(error) {
  contextRevoked = true;
  showError(error);
}
async function pollContext() {
  if (!visible || contextBusy) return;
  contextBusy = true;
  try {
    const batch = await invoke('dgos.system.context.events', { cursor: contextCursor });
    if (batch?.reset) {
      contextCursor = '0';
      applyContext(await invoke('dgos.system.context.read', {}));
    } else {
      for (const item of batch?.items ?? []) applyContext(item);
      if (typeof batch?.cursor === 'string' && /^(0|[1-9]\d*)$/.test(batch.cursor) && BigInt(batch.cursor) > BigInt(contextCursor)) contextCursor = batch.cursor;
    }
  } catch (error) { handleContextError(error); }
  finally { contextBusy = false; scheduleContext(); }
}

async function loadModels() {
  const catalog = await invoke('dgos.model.list', {});
  modelEntries = (catalog.items ?? []).filter((item) => item.intent === 'text.chat' && item.providerConfigId && item.modelId);
  elements.model.replaceChildren(new Option(modelEntries.length ? t('choose') : t('noModels'), ''));
  for (const [index, item] of modelEntries.entries()) elements.model.add(new Option(item.displayName ?? item.modelId, String(index)));
  elements.model.disabled = !modelEntries.length;
}
function renderParameters(resolved) {
  elements.parameters.replaceChildren();
  const names = resolved?.uiSchemas?.parameters;
  if (!Array.isArray(names)) { elements.parameters.hidden = true; return; }
  for (const name of names) {
    if (!supportedParameters.has(name)) continue;
    const limit = resolved.limits?.[name];
    const value = resolved.defaults?.[name];
    const label = document.createElement('label'); label.dataset.parameter = name;
    const title = document.createElement('span'); title.textContent = t(name);
    const input = document.createElement('input'); input.name = name; input.type = 'number'; input.inputMode = 'decimal';
    input.min = name === 'temperature' ? '0' : '1';
    input.max = String(name === 'temperature' ? Math.min(2, Number.isFinite(limit) ? limit : 2) : Number.isSafeInteger(limit) && limit > 0 ? limit : Number.MAX_SAFE_INTEGER);
    input.step = name === 'temperature' ? '0.1' : '1';
    if (value !== undefined) input.value = String(value);
    const hint = document.createElement('small');
    hint.textContent = `${input.min}–${input.max}${value !== undefined ? ` · ${value}` : ''}`;
    label.append(title, input, hint);
    elements.parameters.append(label);
  }
  elements.parameters.hidden = !elements.parameters.childElementCount;
}
async function resolveSelection() {
  const selected = modelEntries[Number(elements.model.value)];
  if (!selected) throw new Error(t('selectModel'));
  const resolved = await invoke('dgos.model.resolve', { providerConfigId: selected.providerConfigId, modelId: selected.modelId, intent: 'text.chat' });
  if (resolved?.providerConfigId !== selected.providerConfigId || resolved?.modelId !== selected.modelId || resolved?.intent !== 'text.chat') throw new Error(t('unavailable'));
  descriptor = resolved;
  renderParameters(resolved);
}
function parametersForSubmit() {
  const parameters = {};
  for (const input of elements.parameters.querySelectorAll('input[name]')) {
    if (!input.value) continue;
    const value = Number(input.value);
    const min = Number(input.min); const max = Number(input.max);
    if (!Number.isFinite(value) || value < min || value > max || input.name === 'maxOutputTokens' && !Number.isSafeInteger(value)) throw new Error(t('invalidParameter'));
    parameters[input.name] = value;
  }
  return parameters;
}
function promptForSubmit() {
  const text = elements.prompt.value;
  const max = descriptor?.limits?.maxInputCharacters;
  if (Number.isSafeInteger(max) && [...text].length > max) throw new Error(t('tooLong'));
  if (!text.trim() || !elements.prompt.checkValidity()) throw new Error(t('prompt'));
  return text;
}
function setTask(taskId) {
  activeTaskId = taskId;
  elements['task-id'].value = taskId ?? '';
  taskCursor = 0; taskText = ''; taskTerminal = false;
  elements.refresh.disabled = !taskId; elements.cancel.disabled = !taskId;
  elements.artifacts.replaceChildren();
}
function renderArtifacts(ids) {
  elements.artifacts.replaceChildren();
  for (const artifactId of ids ?? []) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `${t('artifact')} ${artifactId}`;
    button.addEventListener('click', async () => {
      try {
        const artifact = await invoke('dgos.artifact.read', { artifactId });
        const output = document.createElement('pre'); output.textContent = artifact.content ?? '';
        elements.artifacts.append(output);
      } catch (error) { showError(error); }
    });
    elements.artifacts.append(button);
  }
}
function scheduleTask() {
  clearTimeout(pollTimer);
  if (visible && activeTaskId && !taskTerminal) pollTimer = setTimeout(() => refreshTask().catch((error) => { showError(error); scheduleTask(); }), 1000);
}
async function refreshTask() {
  if (!activeTaskId || !visible || taskBusy) return;
  taskBusy = true;
  const id = activeTaskId;
  try {
    const batch = await invoke('dgos.aiTask.events', { taskId: id, cursor: taskCursor });
    if (id !== activeTaskId) return;
    let cursorReset = Boolean(batch?.reset);
    if (cursorReset) { taskCursor = 0; taskText = ''; taskTerminal = false; }
    let ordered = [...(batch?.items ?? [])].sort((a, b) => Number(a.sequence) - Number(b.sequence));
    if (!cursorReset && taskCursor !== 0 && ordered.some((event) => Number(event.sequence) > taskCursor + 1)) {
      taskCursor = 0;
      taskText = '';
      taskTerminal = false;
      const replay = await invoke('dgos.aiTask.events', { taskId: id, cursor: 0 });
      if (id !== activeTaskId) return;
      ordered = [...(replay?.items ?? [])].sort((a, b) => Number(a.sequence) - Number(b.sequence));
    }
    for (const event of ordered) {
      const sequence = Number(event.sequence);
      if (!Number.isSafeInteger(sequence) || sequence <= taskCursor) continue;
      if (sequence > taskCursor + 1 && taskCursor !== 0) continue;
      taskCursor = sequence;
      if (event.type === 'text.delta' && typeof event.delta === 'string' && !taskTerminal) {
        taskText += event.delta;
        elements.result.textContent = taskText;
      }
      if (event.type === 'task.completed' || event.type === 'task.failed' || event.type === 'task.cancelled') taskTerminal = true;
    }
    const task = await invoke('dgos.aiTask.get', { taskId: id });
    if (id !== activeTaskId) return;
    putStatus(task.status ?? t('task'));
    if (terminalStates.has(task.status)) taskTerminal = true;
    if (typeof task.text === 'string' && (taskTerminal || task.text.length > taskText.length)) { taskText = task.text; elements.result.textContent = taskText; }
    else if (!taskText) elements.result.textContent = task.error?.message ?? task.error?.errorKey ?? `Task ${id}`;
    elements.cancel.disabled = taskTerminal || task.status === 'cancel_requested';
    renderArtifacts(task.artifactIds);
    if (taskTerminal) { clearTimeout(pollTimer); pollTimer = undefined; }
    else scheduleTask();
  } finally { taskBusy = false; }
}
async function submitIntent() {
  if (!descriptor) await resolveSelection();
  const input = { target: 'text', intent: 'text.chat', input: { text: promptForSubmit() }, options: { providerConfigId: descriptor.providerConfigId, modelId: descriptor.modelId } };
  const parameters = parametersForSubmit();
  if (Object.keys(parameters).length) input.options.parameters = parameters;
  submission = { requestId: crypto.randomUUID(), input };
  await sendSubmission();
}
async function sendSubmission() {
  if (!submission) return;
  elements.submit.disabled = true; elements['retry-submit'].disabled = true;
  elements.result.textContent = t('submitting');
  let receipt;
  try {
    receipt = await invoke('dgos.aiTask.submit', submission.input, submission.requestId);
    if (!receipt?.taskId) throw new Error(t('uncertain'));
  } catch (error) {
    elements['retry-submit'].hidden = false;
    elements.result.textContent = t('uncertain');
    showError(error);
    elements.submit.disabled = true; elements['retry-submit'].disabled = false;
    return;
  }
  setTask(receipt.taskId);
  submission = undefined;
  elements['retry-submit'].hidden = true;
  elements.submit.disabled = false; elements['retry-submit'].disabled = false;
  try { await refreshTask(); } catch (error) { showError(error); scheduleTask(); }
}
elements.model.addEventListener('change', () => { descriptor = undefined; renderParameters(); if (elements.model.value) resolveSelection().catch(showError); });
function startSubmission() {
  if (submission) return;
  if (!elements.task.reportValidity()) return;
  submitIntent().catch((error) => { showError(error); elements.result.textContent = message(error); elements.submit.disabled = false; });
}
elements.submit.addEventListener('click', startSubmission);
elements.task.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target !== elements['task-id']) {
    event.preventDefault(); startSubmission();
  }
});
elements['retry-submit'].addEventListener('click', () => sendSubmission().catch(showError));
elements.refresh.addEventListener('click', () => refreshTask().catch(showError));
elements.cancel.addEventListener('click', async () => {
  if (!activeTaskId) return;
  try { await invoke('dgos.aiTask.cancel', { taskId: activeTaskId }); await refreshTask(); }
  catch (error) { showError(error); }
});
elements.resume.addEventListener('click', async () => {
  const id = elements['task-id'].value.trim();
  if (!id) { putStatus(t('invalidTask')); return; }
  const previous = activeTaskId;
  setTask(id);
  try { await refreshTask(); }
  catch (error) { setTask(previous); showError(error); }
});
document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  if (!visible) { clearTimeout(pollTimer); clearTimeout(contextTimer); }
  else { if (activeTaskId) scheduleTask(); if (instanceId && !contextRevoked) loadContext().catch(handleContextError); }
});
window.addEventListener('pagehide', () => {
  visible = false; clearTimeout(pollTimer); clearTimeout(contextTimer);
  for (const entry of pending.values()) { clearTimeout(entry.timeout); entry.reject(new Error('Window closed')); }
  pending.clear();
});
