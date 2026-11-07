// plugins/buscar.js — comando .search / .buscar (sin dependencias extra)
// Requiere Node 18+. Para YouTube/SoundCloud: pip install -U yt-dlp (en Termux)
import { execFile } from 'child_process';

const TZ = 'America/Lima';
const enc = encodeURIComponent;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA0 = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const UA = UA0;

async function getJson(url, { timeout = 15000, headers = {} } = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'user-agent': UA0, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
  return res.json();
}
async function getText(url, { timeout = 15000, headers = {} } = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'user-agent': UA0, ...headers }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
  return res.text();
}
const hasBin = (bin) => new Promise((ok) => execFile(bin, ['--version'], { timeout: 8000 }, (e) => ok(!e)));
const run = (bin, args, { timeout = 120000 } = {}) => new Promise((resolve, reject) => {
  execFile(bin, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, out, serr) => {
    if (err) return reject(new Error((serr || err.message).toString().split('\n').slice(-3).join(' ').slice(0, 250)));
    resolve(out.toString());
  });
});

// ---------- utilidades de formato ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const clean = (s = '') =>
  String(s).replace(/<[^>]+>/g, ' ').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return m;
  }).replace(/\s+/g, ' ').trim();
const clip = (s, n = 240) => { s = clean(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const short = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '—' : new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n)));
const date = (v) => {
  if (!v) return '—';
  let d;
  if (typeof v === 'number') d = new Date(v < 1e12 ? v * 1000 : v);
  else if (/^\d{8}$/.test(v)) d = new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`);
  else d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-ES', { timeZone: TZ });
};
const dur = (s) => { s = Math.round(Number(s) || 0); if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(x).padStart(2, '0')}`; };
const money = (v, cur) => (v == null ? null : `${v} ${cur || ''}`.trim());
const L = (icon, label, val) => (val === undefined || val === null || val === '' || val === '—' ? null : `${icon} ${label}: ${val}`);

// Un resultado: *1. Título* + líneas + enlace
const item = (i, title, lines, url) =>
  `*${i + 1}. ${clip(title, 120) || 'Sin título'}*\n${lines.filter(Boolean).join('\n')}${url ? `\n🔗 ${url}` : ''}`;

