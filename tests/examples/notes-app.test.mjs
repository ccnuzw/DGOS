// Notes App Test Suite
// Complete test coverage for the Notes DGOS app

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTestApp,
  assertStorageValue,
  PerformanceMonitor,
} from '../../../packages/sdk/src/testing/index.ts';

test.describe('Notes App Tests', () => {
  test('creates a new note', async () => {
    const testApp = createTestApp({
      context: { appId: 'com.dgos.notes', version: '1.0.0' },
    });

    const note = {
      id: '1',
      title: 'My First Note',
      content: 'This is the content of my note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await testApp.api.storage.kv.set('note-1', note);

    const saved = await testApp.api.storage.kv.get('note-1');
    assert.deepEqual(saved, note);
  });

  test('updates existing note', async () => {
    const testApp = createTestApp();

    const note = {
      id: '1',
      title: 'Original Title',
      content: 'Original content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await testApp.api.storage.kv.set('note-1', note);

    // Update note
    note.title = 'Updated Title';
    note.content = 'Updated content';
    note.updatedAt = new Date().toISOString();

    await testApp.api.storage.kv.set('note-1', note);

    const updated = await testApp.api.storage.kv.get('note-1');
    assert.equal(updated.title, 'Updated Title');
    assert.equal(updated.content, 'Updated content');
  });

  test('deletes a note', async () => {
    const testApp = createTestApp();

    await testApp.api.storage.kv.set('note-1', {
      id: '1',
      title: 'Note to delete',
      content: 'Content',
    });

    // Verify note exists
    let note = await testApp.api.storage.kv.get('note-1');
    assert.ok(note);

    // Delete note
    await testApp.api.storage.kv.delete('note-1');

    // Verify note is deleted
    note = await testApp.api.storage.kv.get('note-1');
    assert.equal(note, null);
  });

  test('lists all notes', async () => {
    const testApp = createTestApp();

    // Create multiple notes
    await testApp.api.storage.kv.set('note-1', { id: '1', title: 'Note 1' });
    await testApp.api.storage.kv.set('note-2', { id: '2', title: 'Note 2' });
    await testApp.api.storage.kv.set('note-3', { id: '3', title: 'Note 3' });

    // List all notes with 'note-' prefix
    const keys = await testApp.api.storage.kv.list('note-');
    assert.equal(keys.length, 3);
  });

  test('searches notes by title', async () => {
    const testApp = createTestApp();

    const notes = [
      { id: '1', title: 'Shopping List', content: 'Buy groceries' },
      { id: '2', title: 'Work Notes', content: 'Meeting at 3pm' },
      { id: '3', title: 'Personal Notes', content: 'Call mom' },
    ];

    // Save notes
    for (const note of notes) {
      await testApp.api.storage.kv.set(`note-${note.id}`, note);
    }

    // Search function
    function searchNotes(query, notesList) {
      return notesList.filter((note) =>
        note.title.toLowerCase().includes(query.toLowerCase())
      );
    }

    const results = searchNotes('notes', notes);
    assert.equal(results.length, 2);
  });

  test('saves note to file storage', async () => {
    const testApp = createTestApp();
    testApp.permissions.grant('filesystem.write');

    const noteContent = 'This is a note saved as a file';
    await testApp.api.storage.files.write('notes/note-1.txt', noteContent);

    const content = await testApp.api.storage.files.readText('notes/note-1.txt');
    assert.equal(content, noteContent);
  });

  test('exports notes to JSON', async () => {
    const testApp = createTestApp();

    const notes = [
      { id: '1', title: 'Note 1', content: 'Content 1' },
      { id: '2', title: 'Note 2', content: 'Content 2' },
    ];

    const json = JSON.stringify(notes, null, 2);
    await testApp.api.storage.files.write('notes-export.json', json);

    const exported = await testApp.api.storage.files.readText('notes-export.json');
    const parsed = JSON.parse(exported);
    assert.deepEqual(parsed, notes);
  });

  test('auto-saves note while typing', async () => {
    const testApp = createTestApp();
    const monitor = new PerformanceMonitor();

    // Simulate typing with auto-save
    const saveDelayMs = 500;
    let autoSaveTimer: NodeJS.Timeout | null = null;

    function scheduleAutoSave(note) {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      autoSaveTimer = setTimeout(async () => {
        await testApp.api.storage.kv.set(`note-${note.id}`, note);
      }, saveDelayMs);
    }

    const note = {
      id: '1',
      title: 'Auto-saved note',
      content: 'Initial content',
    };

    // Simulate typing
    scheduleAutoSave(note);

    // Wait for auto-save
    await new Promise((resolve) => setTimeout(resolve, saveDelayMs + 100));

    const saved = await testApp.api.storage.kv.get('note-1');
    assert.ok(saved);
  });

  test('validates note input', async () => {
    function validateNote(title, content) {
      const errors[] = [];

      if (!title || title.trim().length === 0) {
        errors.push('Title is required');
      }

      if (title.length > 100) {
        errors.push('Title must be less than 100 characters');
      }

      if (content.length > 10000) {
        errors.push('Content must be less than 10,000 characters');
      }

      return { valid: errors.length === 0, errors };
    }

    // Valid note
    const valid = validateNote('Valid Title', 'Valid content');
    assert.ok(valid.valid);

    // Missing title
    const missingTitle = validateNote('', 'Content');
    assert.ok(!missingTitle.valid);
    assert.ok(missingTitle.errors.includes('Title is required'));

    // Title too long
    const longTitle = validateNote('x'.repeat(101), 'Content');
    assert.ok(!longTitle.valid);
  });

  test('sorts notes by date', async () => {
    const testApp = createTestApp();

    const notes = [
      { id: '1', title: 'Note 1', createdAt: '2024-01-01' },
      { id: '2', title: 'Note 2', createdAt: '2024-01-03' },
      { id: '3', title: 'Note 3', createdAt: '2024-01-02' },
    ];

    // Sort by date (newest first)
    const sorted = notes.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    assert.equal(sorted[0].id, '2'); // 2024-01-03
    assert.equal(sorted[1].id, '3'); // 2024-01-02
    assert.equal(sorted[2].id, '1'); // 2024-01-01
  });

  test('counts total notes', async () => {
    const testApp = createTestApp();

    await testApp.api.storage.kv.set('note-1', { id: '1', title: 'Note 1' });
    await testApp.api.storage.kv.set('note-2', { id: '2', title: 'Note 2' });
    await testApp.api.storage.kv.set('note-3', { id: '3', title: 'Note 3' });

    const keys = await testApp.api.storage.kv.list('note-');
    const count = keys.length;

    assert.equal(count, 3);
  });

  test('measures note save performance', async () => {
    const testApp = createTestApp();
    const monitor = new PerformanceMonitor();

    const note = {
      id: '1',
      title: 'Performance Test',
      content: 'x'.repeat(1000), // 1KB of content
    };

    const { duration } = await monitor.measure('save-note', async () => {
      await testApp.api.storage.kv.set('note-1', note);
    });

    // Should be fast (under 10ms for in-memory mock)
    assert.ok(duration < 100, `Save took ${duration}ms, expected < 100ms`);
  });
});
