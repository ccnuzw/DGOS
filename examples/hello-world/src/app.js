import { defineApp } from '@dgos/sdk/app';

// The simplest DGOS application
defineApp({
  async onActivate() {
    console.log('[Hello World] App activated!');

    // Show a welcome notification
    await this.ui.notify({
      title: 'Hello DGOS!',
      message: 'Your first DGOS application is running.',
      type: 'success',
      duration: 5000,
    });

    // Update the UI
    document.getElementById('message').textContent =
      'Hello DGOS! The app is now running.';
  },

  async onDeactivate() {
    console.log('[Hello World] App deactivated');
  },
});
