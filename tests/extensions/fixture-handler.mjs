export async function echo(input) { return { value: input.value, pid: process.pid, home: process.env.HOME, leaked: Boolean(process.env.DGOS_TEST_SECRET) }; }
export async function slow() { await new Promise((resolve) => setTimeout(resolve, 500)); return { done: true }; }
export async function connect() { return { healthy: true, tools: [{ operationId: 'echo', risk: 'low', sideEffects: false }] }; }