// ---------- motores web (DuckDuckGo + Bing de respaldo; Google bloquea bots) ----------
function unwrapDdg(h) {
  const m = h.match(/uddg=([^&"]+)/);
  if (m) return decodeURIComponent(m[1]);
  return h.startsWith('//') ? 'https:' + h : h;
}
function unwrapBing(h) {
  h = h.replaceAll('&amp;', '&');
  const u = h.match(/[?&]u=a1([^&]+)/)?.[1];
  if (u) { try { return Buffer.from(u.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { /* sigue */ } }
  return h;
}
async function ddg(q, n) {
  const html = await getText(`https://html.duckduckgo.com/html/?q=${enc(q)}&kp=1&kl=es-es`, { headers: { 'accept-language': 'es-ES,es;q=0.9' } });
  const out = [];
  for (const blk of html.split('<div class="result ').slice(1)) {
    const a = blk.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const url = unwrapDdg(a[1]);
    if (/duckduckgo\.com\/y\.js|ad_provider/.test(url)) continue; // anuncios
    out.push({ title: clean(a[2]), url, snippet: clean(blk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] || ''), shown: clean(blk.match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/)?.[1] || '') });
    if (out.length >= n) break;
  }
  return out;
}
async function bing(q, n) {
  const html = await getText(`https://www.bing.com/search?q=${enc(q)}&count=${Math.min(n + 5, 30)}&setlang=es&adlt=strict`, { headers: { 'accept-language': 'es-ES,es;q=0.9' } });
  const out = [];
  for (const blk of html.split('<li class="b_algo').slice(1)) {
    const a = blk.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    out.push({ title: clean(a[2]), url: unwrapBing(a[1]), snippet: clean(blk.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || ''), shown: '' });
    if (out.length >= n) break;
  }
  return out;
}
async function web(q, n, site) {
  const query = site ? `site:${site} ${q}` : q;
  let rows = [];
  try { rows = await ddg(query, n); } catch { /* DDG falló, uso Bing */ }
  if (rows.length < n) {
    try {
      const seen = new Set(rows.map((r) => r.url));
      for (const r of await bing(query, n)) if (!seen.has(r.url) && rows.length < n) rows.push(r);
    } catch { /* sin Bing */ }
  }
  if (!rows.length) throw new Error('Sin resultados (los buscadores pueden estar bloqueando temporalmente).');
  return rows.map((r, i) => item(i, r.title, [r.snippet && `📝 ${clip(r.snippet, 280)}`, r.shown && `🌐 ${r.shown}`], r.url));
}

// ---------- yt-dlp (YouTube / SoundCloud) ----------
async function ytdlpList(prefix, q, n) {
  if (!(await hasBin('yt-dlp'))) throw new Error('Falta yt-dlp. En Termux: pkg install python ffmpeg && pip install -U yt-dlp');
  const out = await run('yt-dlp', ['--flat-playlist', '--dump-json', '--no-warnings', `${prefix}${n}:${q}`], { timeout: 90_000 });
  return out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
async function ytFull(url) {
  try { return JSON.parse(await run('yt-dlp', ['-J', '--no-playlist', '--skip-download', '--no-warnings', url], { timeout: 45_000 })); }
  catch { return null; }
}
async function youtube(q, n) {
  const list = await ytdlpList('ytsearch', q, n);
  if (!list.length) throw new Error('Sin resultados.');
  const full = await Promise.all(list.map((v, i) => (i < 5 ? ytFull(v.url || `https://youtu.be/${v.id}`) : null))); // detalle completo de los 5 primeros
  return list.map((v, i) => {
    const f = full[i] || {};
    const url = v.url || `https://youtu.be/${v.id}`;
    return item(i, f.title || v.title, [
      L('📺', 'Canal', f.channel || v.channel || v.uploader),
      L('👥', 'Suscriptores', f.channel_follower_count != null ? short(f.channel_follower_count) : null),
      L('👁️', 'Vistas', short(f.view_count ?? v.view_count)),
      L('👍', 'Likes', f.like_count != null ? short(f.like_count) : null),
      L('💬', 'Comentarios', f.comment_count != null ? short(f.comment_count) : null),
      L('⏱️', 'Duración', dur(f.duration ?? v.duration)),
      L('📅', 'Subido', f.upload_date ? date(f.upload_date) : null),
      L('🏷️', 'Categoría', f.categories?.[0]),
      L('🔖', 'Tags', f.tags?.slice(0, 5).join(', ')),
      f.live_status === 'is_live' ? '🔴 EN VIVO' : null,
      L('🔗', 'Canal', f.channel_url || v.channel_url),
      (f.description || v.description) && `📝 ${clip(f.description || v.description, 200)}`,
    ], url);
  });
}
async function soundcloud(q, n) {
  const list = await ytdlpList('scsearch', q, n);
  if (!list.length) throw new Error('Sin resultados.');
  return list.map((v, i) => item(i, v.title, [L('🎤', 'Artista', v.uploader || v.channel), L('⏱️', 'Duración', dur(v.duration)), L('▶️', 'Reproducciones', v.view_count != null ? short(v.view_count) : null), L('📅', 'Fecha', v.upload_date ? date(v.upload_date) : null)], v.url || v.webpage_url));
}

// ---------- TikTok (tikwm, sin key) ----------
async function tiktok(q, n) {
  const res = await fetch('https://www.tikwm.com/api/feed/search', {
    method: 'POST', signal: AbortSignal.timeout(20_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
    body: `keywords=${enc(q)}&count=${Math.min(n, 30)}&cursor=0&web=1&hd=1`,
  });
  const j = await res.json();
  const vids = j?.data?.videos || [];
  if (!vids.length) throw new Error('Sin resultados.');
  return vids.slice(0, n).map((v, i) => item(i, v.title || '(sin descripción)', [
    L('👤', 'Autor', `${v.author?.nickname || ''} (@${v.author?.unique_id})`),
    L('▶️', 'Vistas', short(v.play_count)), L('❤️', 'Likes', short(v.digg_count)),
    L('💬', 'Comentarios', short(v.comment_count)), L('↪️', 'Compartidos', short(v.share_count)),
    L('🔖', 'Guardados', short(v.collect_count)), L('⏱️', 'Duración', dur(v.duration)),
    L('🎵', 'Música', v.music_info?.title && `${v.music_info.title} — ${v.music_info.author}`),
    L('📅', 'Fecha', v.create_time && date(v.create_time)), L('🌎', 'Región', v.region),
  ], `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.video_id}`));
}

// ---------- APIs abiertas ----------
async function reddit(q, n, c) {
  const j = await getJson(`https://www.reddit.com/search.json?q=${enc(q)}&limit=${Math.min(n + 10, 50)}&sort=relevance&raw_json=1`);
  const allowNsfw = !c.isGroup || c.chatDb?.nsfw;
  const posts = (j.data?.children || []).map((x) => x.data).filter((p) => allowNsfw || !p.over_18).slice(0, n);
  if (!posts.length) throw new Error('Sin resultados.');
  return posts.map((p, i) => item(i, p.title, [
    L('📌', 'Subreddit', p.subreddit_name_prefixed), L('👤', 'Autor', p.author && `u/${p.author}`),
    L('⬆️', 'Puntos', short(p.score)), L('📊', 'Aprobación', p.upvote_ratio != null ? `${Math.round(p.upvote_ratio * 100)}%` : null),
    L('💬', 'Comentarios', short(p.num_comments)), L('📅', 'Fecha', date(p.created_utc)),
    p.over_18 ? '🔞 NSFW' : null,
    p.selftext && `📝 ${clip(p.selftext, 220)}`,
    p.url && !p.is_self && !p.url.includes('reddit.com') ? `↗️ ${p.url}` : null,
  ], `https://www.reddit.com${p.permalink}`));
}

async function wikipedia(q, n, c, lang = 'es') {
  const j = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q)}&gsrlimit=${Math.min(n, 20)}&prop=extracts|info&exintro=1&explaintext=1&exsentences=4&exlimit=max&inprop=url&format=json&origin=*`);
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  if (!pages.length) throw new Error('Sin resultados.');
  return pages.map((p, i) => item(i, p.title, [L('🕒', 'Editado', date(p.touched)), p.extract && `📝 ${clip(p.extract, 520)}`], p.fullurl));
}

async function github(q, n) {
  const j = await getJson(`https://api.github.com/search/repositories?q=${enc(q)}&per_page=${Math.min(n, 30)}`, { headers: { accept: 'application/vnd.github+json' } });
  if (!j.items?.length) throw new Error('Sin resultados.');
  return j.items.map((r, i) => item(i, r.full_name, [
    r.description && `📝 ${clip(r.description, 200)}`,
    L('⭐', 'Estrellas', short(r.stargazers_count)), L('🍴', 'Forks', short(r.forks_count)), L('👁️', 'Watchers', short(r.watchers_count)),
    L('🐞', 'Issues abiertos', short(r.open_issues_count)), L('💻', 'Lenguaje', r.language), L('⚖️', 'Licencia', r.license?.spdx_id),
    L('📅', 'Creado', date(r.created_at)), L('🕒', 'Actualizado', date(r.pushed_at)), L('🔖', 'Temas', r.topics?.slice(0, 6).join(', ')),
    L('🏠', 'Web', r.homepage),
  ], r.html_url));
}
async function githubUser(q, n) {
  const j = await getJson(`https://api.github.com/search/users?q=${enc(q)}&per_page=${Math.min(n, 15)}`, { headers: { accept: 'application/vnd.github+json' } });
  if (!j.items?.length) throw new Error('Sin resultados.');
  const det = await Promise.all(j.items.map((u, i) => (i < 5 ? getJson(u.url).catch(() => null) : null)));
  return j.items.map((u, i) => { const d = det[i] || {}; return item(i, d.name ? `${d.name} (@${u.login})` : `@${u.login}`, [
    L('🏷️', 'Tipo', u.type), d.bio && `📝 ${clip(d.bio, 160)}`, L('👥', 'Seguidores', d.followers != null ? short(d.followers) : null),
    L('➡️', 'Siguiendo', d.following != null ? short(d.following) : null), L('📦', 'Repos públicos', d.public_repos != null ? short(d.public_repos) : null),
    L('📍', 'Ubicación', d.location), L('🏢', 'Empresa', d.company), L('🔗', 'Web', d.blog), L('📅', 'Desde', d.created_at && date(d.created_at)),
  ], u.html_url); });
}

async function npm(q, n) {
  const j = await getJson(`https://registry.npmjs.org/-/v1/search?text=${enc(q)}&size=${Math.min(n, 30)}`);
  if (!j.objects?.length) throw new Error('Sin resultados.');
  return j.objects.map((o, i) => { const p = o.package; return item(i, `${p.name}@${p.version}`, [
    p.description && `📝 ${clip(p.description, 200)}`, L('👤', 'Publicado por', p.publisher?.username), L('📅', 'Última versión', date(p.date)),
    L('⭐', 'Puntaje', o.score?.final != null ? `${Math.round(o.score.final * 100)}%` : null), L('🔖', 'Keywords', p.keywords?.slice(0, 6).join(', ')),
    L('🏠', 'Web', p.links?.homepage), L('📦', 'Repo', p.links?.repository),
  ], p.links?.npm); });
}
async function pypi(q) {
  const name = q.trim().split(/\s+/)[0];
  const j = await getJson(`https://pypi.org/pypi/${enc(name)}/json`).catch(() => { throw new Error('PyPI no tiene búsqueda abierta: escribe el nombre exacto del paquete.'); });
  const i = j.info;
  return [item(0, `${i.name} ${i.version}`, [i.summary && `📝 ${clip(i.summary, 240)}`, L('👤', 'Autor', i.author), L('⚖️', 'Licencia', i.license && clip(i.license, 40)), L('🐍', 'Requiere', i.requires_python), L('🏠', 'Web', i.home_page || i.project_urls?.Homepage), L('📅', 'Releases', Object.keys(j.releases || {}).length)], i.package_url)];
}

async function stackoverflow(q, n) {
  const j = await getJson(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${enc(q)}&site=stackoverflow&pagesize=${Math.min(n, 30)}`);
  if (!j.items?.length) throw new Error('Sin resultados.');
  return j.items.map((p, i) => item(i, p.title, [
    L('⬆️', 'Votos', p.score), L('💬', 'Respuestas', `${p.answer_count}${p.is_answered ? ' ✅ resuelta' : ''}`), L('👁️', 'Vistas', short(p.view_count)),
    L('🔖', 'Tags', p.tags?.join(', ')), L('👤', 'Autor', p.owner?.display_name), L('📅', 'Fecha', date(p.creation_date)),
  ], p.link));
}

async function deezer(q, n) {
  const j = await getJson(`https://api.deezer.com/search?q=${enc(q)}&limit=${Math.min(n, 30)}`);
  if (!j.data?.length) throw new Error('Sin resultados.');
  return j.data.map((t, i) => item(i, t.title, [
    L('🎤', 'Artista', t.artist?.name), L('💿', 'Álbum', t.album?.title), L('⏱️', 'Duración', dur(t.duration)),
    L('🔥', 'Popularidad', short(t.rank)), t.explicit_lyrics ? '🔞 Contenido explícito' : null, L('🎧', 'Preview', t.preview),
  ], t.link));
}
async function itunes(q, n, c, media = 'music') {
  const j = await getJson(`https://itunes.apple.com/search?term=${enc(q)}&media=${media}&limit=${Math.min(n, 30)}&country=PE`);
  if (!j.results?.length) throw new Error('Sin resultados.');
  return j.results.map((r, i) => {
    if (media === 'software') return item(i, r.trackName, [L('👨‍💻', 'Desarrollador', r.artistName), L('⭐', 'Valoración', r.averageUserRating && `${r.averageUserRating.toFixed(1)} (${short(r.userRatingCount)} votos)`), L('💲', 'Precio', r.formattedPrice), L('🏷️', 'Categoría', r.primaryGenreName), L('🔢', 'Versión', r.version), L('📅', 'Actualizada', date(r.currentVersionReleaseDate)), r.description && `📝 ${clip(r.description, 200)}`], r.trackViewUrl);
    if (media === 'podcast') return item(i, r.collectionName, [L('🎙️', 'Autor', r.artistName), L('🏷️', 'Género', r.primaryGenreName), L('📻', 'Episodios', r.trackCount), L('📅', 'Último', date(r.releaseDate))], r.collectionViewUrl);
    return item(i, r.trackName || r.collectionName, [L('🎤', 'Artista', r.artistName), L('💿', 'Álbum', r.collectionName), L('🏷️', 'Género', r.primaryGenreName), L('⏱️', 'Duración', dur((r.trackTimeMillis || 0) / 1000)), L('📅', 'Lanzamiento', date(r.releaseDate)), L('💲', 'Precio', money(r.trackPrice, r.currency)), L('🎧', 'Preview', r.previewUrl)], r.trackViewUrl);
  });
}

async function jikan(kind, q, n) {
  const j = await getJson(`https://api.jikan.moe/v4/${kind}?q=${enc(q)}&limit=${Math.min(n, 25)}${kind !== 'characters' ? '&sfw=true' : ''}`);
  if (!j.data?.length) throw new Error('Sin resultados.');
  return j.data.map((a, i) => {
    if (kind === 'characters') return item(i, a.name + (a.name_kanji ? ` (${a.name_kanji})` : ''), [L('⭐', 'Favoritos', short(a.favorites)), L('🏷️', 'Apodos', a.nicknames?.slice(0, 4).join(', ')), a.about && `📝 ${clip(a.about, 300)}`], a.url);
    const m = kind === 'manga';
    return item(i, a.title_english && a.title_english !== a.title ? `${a.title} / ${a.title_english}` : a.title, [
      L('🏷️', 'Tipo', a.type), L('📺', m ? 'Capítulos' : 'Episodios', m ? a.chapters : a.episodes), m ? L('📚', 'Tomos', a.volumes) : L('⏱️', 'Duración', a.duration),
      L('📡', 'Estado', a.status), L('⭐', 'Nota', a.score && `${a.score} (${short(a.scored_by)} votos)`), L('🏆', 'Ranking', a.rank && `#${a.rank}`),
      L('🔥', 'Popularidad', a.popularity && `#${a.popularity}`), L('👥', 'Miembros', short(a.members)), L('📅', m ? 'Publicación' : 'Emisión', (m ? a.published : a.aired)?.string),
      L('🎬', 'Estudio', a.studios?.map((s) => s.name).join(', ')), L('✍️', 'Autores', a.authors?.map((s) => s.name).join(', ')),
      L('🎭', 'Géneros', a.genres?.map((g) => g.name).join(', ')), L('🔞', 'Clasificación', a.rating), a.synopsis && `📝 ${clip(a.synopsis, 320)}`,
    ], a.url);
  });
}

async function imdb(q, n) {
  const key = q.trim()[0]?.toLowerCase() || 'a';
  const j = await getJson(`https://v3.sg.media-imdb.com/suggestion/${enc(/[a-z0-9]/.test(key) ? key : 'x')}/${enc(q.trim())}.json`);
  const rows = (j.d || []).filter((x) => x.id).slice(0, n);
  if (!rows.length) throw new Error('Sin resultados.');
  return rows.map((x, i) => item(i, x.l, [L('🏷️', 'Tipo', x.q || (x.id.startsWith('nm') ? 'Persona' : '')), L('📅', 'Año', x.y && (x.yr || x.y)), L('🏆', 'Ranking IMDb', x.rank && `#${short(x.rank)}`), L('🎭', 'Reparto', x.s)], `https://www.imdb.com/${x.id.startsWith('nm') ? 'name' : 'title'}/${x.id}/`));
}
async function tvmaze(q, n) {
  const j = await getJson(`https://api.tvmaze.com/search/shows?q=${enc(q)}`);
  if (!j.length) throw new Error('Sin resultados.');
  return j.slice(0, n).map(({ show: s }, i) => item(i, s.name, [
    L('🏷️', 'Tipo', s.type), L('⭐', 'Nota', s.rating?.average), L('📡', 'Estado', s.status), L('🎭', 'Géneros', s.genres?.join(', ')),
    L('📅', 'Estreno', s.premiered && date(s.premiered)), L('🏁', 'Final', s.ended && date(s.ended)), L('⏱️', 'Duración ep.', s.runtime && `${s.runtime} min`),
    L('🌎', 'Idioma', s.language), L('📺', 'Canal', s.network?.name || s.webChannel?.name), s.summary && `📝 ${clip(s.summary, 300)}`,
    L('🏠', 'Web oficial', s.officialSite), L('🎞️', 'IMDb', s.externals?.imdb && `https://www.imdb.com/title/${s.externals.imdb}/`),
  ], s.url));
}

async function books(q, n) {
  const j = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${enc(q)}&maxResults=${Math.min(n, 30)}&printType=books`);
  if (!j.items?.length) throw new Error('Sin resultados.');
  return j.items.map((b, i) => { const v = b.volumeInfo; return item(i, v.title + (v.subtitle ? `: ${v.subtitle}` : ''), [
    L('✍️', 'Autores', v.authors?.join(', ')), L('🏢', 'Editorial', v.publisher), L('📅', 'Publicado', v.publishedDate), L('📄', 'Páginas', v.pageCount),
    L('⭐', 'Valoración', v.averageRating && `${v.averageRating} (${short(v.ratingsCount)} votos)`), L('🏷️', 'Categorías', v.categories?.join(', ')),
    L('🌎', 'Idioma', v.language), L('💲', 'Precio', b.saleInfo?.listPrice && money(b.saleInfo.listPrice.amount, b.saleInfo.listPrice.currencyCode)),
    v.description && `📝 ${clip(v.description, 280)}`,
  ], v.infoLink || v.previewLink); });
}

async function steam(q, n) {
  const j = await getJson(`https://store.steampowered.com/api/storesearch/?term=${enc(q)}&l=spanish&cc=PE`);
  const rows = (j.items || []).slice(0, n);
  if (!rows.length) throw new Error('Sin resultados.');
  const det = await Promise.all(rows.map((g, i) => (i < 4 ? getJson(`https://store.steampowered.com/api/appdetails?appids=${g.id}&l=spanish&cc=PE`).then((d) => d[g.id]?.data).catch(() => null) : null)));
  return rows.map((g, i) => { const d = det[i] || {}; return item(i, g.name, [
    L('💲', 'Precio', g.price ? `${(g.price.final / 100).toFixed(2)} ${g.price.currency}${g.price.discount_percent ? ` (-${g.price.discount_percent}%)` : ''}` : 'Gratis / sin precio'),
    L('🏆', 'Metascore', g.metascore), L('💻', 'Plataformas', Object.entries(g.platforms || {}).filter(([, v]) => v).map(([k]) => k).join(', ')),
    L('🎭', 'Géneros', d.genres?.map((x) => x.description).join(', ')), L('👨‍💻', 'Desarrollador', d.developers?.join(', ')),
    L('📅', 'Lanzamiento', d.release_date?.date), L('👍', 'Recomendaciones', d.recommendations && short(d.recommendations.total)),
    d.short_description && `📝 ${clip(d.short_description, 240)}`,
  ], `https://store.steampowered.com/app/${g.id}`); });
}

async function news(q, n) {
  const xml = await getText(`https://news.google.com/rss/search?q=${enc(q)}&hl=es-419&gl=PE&ceid=PE:es-419`);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, n).map((m) => m[1]);
  if (!items.length) throw new Error('Sin resultados.');
  return items.map((x, i) => item(i, clean(x.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), [
    L('📰', 'Fuente', clean(x.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '')), L('📅', 'Fecha', date(x.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1])),
  ], clean(x.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '')));
}

async function dictionary(q) {
  const j = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/es/${enc(q.trim().split(/\s+/)[0])}`).catch(() => { throw new Error('No encontré esa palabra.'); });
  return j.slice(0, 3).map((e, i) => item(i, e.word, [
    L('🔊', 'Fonética', e.phonetic),
    ...e.meanings.slice(0, 4).map((m) => `📖 _${m.partOfSpeech}_: ${clip(m.definitions[0]?.definition, 200)}${m.definitions[0]?.example ? `\n   ↳ Ej: ${clip(m.definitions[0].example, 120)}` : ''}${m.synonyms?.length ? `\n   ≈ ${m.synonyms.slice(0, 5).join(', ')}` : ''}`),
  ], e.sourceUrls?.[0]));
}

async function images(q, n, c) {
  const j = await getJson(`https://api.openverse.org/v1/images/?q=${enc(q)}&page_size=${Math.min(n, 20)}`);
  if (!j.results?.length) throw new Error('Sin resultados.');
  const lines = j.results.map((r, i) => item(i, r.title || 'Imagen', [L('👤', 'Autor', r.creator), L('⚖️', 'Licencia', r.license && `CC ${r.license.toUpperCase()} ${r.license_version || ''}`.trim()), L('📐', 'Tamaño', r.width && `${r.width}×${r.height}`), L('📚', 'Fuente', r.source)], r.foreign_landing_url || r.url));
  lines.images = j.results.slice(0, 3).map((r) => ({ url: r.thumbnail || r.url, caption: clip(r.title || '', 100) }));
  return lines;
}

// ---------- catálogo de plataformas ----------
const site = (domain) => (q, n) => web(q, n, domain);
const P = [
  // [clave, alias, etiqueta, grupo, función]
  ['google', ['google', 'g', 'web', 'duckduckgo', 'ddg', 'bing'], 'Web (Google/DuckDuckGo/Bing)', 'Web', (q, n) => web(q, n)],
  ['noticias', ['noticias', 'news', 'googlenews'], 'Noticias (Google News)', 'Web', news],
  ['imagenes', ['imagenes', 'imágenes', 'images', 'img', 'foto', 'fotos'], 'Imágenes (Openverse)', 'Web', images],
  ['wikipedia', ['wikipedia', 'wiki'], 'Wikipedia (es)', 'Web', (q, n, c) => wikipedia(q, n, c, 'es')],
  ['wikien', ['wikien', 'wikipedia-en'], 'Wikipedia (en)', 'Web', (q, n, c) => wikipedia(q, n, c, 'en')],
  ['diccionario', ['diccionario', 'dic', 'dictionary', 'palabra'], 'Diccionario', 'Web', dictionary],
  ['youtube', ['youtube', 'yt', 'video', 'videos'], 'YouTube', 'Video y redes', youtube],
  ['tiktok', ['tiktok', 'tt'], 'TikTok', 'Video y redes', tiktok],
  ['instagram', ['instagram', 'ig'], 'Instagram', 'Video y redes', site('instagram.com')],
  ['facebook', ['facebook', 'fb'], 'Facebook', 'Video y redes', site('facebook.com')],
  ['twitter', ['twitter', 'x', 'tw'], 'Twitter / X', 'Video y redes', site('x.com')],
  ['threads', ['threads'], 'Threads', 'Video y redes', site('threads.net')],
  ['pinterest', ['pinterest', 'pin'], 'Pinterest', 'Video y redes', site('pinterest.com')],
  ['reddit', ['reddit'], 'Reddit', 'Video y redes', reddit],
  ['twitch', ['twitch'], 'Twitch', 'Video y redes', site('twitch.tv')],
  ['linkedin', ['linkedin'], 'LinkedIn', 'Video y redes', site('linkedin.com')],
  ['telegram', ['telegram', 'tg'], 'Telegram', 'Video y redes', site('t.me')],
  ['whatsapp', ['whatsapp', 'canal', 'canales'], 'Canales de WhatsApp', 'Video y redes', site('whatsapp.com/channel')],
  ['musica', ['musica', 'música', 'deezer', 'cancion', 'canción'], 'Música (Deezer)', 'Música', deezer],
  ['itunes', ['itunes', 'applemusic'], 'Apple Music / iTunes', 'Música', (q, n, c) => itunes(q, n, c, 'music')],
  ['spotify', ['spotify'], 'Spotify (enlaces)', 'Música', site('open.spotify.com')],
  ['soundcloud', ['soundcloud', 'sc'], 'SoundCloud', 'Música', soundcloud],
  ['podcast', ['podcast', 'podcasts'], 'Podcasts', 'Música', (q, n, c) => itunes(q, n, c, 'podcast')],
  ['anime', ['anime'], 'Anime (MyAnimeList)', 'Anime y cine', (q, n) => jikan('anime', q, n)],
  ['manga', ['manga'], 'Manga (MyAnimeList)', 'Anime y cine', (q, n) => jikan('manga', q, n)],
  ['personaje', ['personaje', 'character', 'char'], 'Personajes de anime', 'Anime y cine', (q, n) => jikan('characters', q, n)],
  ['peliculas', ['peliculas', 'películas', 'pelicula', 'movie', 'movies', 'imdb', 'actor'], 'Películas / actores (IMDb)', 'Anime y cine', imdb],
  ['series', ['series', 'serie', 'tvmaze', 'tv'], 'Series (TVMaze)', 'Anime y cine', tvmaze],
  ['libros', ['libros', 'libro', 'books', 'book'], 'Libros (Google Books)', 'Otros', books],
  ['steam', ['steam', 'juegos', 'juego', 'games', 'game'], 'Juegos (Steam)', 'Otros', steam],
  ['apps', ['apps', 'app', 'appstore'], 'Apps (App Store)', 'Otros', (q, n, c) => itunes(q, n, c, 'software')],
  ['github', ['github', 'gh', 'repo', 'repos'], 'GitHub (repos)', 'Programación', github],
  ['githubuser', ['githubuser', 'ghuser', 'dev'], 'GitHub (usuarios)', 'Programación', githubUser],
  ['npm', ['npm', 'node'], 'NPM', 'Programación', npm],
  ['pypi', ['pypi', 'pip', 'python'], 'PyPI (nombre exacto)', 'Programación', pypi],
  ['stackoverflow', ['stackoverflow', 'so', 'stack'], 'Stack Overflow', 'Programación', stackoverflow],
];
const BY_ALIAS = new Map(P.flatMap((p) => p[1].map((a) => [a, p])));

function helpText(prefix) {
  const groups = {};
  for (const [, aliases, label, group] of P) (groups[group] ||= []).push(`• *${aliases[0]}* — ${label}`);
  return `🔎 *Buscador* — uso: *${prefix}search <plataforma> <búsqueda>*\nEj: ${prefix}search youtube lofi hip hop\nOpcional: *-n 15* para más resultados (máx. 20).\nSin plataforma busca en la web.\n\n${Object.entries(groups).map(([g, l]) => `*${g}*\n${l.join('\n')}`).join('\n\n')}`;
}

// Parte el texto en mensajes de ≤3800 caracteres sin cortar un resultado a la mitad
function chunk(header, blocks, max = 3800) {
  const out = []; let cur = header;
  for (const b of blocks) {
    if (cur.length + b.length + 2 > max && cur.trim()) { out.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + b;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const lastUse = new Map();

export default {
  name: 'buscar',
  run: async (comando, sock, chatId, msg, args, senderJid, prefijoUsado) => {
    if (comando !== 'search' && comando !== 'buscar') return;
    const prefix = prefijoUsado || '.';
    const esGrupo = chatId.endsWith('@g.us');
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!args.length) return reply(helpText(prefix));

    let n = 10;
    const text = args.join(' ').replace(/(?:^|\s)-n\s*(\d{1,2})\b/i, (_, v) => { n = Math.min(Math.max(parseInt(v), 1), 20); return ' '; }).trim();
    const [first, ...rest] = text.split(/\s+/);
    let plat = BY_ALIAS.get((first || '').toLowerCase());
    let q = rest.join(' ');
    if (!plat) { plat = P[0]; q = text; }
    if (!q) return reply(`🔎 Escribe qué buscar. Ej: *${prefix}search ${plat[0]} tu búsqueda*`);

    const wait = (lastUse.get(senderJid) || 0) + 6000 - Date.now();
    if (wait > 0) return reply(`⏳ Espera ${Math.ceil(wait / 1000)}s para volver a buscar.`);
    lastUse.set(senderJid, Date.now());

    await sock.sendMessage(chatId, { react: { text: '🔎', key: msg.key } }).catch(() => {});
    let blocks;
    try { blocks = await plat[4](q, n, { isGroup: esGrupo, chatDb: { nsfw: false } }); }
    catch (e) { return reply(`❌ No pude buscar en *${plat[2]}*: ${String(e.message || e).slice(0, 200)}`); }

    const parts = chunk(`🔎 *${plat[2]}* — "${q}"\n📊 ${blocks.length} resultado(s)\n`, blocks);
    for (let i = 0; i < parts.length; i++) {
      if (i) await sleep(700);
      await sock.sendMessage(chatId, { text: parts[i] }, i === 0 ? { quoted: msg } : undefined);
    }
    for (const img of blocks.images || []) {
      await sleep(700);
      await sock.sendMessage(chatId, { image: { url: img.url }, caption: img.caption }).catch(() => {});
    }
  },
};
