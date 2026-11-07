import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

/* ════════════════════════════════════════════════════════════════
   PLAY · audio de YouTube, rápido y gratis
   - Una sola llamada a yt-dlp (antes eran dos) y sin convertir a mp3.
   - Caché por BÚSQUEDA: si ya se pidió, no se vuelve a llamar a yt-dlp.
   - Lo ya enviado se reenvía desde WhatsApp sin volver a subir el archivo.
   - Seguro: el texto del usuario nunca pasa por una consola (antes sí).
   ════════════════════════════════════════════════════════════════ */

let BufferJSON = null;
try { ({ BufferJSON } = await import('@whiskeysockets/baileys')); } catch { /* sin reenvío instantáneo */ }

// ── Ajustes ────────────────────────────────────────────────────
const ALIAS = ['play', 'audio', 'song', 'playaudio', 'ytaudio', 'yt'];
const DIR = path.resolve('cache_audios');
const ARCHIVO_INDICE = path.join(DIR, 'index.json');
const COOLDOWN_USUARIO_MS = 8000;           // espera entre pedidos de una misma persona
const MAX_DESCARGAS_A_LA_VEZ = 2;
const MAX_DURACION_S = 1200;                // no descarga videos de más de 20 minutos
const MAX_TAMANO = '30M';
const TIMEOUT_DESCARGA_MS = 60_000;
const TTL_REENVIO_MS = 7 * 24 * 3600 * 1000; // WhatsApp conserva el audio unos días; pasado esto se vuelve a subir
const MAX_CACHE_BYTES = (Number(process.env.PLAY_CACHE_MAX_MB) || 400) * 1048576;
const YTDLP = process.env.YTDLP_BIN || 'yt-dlp';
const YTDLP_EXTRA = (process.env.YTDLP_FLAGS || '').split(' ').filter(Boolean); // ej: export YTDLP_FLAGS="--js-runtimes node"
// m4a liviano (más rápido de bajar y de subir a WhatsApp), sin pasar por ffmpeg
const FORMATO = 'bestaudio[ext=m4a][abr<=70]/bestaudio[ext=m4a][abr<=130]/bestaudio[ext=m4a]/bestaudio';
const SITIOS_PERMITIDOS = /^(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|soundcloud\.com)$/i;

fs.mkdirSync(DIR, { recursive: true });

// ── Índice de caché ────────────────────────────────────────────
let indice = { consultas: {}, audios: {} };
try { indice = { consultas: {}, audios: {}, ...JSON.parse(fs.readFileSync(ARCHIVO_INDICE, 'utf8')) }; } catch { /* primer uso */ }
let temporizadorIndice = null;
function guardarIndice() {
    clearTimeout(temporizadorIndice);
    temporizadorIndice = setTimeout(() => {
        try {
            const tmp = ARCHIVO_INDICE + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(indice), 'utf8');
            fs.renameSync(tmp, ARCHIVO_INDICE);
        } catch (e) { console.error('[PLAY] No se pudo guardar el índice:', e.message); }
    }, 400);
    temporizadorIndice.unref?.();
}

// ── Utilidades ─────────────────────────────────────────────────
const normalizar = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

function esUrl(t) { return /^https?:\/\/\S+$/i.test(t); }

function sitioPermitido(t) {
    try { return SITIOS_PERMITIDOS.test(new URL(t).hostname); } catch { return false; }
}

function idDeYoutube(t) {
    return t.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})(?![\w-])/i)?.[1] || null;
}

function mimeDe(archivo) {
    const ext = path.extname(archivo).toLowerCase();
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.ogg' || ext === '.opus') return 'audio/ogg; codecs=opus';
    return 'audio/mp4';
}

