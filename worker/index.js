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

async function fetchMatch13(request, env, kind) {
  if (!env.MATCH13_API_KEY) return json({ error: 'Match13 is not configured.' }, 503);
  const url = new URL(request.url);
  let upstreamPath = '';
  let cacheSeconds = 300;
  if (kind === 'team') {
    const team = url.searchParams.get('team') || '';
    const year = Number(url.searchParams.get('year'));
    if (!/^\d{1,5}$/.test(team) || !Number.isInteger(year) || year < 1992 || year > new Date().getUTCFullYear() + 1) {
      return json({ error: 'Enter a valid team number and season.' }, 400);
    }
    upstreamPath = `/v1/teams/${team}/years/${year}?scope=all`;
    cacheSeconds = 900;
  } else if (kind === 'event') {
    const eventKey = (url.searchParams.get('eventKey') || '').toLowerCase();
    if (!/^\d{4}[a-z0-9]{2,20}$/.test(eventKey)) return json({ error: 'Enter a valid event key.' }, 400);
    upstreamPath = `/v1/events/${eventKey}/teams`;
  } else if (kind === 'match') {
    const matchKey = (url.searchParams.get('matchKey') || '').toLowerCase();
    if (!/^\d{4}[a-z0-9]{2,20}_(?:qm\d+|[a-z]{1,3}\d+m\d+)$/.test(matchKey)) {
      return json({ error: 'Enter a valid match key.' }, 400);
    }
    upstreamPath = `/v1/matches/${matchKey}?scope=all`;
  }
  const upstream = await fetch(`https://actions.match13.com${upstreamPath}`, {
    headers: { Authorization: `Bearer ${env.MATCH13_API_KEY}`, Accept: 'application/json' }
  });
  if (!upstream.ok) {
    const retryAfter = upstream.headers.get('retry-after');
    const message = upstream.status === 429
      ? `Match13 rate limit reached${retryAfter ? `; retry after ${retryAfter} seconds` : ''}.`
      : `Match13 returned ${upstream.status}.`;
    return json({ error: message }, upstream.status);
  }
  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${cacheSeconds}`
    }
  });
}

function selectRobotPhoto(media) {
  const supportedTypes = new Set(['imgur', 'cdphotothread', 'instagram-image']);
  return (Array.isArray(media) ? media : [])
    .filter(item => supportedTypes.has(item?.type) && /^https:\/\//i.test(item?.direct_url || ''))
    .sort((a, b) => Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)))[0] || null;
}

function trustedPhotoUrl(value) {
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      'i.imgur.com',
      'imgur.com',
      'www.imgur.com',
      'chiefdelphi.com',
      'www.chiefdelphi.com',
      'cdn.discordapp.com',
      'media.discordapp.net',
      'instagram.com',
      'www.instagram.com',
      'scontent.cdninstagram.com'
    ]);
    return url.protocol === 'https:' && allowedHosts.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

async function fetchTeamPhoto(request, env) {
  if (!env.TBA_API_KEY) return json({ error: 'The Blue Alliance photo connection is not configured.' }, 503);
  const url = new URL(request.url);
  const team = url.searchParams.get('team') || '';
  const year = Number(url.searchParams.get('year'));
  if (!/^\d{1,5}$/.test(team) || !Number.isInteger(year) || year < 1992 || year > new Date().getUTCFullYear() + 1) {
    return json({ error: 'Enter a valid team number and season.' }, 400);
  }
  const mediaResponse = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}/media/${year}`, {
    headers: { 'X-TBA-Auth-Key': env.TBA_API_KEY, 'Accept': 'application/json' }
  });
  if (!mediaResponse.ok) return json({ error: `The Blue Alliance returned ${mediaResponse.status}.` }, mediaResponse.status);
  const photo = selectRobotPhoto(await mediaResponse.json());
  if (!photo) return json({ error: `No robot photo is available for Team ${team} in ${year}.` }, 404);
  const photoUrl = trustedPhotoUrl(photo.direct_url);
  if (!photoUrl) return json({ error: 'The available photo uses an unsupported image host.' }, 422);
  const imageResponse = await fetch(photoUrl.toString(), { headers: { 'Accept': 'image/*' } });
  const contentType = (imageResponse.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  const contentLength = Number(imageResponse.headers.get('content-length') || 0);
  if (!imageResponse.ok || !allowedImageTypes.has(contentType)) return json({ error: 'The team photo could not be downloaded.' }, 502);
  if (contentLength > 8_000_000) return json({ error: 'The available team photo is too large.' }, 413);
  const body = await imageResponse.arrayBuffer();
  if (body.byteLength > 8_000_000) return json({ error: 'The available team photo is too large.' }, 413);
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=86400',
      'x-tiger-photo-source': photoUrl.toString()
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/tba/cri/matches' && request.method === 'GET') {
        try { return await fetchCriMatches(env); }
        catch { return json({ error: 'Could not reach The Blue Alliance.' }, 502); }
      }
      if (url.pathname === '/api/tba/team-photo' && request.method === 'GET') {
        try { return await fetchTeamPhoto(request, env); }
        catch { return json({ error: 'Could not download the team photo.' }, 502); }
      }
      if (url.pathname === '/api/match13/team' && request.method === 'GET') {
        try { return await fetchMatch13(request, env, 'team'); }
        catch { return json({ error: 'Could not reach Match13.' }, 502); }
      }
      if (url.pathname === '/api/match13/event' && request.method === 'GET') {
        try { return await fetchMatch13(request, env, 'event'); }
        catch { return json({ error: 'Could not reach Match13.' }, 502); }
      }
      if (url.pathname === '/api/match13/match' && request.method === 'GET') {
        try { return await fetchMatch13(request, env, 'match'); }
        catch { return json({ error: 'Could not reach Match13.' }, 502); }
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
