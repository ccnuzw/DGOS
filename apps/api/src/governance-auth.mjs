export async function requireFreshAdminSession(request, auth, { identity, clock = () => Date.now() }) {
  if (auth.authMethod !== 'session') throw Object.assign(new Error('step_up_required'), { statusCode: 403 });
  const session = await identity.getSession(auth.sessionId);
  if (!session.authFreshUntil || new Date(session.authFreshUntil).getTime() <= clock()) throw Object.assign(new Error('step_up_required'), { statusCode: 403 });
  return session;
}

export function assertKeyResource(auth, ownerId) {
  if (auth.authMethod === 'api_key' && auth.subjectId !== ownerId) throw Object.assign(new Error('permission_denied'), { statusCode: 403 });
}
