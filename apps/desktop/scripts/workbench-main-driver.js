(() => {
  if (window !== window.top) return;
  if (window.__DGOS_WORKBENCH_TEST_DRIVER__ && !window.__DGOS_WORKBENCH_TEST_DRIVER_RESTART__) return;
  window.__DGOS_WORKBENCH_TEST_DRIVER__ = true;
  window.__DGOS_WORKBENCH_TEST_DRIVER_RESTART__ = false;
  setTimeout(() => {
    window.__TAURI_INTERNALS__?.invoke('desktop_test_result', { result: { stage: 'driver_injected', readyState: document.readyState } }).catch(() => {});
  }, 1000);
  const stateKey = 'dgos.desktop.candidate.workbench';
  let previous;
  try { previous = JSON.parse(sessionStorage.getItem(stateKey) || 'null'); }
  catch (error) {
    window.__TAURI_INTERNALS__?.invoke('desktop_test_result', { result: { stage: 'failed', error: `driver_state:${String(error?.message ?? error).slice(0, 100)}` } }).catch(() => {});
    return;
  }
  const phase = previous?.taskId ? 'resume' : 'submit';
  const evidence = previous ?? { bridgeCalls: [], deltaCount: 0, taskId: null };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (read, label, timeout = 30000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = read();
      if (value) return value;
      await pause(100);
    }
    throw new Error(`${label}_timeout`);
  };
  let frameReady = false;
  let bridgeReady = false;
  let instanceId;
  const frameDiagnostics = { injectedPaths: [], loads: 0, errors: 0, bridgeReady: false, events: [], hostMessages: [], hostHello: null };
  let resolveResult;
  const result = new Promise((resolve) => { resolveResult = resolve; });
  window.addEventListener('message', (event) => {
    if (event.source !== document.querySelector('iframe[title="dgos.ai-workbench"]')?.contentWindow) return;
    const message = event.data;
    if (message?.type === 'dgos.app.ready') {
      frameDiagnostics.hostMessages.push({ type: message.type, origin: event.origin, instanceId: message.instanceId, bridgeVersion: message.bridgeVersion });
      instanceId = message.instanceId;
    }
    if (message?.type === 'dgos.desktop.test.frame.injected') frameDiagnostics.injectedPaths.push(message.path);
    if (message?.type === 'dgos.desktop.test.workbench.ready') frameReady = true;
    if (message?.type === 'dgos.app.ready') { instanceId = message.instanceId; bridgeReady = true; frameDiagnostics.bridgeReady = true; }
    if (message?.type === 'dgos.app.invoke') {
      evidence.bridgeCalls.push(message.capability);
      if (message.capability === 'dgos.aiTask.submit') {
        evidence.parameters = message.input?.options?.parameters;
        evidence.submittedPrompt = message.input?.input?.text;
      }
    }
    if (message?.type === 'dgos.desktop.test.workbench.result' && message.phase === phase) resolveResult(message);
  });
  const nativeFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (url?.includes('/api/v1/apps/dgos.ai-workbench/bridge') && response.ok) {
      const body = JSON.parse(args[1]?.body ?? '{}');
      if (body.capability === 'dgos.aiTask.events') {
        response.clone().json().then((batch) => {
          evidence.deltaCount += (batch?.items ?? []).filter((item) => item.type === 'text.delta' && typeof item.delta === 'string').length;
        }).catch(() => {});
      }
    }
    return response;
  };
  const start = async () => {
    const report = async (record) => window.__TAURI_INTERNALS__.invoke('desktop_test_result', { result: record });
    try {
      await report({ stage: 'driver_started', phase, route: location.pathname });
      if (location.pathname !== '/catalog') {
        const catalog = await waitFor(() => document.querySelector('nav a[href="/catalog"]'), 'catalog_navigation');
        catalog.click();
        await waitFor(() => location.pathname === '/catalog', 'catalog_route');
      }
      await report({ stage: 'catalog_open', phase, route: location.pathname });
      const row = await waitFor(() => [...document.querySelectorAll('li')].find((item) => item.textContent.includes('dgos.ai-workbench') && item.textContent.includes('1.0.1')), 'signed_workbench_catalog');
      const launch = [...row.querySelectorAll('button')].find((button) => /launch|启动/i.test(button.textContent));
      if (!launch) throw new Error('workbench_launch_control_missing');
      launch.click();
      await report({ stage: 'workbench_launch_clicked', phase, route: location.pathname });
      const frame = await waitFor(() => document.querySelector('iframe[title="dgos.ai-workbench"]'), 'signed_workbench_frame');
       const recordFrame = (type) => {
        const entry = { type, readyState: frame.contentDocument?.readyState ?? null, contentWindow: Boolean(frame.contentWindow),
          src: frame.getAttribute('src')?.split('?')[0] ?? null, connected: frame.isConnected };
        frameDiagnostics.events.push(entry);
        return entry;
       };
       const testInstanceId = `desktop-test-${crypto.randomUUID()}`;
       frameDiagnostics.hostHello = { sent: 0, instanceId: testInstanceId, errors: [], firstSentAt: null, lastSentAt: null };
       const sendHello = () => {
         try {
           if (!frame.contentWindow) throw new Error('content_window_unavailable');
           frame.contentWindow.postMessage({ type: 'dgos.host.hello', instanceId: testInstanceId, bridgeVersion: 1 }, '*');
           frameDiagnostics.hostHello.sent++;
           const sentAt = Date.now();
           frameDiagnostics.hostHello.firstSentAt ??= sentAt;
           frameDiagnostics.hostHello.lastSentAt = sentAt;
         } catch (error) {
           frameDiagnostics.hostHello.errors.push(String(error?.message ?? error).slice(0, 160));
         }
       };
       frame.addEventListener('load', () => { frameDiagnostics.loads++; recordFrame('load'); });
       frame.addEventListener('error', () => { frameDiagnostics.errors++; recordFrame('error'); });
       recordFrame('present');
       await report({ stage: 'workbench_frame_present', phase, src: frame.getAttribute('src')?.split('?')[0] });
       sendHello();
       const helloTimer = setInterval(() => {
         if (bridgeReady) { clearInterval(helloTimer); return; }
         sendHello();
       }, 250);
       await waitFor(() => frameReady && bridgeReady, 'signed_workbench_bridge').catch(async (error) => {
         clearInterval(helloTimer);
        await report({ stage: 'workbench_bridge_diagnostic', phase, frameDiagnostics, frameReady, bridgeReady,
          route: location.pathname, frameSrc: frame.getAttribute('src')?.split('?')[0],
          frameLoadComplete: frame.contentDocument === null, frameConnected: frame.isConnected });
        throw error;
       });
       clearInterval(helloTimer);
      await report({ stage: 'workbench_bridge_ready', phase, route: location.pathname });
       const postTarget = Boolean(frame.contentWindow);
      let postError = null;
      try {
         frame.contentWindow?.postMessage({ type: 'dgos.desktop.test.workbench', phase, taskId: evidence.taskId }, '*');
      } catch (error) { postError = String(error?.message ?? error).slice(0, 160); }
      await report({ stage: 'workbench_command_sent', phase, postTarget, postError, frameDiagnostics });
      const observed = await Promise.race([result, waitFor(() => false, 'workbench_result', 45000)]);
      await report({ stage: 'workbench_dom_result', phase, route: location.pathname, observed });
      if (observed.error) throw new Error(observed.error);
      if (!observed.controlsVisible || !observed.resultMatched || !observed.artifactMatched) throw new Error('workbench_dom_assertion_failed');
      if (phase === 'submit') {
        if (!observed.taskId || evidence.deltaCount < 1 || !evidence.bridgeCalls.includes('dgos.model.resolve')) throw new Error('model_delta_or_task_missing');
        if (evidence.parameters?.temperature !== 0.7 || evidence.parameters?.maxOutputTokens !== 10) throw new Error('model_parameters_missing');
        if (evidence.submittedPrompt !== 'desktop-workbench-fixture') throw new Error('workbench_prompt_missing');
        evidence.taskId = observed.taskId;
        sessionStorage.setItem(stateKey, JSON.stringify(evidence));
        location.reload();
        return;
      }
      if (observed.taskId !== evidence.taskId || !evidence.bridgeCalls.includes('dgos.aiTask.get') || !evidence.bridgeCalls.includes('dgos.artifact.read')) throw new Error('same_task_resume_missing');
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await report({ stage: 'complete', route: location.pathname, workbenchVisible: true, workbenchVersion: '1.0.1', workbenchBuild: 2,
        workbenchStatus: 'succeeded', paintReady: true, taskId: evidence.taskId, selectedParameters: evidence.parameters,
        deltaCount: evidence.deltaCount, bridgeCalls: evidence.bridgeCalls, resumedSameTask: true, artifactMatched: true });
      setTimeout(() => window.__TAURI_INTERNALS__.invoke('desktop_test_window', { action: 'close' }), 12000);
    } catch (error) {
      await report({ stage: 'failed', phase, route: location.pathname, frameReady, bridgeReady, frameDiagnostics,
        error: String(error?.message ?? error).slice(0, 160) });
      setTimeout(() => window.__TAURI_INTERNALS__.invoke('desktop_test_window', { action: 'close' }), 3000);
    }
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start, { once: true });
  else void start();
})();