function formatearDuracion(s) {
    s = Math.round(Number(s) || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Ejecuta un programa SIN consola: los argumentos van en una lista, nunca se interpretan
function ejecutar(programa, args, timeout) {
    return new Promise((resolve, reject) => {
        execFile(programa, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (!err) return resolve(stdout);
            if (err.code === 101) return resolve(stdout); // --max-downloads alcanzado: es lo esperado
            err.stderr = stderr;
            reject(err);
        });
    });
}

// ── Descarga (una sola llamada a yt-dlp) ───────────────────────
async function descargarAudio(consulta) {
    const objetivo = esUrl(consulta) ? consulta : `ytsearch3:${consulta}`;
    const args = [
        '--no-playlist', '--no-warnings', '--no-progress', '--no-simulate',
        '-f', FORMATO,
        '--max-filesize', MAX_TAMANO,
        '--match-filter', `duration<=${MAX_DURACION_S}`,
        '--max-downloads', '1',
        '--print', 'after_move:%(id)s\t%(title)s\t%(duration)s\t%(filepath)s',
        '-o', path.join(DIR, '%(id)s.%(ext)s'),
        ...YTDLP_EXTRA,
        '--', objetivo
    ];
    const salida = await ejecutar(YTDLP, args, TIMEOUT_DESCARGA_MS);
    const linea = salida.split('\n').map(l => l.trim()).filter(l => l.includes('\t')).pop();
    if (!linea) throw new Error('SIN_RESULTADOS');
    const [id, titulo, duracion, ruta] = linea.split('\t');
    if (!id || !ruta || !fs.existsSync(ruta)) throw new Error('SIN_RESULTADOS');

    let archivo = path.basename(ruta);
    // Si quedó en un formato que WhatsApp no reproduce bien (webm), se convierte a m4a
    if (!/\.(m4a|mp3|ogg|opus|aac)$/i.test(archivo)) {
        const destino = path.join(DIR, `${id}.m4a`);
        try {
            await ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-i', ruta, '-vn', '-c:a', 'aac', '-b:a', '96k', destino], 45_000);
            fs.unlinkSync(ruta);
            archivo = path.basename(destino);
        } catch { /* sin ffmpeg: se envía tal cual */ }
    }
    return { id, titulo: titulo || id, duracion: Number(duracion) || 0, archivo };
}

function limpiarCache() {
    try {
        const archivos = fs.readdirSync(DIR).filter(f => !f.startsWith('index.json'))
            .map(f => { const st = fs.statSync(path.join(DIR, f)); return { f, size: st.size, t: st.mtimeMs }; });
        let total = archivos.reduce((s, a) => s + a.size, 0);
        if (total > MAX_CACHE_BYTES) {
            for (const a of archivos.sort((x, y) => x.t - y.t)) {
                if (total <= MAX_CACHE_BYTES * 0.8) break;
                fs.unlinkSync(path.join(DIR, a.f)); total -= a.size;
            }
        }
        const existentes = new Set(fs.readdirSync(DIR));
        for (const [id, e] of Object.entries(indice.audios)) if (!existentes.has(e.archivo)) delete indice.audios[id];
        for (const [q, id] of Object.entries(indice.consultas)) if (!indice.audios[id]) delete indice.consultas[q];
        guardarIndice();
    } catch (e) { console.error('[PLAY] Error limpiando la caché:', e.message); }
}

// ── Envío ──────────────────────────────────────────────────────
async function enviarAudio(sock, chatId, msg, entrada) {
    // 1) Reenvío instantáneo: WhatsApp ya tiene el audio, no se vuelve a subir
    if (BufferJSON && entrada.fwd && Date.now() - (entrada.fwdTs || 0) < TTL_REENVIO_MS) {
        try {
            const original = JSON.parse(entrada.fwd, BufferJSON.reviver);
            await sock.sendMessage(chatId, { forward: original }, { quoted: msg });
            return 'reenvio';
        } catch (e) {
            entrada.fwd = null; // si falla, se sube de nuevo desde el archivo
        }
    }
    // 2) Subir el archivo guardado (se transmite desde el disco, sin cargarlo entero en memoria)
    const ruta = path.join(DIR, entrada.archivo);
    const enviado = await sock.sendMessage(chatId, { audio: { url: ruta }, mimetype: mimeDe(ruta), ptt: false }, { quoted: msg });
    if (BufferJSON && enviado?.message?.audioMessage) {
        try {
            entrada.fwd = JSON.stringify({ key: enviado.key, message: enviado.message }, BufferJSON.replacer);
            entrada.fwdTs = Date.now();
        } catch { /* sin reenvío para la próxima */ }
    }
    return 'archivo';
}

// ── Plugin ─────────────────────────────────────────────────────
const ultimoPedido = new Map();   // senderJid -> hora
const enCurso = new Map();        // clave -> Promise (evita bajar dos veces lo mismo a la vez)
let descargasActivas = 0;

export default {
    name: 'play',
    description: 'Envía el audio de una canción de YouTube (rápido, con caché)',
    run: async function (comando, sock, chatId, msg, args, senderJid) {
        const cmd = String(comando || '').toLowerCase();
        if (!ALIAS.includes(cmd)) return;

        const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
        const consulta = args.join(' ').replace(/\s+/g, ' ').trim();

        if (!consulta) return responder('❌ *Ingresa el nombre o enlace.*\nEjemplo: `.play doma`');
        if (consulta.length > 200) return responder('❌ El texto es demasiado largo (máximo 200 caracteres).');
        if (esUrl(consulta) && !sitioPermitido(consulta)) {
            return responder('❌ Solo acepto enlaces de YouTube o SoundCloud.');
        }

        const ahora = Date.now();
        const falta = (ultimoPedido.get(senderJid) || 0) + COOLDOWN_USUARIO_MS - ahora;
        if (falta > 0) return responder(`⏳ Espera *${Math.ceil(falta / 1000)}s* antes de pedir otra canción.`);
        ultimoPedido.set(senderJid, ahora);

        try {
            const idUrl = esUrl(consulta) ? idDeYoutube(consulta) : null;
            const clave = normalizar(consulta);

            // ── Caché: sin llamar a yt-dlp ──
            const idCache = idUrl || indice.consultas[clave];
            const hit = idCache && indice.audios[idCache];
            if (hit && fs.existsSync(path.join(DIR, hit.archivo))) {
                await enviarAudio(sock, chatId, msg, hit);
                guardarIndice();
                return;
            }

            // ── Descarga nueva ──
            const claveCurso = idUrl || clave || consulta;
            let promesa = enCurso.get(claveCurso);
            if (!promesa) {
                if (descargasActivas >= MAX_DESCARGAS_A_LA_VEZ) {
                    return responder('⏳ Hay muchas descargas en curso. Intenta en unos segundos.');
                }
                descargasActivas++;
                promesa = descargarAudio(consulta).finally(() => { descargasActivas--; enCurso.delete(claveCurso); });
                enCurso.set(claveCurso, promesa);
            }
            sock.sendMessage(chatId, { text: '🔎 *Buscando...* 🎧' }, { quoted: msg }).catch(() => {}); // no frena la descarga

            const info = await promesa;
            const entrada = indice.audios[info.id] = { ...(indice.audios[info.id] || {}), archivo: info.archivo, titulo: info.titulo, duracion: info.duracion };
            if (clave) indice.consultas[clave] = info.id;
            const claveTitulo = normalizar(info.titulo);
            if (claveTitulo) indice.consultas[claveTitulo] = info.id;

            sock.sendMessage(chatId, { text: `🎧 *${info.titulo}*\n⏱️ ${formatearDuracion(info.duracion)}` }, { quoted: msg }).catch(() => {});
            await enviarAudio(sock, chatId, msg, entrada);
            guardarIndice();
            limpiarCache();
        } catch (error) {
            console.error('❌ Error en play:', error.message);
            ultimoPedido.delete(senderJid);
            let texto = '⚠️ No pude conseguir esa canción. Intenta con otro nombre o enlace.';
            if (error.code === 'ENOENT') texto = '⚠️ yt-dlp no está instalado en el bot. En Termux: `pkg install yt-dlp`.';
            else if (error.killed) texto = '⏱️ La descarga tardó demasiado. Intenta de nuevo o con otra canción.';
            else if (error.message === 'SIN_RESULTADOS') texto = '⚠️ No encontré resultados (o el video dura más de 20 minutos).';
            await responder(texto).catch(() => {});
        }
    }
};
