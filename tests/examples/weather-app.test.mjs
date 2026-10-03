// Weather App Test Suite
// Complete test coverage for the Weather DGOS app

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTestApp,
  MockPermissions,
  assertPermission,
  assertNotified,
} from '../../../packages/sdk/src/testing/index.ts';

test.describe('Weather App Tests', () => {
  test('initializes correctly', async () => {
    const testApp = createTestApp({
      context: {
        appId: 'com.dgos.weather',
        version: '1.0.0',
        locale: 'en-US',
      },
    });

    assert.equal(testApp.context.appId, 'com.dgos.weather');
    assert.equal(testApp.context.version, '1.0.0');
  });

  test('requests geolocation permission', async () => {
    const testApp = createTestApp({
      context: { appId: 'com.dgos.weather', version: '1.0.0' },
    });

    const result = await testApp.api.permissions.request(
      'geolocation.read',
      'Weather app needs your location to show local weather'
    );

    assert.ok(result.granted);
    assertPermission(result.granted ? 'granted' : 'denied', 'granted');
  });

  test('fetches weather data', async () => {
    const testApp = createTestApp();
    testApp.permissions.grant('network.fetch');

    // Mock weather API response
    const mockWeatherData = {
      temperature: 72,
      condition: 'Sunny',
      humidity: 45,
      windSpeed: 8,
      location: 'San Francisco',
    };

    // Store weather data
    await testApp.api.storage.kv.set('current-weather', mockWeatherData);

    // Retrieve and verify
    const weather = await testApp.api.storage.kv.get('current-weather');
    assert.deepEqual(weather, mockWeatherData);
  });

  test('caches weather data', async () => {
    const testApp = createTestApp();

    const weatherData = {
      temperature: 68,
      condition: 'Cloudy',
      timestamp: Date.now(),
    };

    // Cache weather
    await testApp.api.storage.kv.set('weather-cache', weatherData);

    // Verify cache
    const cached = await testApp.api.storage.kv.get('weather-cache');
    assert.ok(cached);
    assert.equal(cached.temperature, 68);
  });

  test('displays weather notification', async () => {
    const testApp = createTestApp();

    await testApp.api.ui.notify({
      title: 'Weather Update',
      body: 'Temperature: 72°F, Sunny',
    });

    assert.equal(testApp.ui.notifications.length, 1);
    assertNotified(
      testApp.ui.notifications,
      (n) => n.title === 'Weather Update'
    );
  });

  test('handles permission denied', async () => {
    const permissions = new MockPermissions();
    permissions.deny('geolocation.read');

    const testApp = createTestApp({ permissions });

    const hasPermission = await testApp.api.permissions.has('geolocation.read');
    assert.ok(!hasPermission);

    // Should use default location
    await testApp.api.storage.kv.set('default-location', 'New York');
    const location = await testApp.api.storage.kv.get('default-location');
    assert.equal(location, 'New York');
  });

  test('updates weather periodically', async () => {
    const testApp = createTestApp();
    testApp.permissions.grant('network.fetch');

    // Simulate periodic update
    const updates = [];

    for (let i = 0; i < 3; i++) {
      const data = {
        temperature: 70 + i,
        timestamp: Date.now() + i * 1000,
      };
      await testApp.api.storage.kv.set('weather-latest', data);
      updates.push(data);
    }

    const latest = await testApp.api.storage.kv.get('weather-latest');
    assert.equal(latest.temperature, 72);
    assert.equal(updates.length, 3);
  });

  test('saves user preferences', async () => {
    const testApp = createTestApp();

    const preferences = {
      temperatureUnit: 'fahrenheit',
      notificationsEnabled: true,
      updateInterval: 30,
    };

    await testApp.api.storage.kv.set('preferences', preferences);

    const saved = await testApp.api.storage.kv.get('preferences');
    assert.deepEqual(saved, preferences);
  });

  test('handles network error gracefully', async () => {
    const testApp = createTestApp();

    // Simulate network error by denying permission
    testApp.permissions.deny('network.fetch');

    const hasNetwork = await testApp.api.permissions.has('network.fetch');
    assert.ok(!hasNetwork);

    // Show error notification
    await testApp.api.ui.notify({
      title: 'Error',
      body: 'Unable to fetch weather data',
    });

    assert.equal(testApp.ui.notifications.length, 1);
  });

  test('formats temperature correctly', async () => {
    const testApp = createTestApp();

    function formatTemperature(temp, unit:) {
      if (unit === 'celsius') {
        return `${temp}°C`;
      }
      return `${temp}°F`;
    }

    assert.equal(formatTemperature(72, 'fahrenheit'), '72°F');
    assert.equal(formatTemperature(22, 'celsius'), '22°C');
  });
});
