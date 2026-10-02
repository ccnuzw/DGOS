const port = (env, name, fallback) => {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 15200 || value > 15229) throw new Error(`integration_configuration_invalid: ${name} must use assigned ports 15200–15229`);
  return value;
};

export function integrationEnvironment(env = process.env) {
  const project = env.DGOS_INTEGRATION_PROJECT ?? 'dgos-v1-integration';
  if (!/^dgos-v1-integration(?:-[a-z0-9]+)*$/.test(project)) throw new Error('integration_configuration_invalid: dedicated Compose project required');
  const ports = {
    postgres: port(env, 'DGOS_INTEGRATION_PG_PORT', 15200),
    redis: port(env, 'DGOS_INTEGRATION_REDIS_PORT', 15201),
    api: port(env, 'DGOS_INTEGRATION_API_PORT', 15202),
    web: port(env, 'DGOS_INTEGRATION_WEB_PORT', 15203),
    fixture: port(env, 'DGOS_INTEGRATION_FIXTURE_PORT', 15204),
  };
  if (new Set(Object.values(ports)).size !== Object.keys(ports).length) throw new Error('integration_configuration_invalid: ports must be distinct');
  return {
    project, ports,
    composeArgs: ['compose', '-p', project, '-f', 'docker-compose.integration.yml'],
    databaseUrl: `postgresql://dgos:dgos@127.0.0.1:${ports.postgres}/dgos_v1_integrated`,
    webUrl: `http://127.0.0.1:${ports.web}`,
    apiUrl: `http://127.0.0.1:${ports.api}`,
    fixtureUrl: `http://127.0.0.1:${ports.fixture}`,
  };
}
