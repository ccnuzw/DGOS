import { defineApp } from '@dgos/sdk/app';

// Define the DGOS application
defineApp({
  async onActivate() {
    console.log('[App] Activated');

    // Show welcome notification
    await this.ui.notify({
      title: 'Welcome!',
      message: 'Your DGOS application is running',
      type: 'success',
      duration: 3000,
    });

    // Initialize UI
    this.initializeUI();

    // Load system information
    await this.loadSystemInfo();
  },

  async onDeactivate() {
    console.log('[App] Deactivated');

    // Cleanup if needed
  },

  async onContextChange(context) {
    console.log('[App] Context changed:', context);

    // Update UI based on context changes
    document.body.className = context.appearance === 'dark' ? 'dark-theme' : 'light-theme';

    await this.ui.toast(`Theme changed to ${context.appearance}`, {
      type: 'info',
      duration: 2000,
    });
  },

  // Custom methods
  initializeUI() {
    // Notification button
    document.getElementById('btn-notify')?.addEventListener('click', async () => {
      await this.ui.notify({
        title: 'Test Notification',
        message: 'This is a test notification from your app!',
        type: 'info',
      });
    });

    // Context button
    document.getElementById('btn-context')?.addEventListener('click', async () => {
      try {
        const context = this.getContext();
        this.showOutput('Context', JSON.stringify(context, null, 2));
      } catch (error) {
        this.showOutput('Error', error.message);
      }
    });

    // Storage button
    document.getElementById('btn-storage')?.addEventListener('click', async () => {
      try {
        // Test key-value storage
        const testKey = 'test-data';
        const testValue = { timestamp: Date.now(), message: 'Hello DGOS!' };

        await this.storage.kv.set(testKey, testValue);
        const retrieved = await this.storage.kv.get(testKey);

        this.showOutput('Storage Test', JSON.stringify(retrieved, null, 2));
      } catch (error) {
        this.showOutput('Error', error.message);
      }
    });
  },

  async loadSystemInfo() {
    try {
      const info = await this.system.getInfo();
      const context = this.getContext();

      const infoHtml = `
        <dl>
          <dt>App ID:</dt>
          <dd>${context.appId}</dd>
          <dt>Version:</dt>
          <dd>${context.version} (build ${context.build})</dd>
          <dt>Environment:</dt>
          <dd>${context.environment}</dd>
          <dt>Locale:</dt>
          <dd>${context.locale}</dd>
          <dt>Appearance:</dt>
          <dd>${context.appearance}</dd>
          <dt>Platform:</dt>
          <dd>${info.platform} (${info.arch})</dd>
          <dt>DGOS Version:</dt>
          <dd>${info.version}</dd>
        </dl>
      `;

      document.getElementById('system-info').innerHTML = infoHtml;
    } catch (error) {
      console.error('Failed to load system info:', error);
      document.getElementById('system-info').innerHTML =
        '<p class="error">Failed to load system information</p>';
    }
  },

  showOutput(title, content) {
    const output = document.getElementById('output');
    if (output) {
      output.innerHTML = `
        <div class="output-block">
          <h3>${title}</h3>
          <pre>${content}</pre>
        </div>
      `;
    }
  },
});
