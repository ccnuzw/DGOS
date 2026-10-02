(() => {
  if (window === window.top) return;
  const workbenchPath = '/api/v1/apps/dgos.ai-workbench/resources/index.html';
  const isWorkbench = () => location.pathname.endsWith(workbenchPath);
  const instanceId = `desktop-test-${crypto.randomUUID()}`;
  window.parent.postMessage({ type: 'dgos.desktop.test.frame.injected', path: location.pathname }, '*');
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (read, label, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = read();
      if (value) return value;
      await pause(100);
    }
    throw new Error(`${label}_timeout`);
  };
  window.addEventListener('message', async (event) => {
    if (!isWorkbench() || event.source !== window.parent || event.data?.type !== 'dgos.desktop.test.workbench') return;
    const phase = event.data.phase;
    if (!['submit', 'resume'].includes(phase)) return;
    const report = (payload) => window.parent.postMessage({ type: 'dgos.desktop.test.workbench.result', phase, ...payload }, '*');
    try {
      await waitFor(() => document.querySelector('#status')?.textContent?.toLowerCase().includes('ready') || document.querySelector('#status')?.textContent === '已连接', 'bridge_ready');
      let selectedParameters;
      if (phase === 'submit') {
        const model = await waitFor(() => {
          const input = document.querySelector('#model');
          return input?.options.length > 1 ? input : null;
        }, 'model_list');
        model.value = '0';
        model.dispatchEvent(new Event('change', { bubbles: true }));
        const temperature = await waitFor(() => document.querySelector('#parameters input[name="temperature"]'), 'temperature_schema');
        const tokens = await waitFor(() => document.querySelector('#parameters input[name="maxOutputTokens"]'), 'token_schema');
        temperature.value = '0.7';
        tokens.value = '10';
        selectedParameters = { temperature: Number(temperature.value), maxOutputTokens: Number(tokens.value) };
        document.querySelector('#prompt').value = 'desktop-workbench-fixture';
        document.querySelector('#submit').click();
      } else {
        if (typeof event.data.taskId !== 'string' || !event.data.taskId) throw new Error('resume_task_id_missing');
        const input = await waitFor(() => document.querySelector('#task-id'), 'resume_control');
        input.value = event.data.taskId;
        document.querySelector('#resume').click();
      }
      const taskId = await waitFor(() => {
        const id = document.querySelector('#task-id')?.value;
        return id && (phase === 'submit' || id === event.data.taskId) ? id : null;
      }, 'task_id');
      await waitFor(() => document.querySelector('#status')?.textContent === 'succeeded', 'task_succeeded', 30000);
      const result = document.querySelector('#result')?.textContent ?? '';
      if (!result.includes('desktop-workbench-fixture')) throw new Error('task_output_missing');
      const button = await waitFor(() => document.querySelector('#artifacts button'), 'artifact_control');
      button.click();
      const artifact = await waitFor(() => document.querySelector('#artifacts pre')?.textContent?.includes('desktop-workbench-fixture'), 'artifact_content');
      report({ taskId, selectedParameters, resultMatched: true, artifactMatched: Boolean(artifact), controlsVisible: Boolean(document.querySelector('#model') && document.querySelector('#prompt')) });
    } catch (error) { report({ error: String(error?.message ?? error).slice(0, 160) }); }
  });
  const ready = () => {
    if (!isWorkbench()) return;
    window.parent.postMessage({ type: 'dgos.desktop.test.workbench.ready' }, '*');
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
