const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' }
});

function authorized(request, env) {
  return Boolean(env.SYNC_TOKEN) &&
    request.headers.get('authorization') === `Bearer ${env.SYNC_TOKEN}`;
}

function validRecord(record) {
  return record && typeof record === 'object' &&
    typeof record.id === 'string' && record.id.length <= 100 &&
    String(record.event || '').length <= 100 &&
    String(record.match || '').length <= 30 &&
    String(record.team || '').length <= 20;
}

async function pushRecords(request, env) {
  const body = await request.json();
  const records = Array.isArray(body.records) ? body.records : [];
  if (!records.length || records.length > 500 || records.some(record => !validRecord(record))) {
    return json({ error: 'Invalid record batch' }, 400);
  }
  const now = Date.now();
  const statements = records.map(record => env.DB.prepare(`
    INSERT INTO scouting_records
      (id, event, match_number, team, scout, alliance, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      event = excluded.event,
      match_number = excluded.match_number,
      team = excluded.team,
      scout = excluded.scout,
      alliance = excluded.alliance,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).bind(
    record.id,
    String(record.event || 'Unspecified event'),
    String(record.match || ''),
    String(record.team || ''),
    String(record.scout || ''),
    String(record.alliance || ''),
    JSON.stringify(record),
    Number(record.createdAt || now),
    now
  ));
  await env.DB.batch(statements);
  return json({ stored: records.length, serverTime: now });
}

async function pullRecords(request, env) {
  const url = new URL(request.url);
  const event = url.searchParams.get('event') || '';
  const since = Math.max(0, Number(url.searchParams.get('since') || 0));
  const query = event && event !== 'all'
    ? env.DB.prepare('SELECT payload, updated_at FROM scouting_records WHERE event = ? AND updated_at > ? ORDER BY updated_at LIMIT 1000').bind(event, since)
    : env.DB.prepare('SELECT payload, updated_at FROM scouting_records WHERE updated_at > ? ORDER BY updated_at LIMIT 1000').bind(since);
  const result = await query.all();
  return json({
    records: result.results.map(row => JSON.parse(row.payload)),
    serverTime: Date.now(),
    hasMore: result.results.length === 1000
  });
}

async function fetchCriMatches(env) {
  if (!env.TBA_API_KEY) return json({ error: 'CRI schedule connection is not configured.' }, 503);
  const response = await fetch('https://www.thebluealliance.com/api/v3/event/2026vaale1/matches', {
    headers: { 'X-TBA-Auth-Key': env.TBA_API_KEY, 'Accept': 'application/json' }
  });
  if (!response.ok) return json({ error: `The Blue Alliance returned ${response.status}.` }, response.status);
  const matches = await response.json();
  return json(Array.isArray(matches) ? matches : []);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/tba/cri/matches' && request.method === 'GET') {
        try { return await fetchCriMatches(env); }
        catch { return json({ error: 'Could not reach The Blue Alliance.' }, 502); }
      }
      if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      try {
        if (url.pathname === '/api/records' && request.method === 'GET') return await pullRecords(request, env);
        if (url.pathname === '/api/records' && request.method === 'POST') return await pushRecords(request, env);
        if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true });
        return json({ error: 'Not found' }, 404);
      } catch (error) {
        return json({ error: 'Database request failed' }, 500);
      }
    }
    const response = await env.ASSETS.fetch(request);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;
    // Use the runtime's request origin, never client-supplied forwarded headers.
    return new HTMLRewriter()
      .on('meta[property="og:url"]', {
        element(element) { element.setAttribute('content', new URL('/', url.origin).href); },
      })
      .on('meta[property="og:image"], meta[name="twitter:image"]', {
        element(element) { element.setAttribute('content', new URL('/public/og.png', url.origin).href); },
      })
      .transform(response);
  }
};
