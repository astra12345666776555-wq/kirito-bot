import fs from 'fs';
import zlib from 'zlib';

// ───────────── Ajustes ─────────────
const INTENTOS = 6;             // intentos por partida
const PREMIO_BASE = 300;        // monedas por acertar
const PREMIO_POR_INTENTO = 150; // extra por cada intento que te sobró
const EXPIRA_MIN = 15;          // minutos sin jugar y la partida se cierra

// ───────────── Diccionario (5 letras, sin tildes; la Ñ se conserva) ─────────────
const BASE = `
ABEJA ABRIL ABUSO ACASO ACIDO ACTOR ADIOS AGUDO AGUJA AHORA AIRES ALAMO ALBUM ALGAS ALTAR ALTOS AMADO AMIGO ANCHO ANDAR ANGEL ANTES ANUAL APOYO AREAS ARBOL ARENA ARROZ ARTES ASADO ATAJO ATLAS AUDIO AUTOR AVION AVISO AYUDA AZOTE
BAILE BAJAR BAJOS BALAS BANCO BANDA BARCO BARRO BASES BASTA BEBER BESAR BESOS BICHO BLUSA BOCAS BODAS BOLSA BOMBA BORDE BOTAS BRAVO BRAZO BREVE BRISA BROMA BRUJA BRUJO BUENA BUENO BURRO BUSCA
CABLE CABRA CAIDA CAJAS CALLE CALMA CALOR CAMAS CAMPO CANAL CANAS CANTO CARAS CARGA CARNE CARRO CARTA CASAS CASCO CAUSA CEBRA CELDA CENAR CERCA CERDO CIELO CINCO CINTA CIRCO CITAR CLARO CLASE CLAVE CLIMA COBRE COCER COCHE COJIN COLAS COLOR COMER CONDE COPAS CORAL CORTE COSAS COSTA CREAR CRUCE CUERO CULPA CURSO CURVA
DADOS DAMAS DEBER DEDOS DEJAR DELTA DENSO DIETA DICHA DIGNO DIOSA DISCO DOLOR DONDE DOSIS DRAMA DUCHA DUDAR DUEÑO DULCE DUROS
ENERO ENTRE EPOCA ERROR ESTAR ETAPA EXITO EXTRA
FALDA FALSO FALTA FARSA FELIZ FERIA FIBRA FICHA FIERA FIJAR FILAS FINAL FIRMA FLACO FLORA FLUIR FONDO FORMA FRASE FRENO FRESA FRUTA FUEGO FUERA FUMAR FUNDA
GAFAS GALLO GANAR GANAS GASTO GATOS GENIO GENTE GIRAR GLOBO GOLPE GORDO GORRA GRADO GRAMO GRANO GRASA GRAVE GRIFO GRITO GRUPO GUAPO GUIAR GUSTO
HABLA HACER HACHA HADAS HARTO HASTA HECHO HELAR HEROE HIELO HIJOS HILOS HOGAR HOJAS HONOR HORAS HOTEL HOYOS HUEVO HUIDA HUMOR
IDEAL IDEAS IGUAL IMPAR ISLAS
JABON JAMAS JAULA JOVEN JUEGO JUGAR JUGOS JUNIO JUNTO JURAR JUSTO
KARMA KOALA
LABIO LADOS LAGOS LAPIZ LARGO LATAS LAVAR LECHE LEGAL LEJOS LENTO LETRA LIBRE LIBRO LIDER LIMON LINDO LINEA LISTA LLAVE LLENO LLEVA LLORA LOBOS LOCAL LOCOS LOGRO LUCES LUCHA LUEGO LUGAR LUNAS
MADRE MAGIA MAGOS MALAS MALOS MANGA MANOS MAPAS MARCA MARES MARZO MASAS MATAR MAYOR MEDIA MEDIO MEJOR MENOR MENOS MENTE MESAS METAL METRO MIEDO MILES MIRAR MISMO MITAD MODAS MODOS MOLDE MONJE MONTE MORAL MORIR MOTOR MOVER MUCHO MUDAR MUJER MUNDO MURAL MUROS MUSEO MUSLO
NACER NADIE NARIZ NATAL NAVES NEGRO NIEVE NIÑAS NIÑOS NOBLE NOCHE NORTE NOTAS NOVIA NOVIO NUBES NUEVE NUEVO NUNCA
OBRAS OIDOS OJALA OLIVO ONDAS OPERA ORDEN OSADO OSITO OTOÑO OXIDO
PADRE PAGAR PALAS PANAL PANES PAPEL PARED PARES PARTE PASAR PASOS PASTA PATIO PATOS PAUSA PAVOS PECES PEDIR PEGAR PELEA PELOS PENAS PERLA PERRO PESAR PESCA PESOS PIANO PICAR PILAS PINTA PISOS PISTA PLAGA PLANO PLATA PLATO PLAYA PLAZA PLAZO PLOMO PLUMA POBRE PODER POEMA POETA POLLO POLVO PONER POZOS PRADO PRESA PRIMA PRIMO PRISA PULPO PUNTO
QUESO QUIEN
RADIO RAMAS RANAS RASGO RATAS RATON RAYAS RAYOS RAZAS RAZON REGAR REINA REINO RELOJ REMAR RENTA RESTO RETOS REYES RISAS RITMO ROBAR ROBLE ROCAS RODAR ROPAS ROSAS RUEDA RUIDO RUMBO RURAL
SABER SABIO SABOR SACAR SALAS SALIR SALSA SALTO SALUD SANTO SECAR SELVA SEÑAL SERES SERIE SIGLO SIGNO SILLA SITIO SOBRE SOCIO SOLAR SOLOS SOÑAR SONAR SUAVE SUBIR SUELO SUEÑO SUMAR SUPER SURCO
TABLA TACOS TALLA TANTO TAPAS TARDE TAREA TAZAS TECHO TECLA TEMAS TEMOR TENER TENIS TIBIO TIGRE TINTA TIPOS TIRAR TOCAR TODOS TOMAR TONTO TORRE TORTA TOROS TOSER TOTAL TRAJE TRAER TRAMO TRATO TRIGO TRIBU TRONO TRUCO TUMBA TURNO TUTOR
UNICO UNION USADO
VACAS VACIO VALER VALLE VALOR VAPOR VASOS VECES VELAS VENIR VENTA VERDE VERSO VIAJE VIDAS VIDEO VIEJO VIGOR VINOS VISTA VIUDA VIVIR VIVOS VOCAL VOLAR VOTAR VUELO
YEGUA ZONAS ZORRO ZURDO
`;

const norm = (t) =>
    String(t || "")
        .replace(/ñ/gi, "#")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/#/g, "Ñ")
        .toUpperCase()
        .trim();

function cargarDiccionario() {
    const set = new Set(BASE.split(/\s+/).map(norm).filter((w) => /^[A-ZÑ]{5}$/.test(w)));
    try {
        // Opcional: agrega tus propias palabras en database/palabras.txt (una por línea)
        if (fs.existsSync("database/palabras.txt")) {
            for (const l of fs.readFileSync("database/palabras.txt", "utf8").split(/\s+/)) {
                const w = norm(l);
                if (/^[A-ZÑ]{5}$/.test(w)) set.add(w);
            }
        }
    } catch {}
    return set;
}

// ───────────── Lógica del juego ─────────────
global.__wordle ||= new Map(); // chatId -> partida (en memoria, no en la DB)
const partidas = global.__wordle;

const simbolo = (db) => db?.global?.moneda?.simbolo || "🪙";
const fmt = (n) => Number(n || 0).toLocaleString("es-PE");

function evaluar(secreta, intento) {
    const r = Array(5).fill("x");
    const resto = {};
    for (let i = 0; i < 5; i++) {
        if (intento[i] === secreta[i]) r[i] = "g";
        else resto[secreta[i]] = (resto[secreta[i]] || 0) + 1;
    }
    for (let i = 0; i < 5; i++) {
        if (r[i] !== "g" && resto[intento[i]] > 0) { r[i] = "y"; resto[intento[i]]--; }
    }
    return r;
}

// Suma a la CARTERA DEL GRUPO (db.grupos[chat].usuarios[jid].cartera). No toca la economía global.
function acreditar(db, chatId, jid, monto) {
    db.grupos ||= {};
    db.grupos[chatId] ||= {};
    db.grupos[chatId].usuarios ||= {};
    const u = (db.grupos[chatId].usuarios[jid] ||= { cartera: 0, banco: 0 });
    u.cartera = (Number(u.cartera) || 0) + monto;
    u.wordleGanadas = (u.wordleGanadas || 0) + 1;
    return { saldo: u.cartera, ganadas: u.wordleGanadas };
}

function armarTimer(sock, chatId) {
    const p = partidas.get(chatId);
    if (!p) return;
    clearTimeout(p.timer);
    p.timer = setTimeout(async () => {
        if (partidas.get(chatId) !== p) return;
        partidas.delete(chatId);
        try { await sock.sendMessage(chatId, { text: `⌛ Se acabó el tiempo. La palabra era *${p.palabra}*.` }); } catch {}
    }, EXPIRA_MIN * 60000);
    p.timer.unref?.();
}

// ───────────── Imagen (PNG hecho a mano, sin dependencias) ─────────────
const FONT = {
    A:[".###.","#...#","#...#","#####","#...#","#...#","#...#"],
    B:["####.","#...#","#...#","####.","#...#","#...#","####."],
    C:[".###.","#...#","#....","#....","#....","#...#",".###."],
    D:["####.","#...#","#...#","#...#","#...#","#...#","####."],
    E:["#####","#....","#....","####.","#....","#....","#####"],
    F:["#####","#....","#....","####.","#....","#....","#...."],
    G:[".###.","#...#","#....","#.###","#...#","#...#",".###."],
    H:["#...#","#...#","#...#","#####","#...#","#...#","#...#"],
    I:["#####","..#..","..#..","..#..","..#..","..#..","#####"],
    J:["..###","...#.","...#.","...#.","...#.","#..#.",".##.."],
    K:["#...#","#..#.","#.#..","##...","#.#..","#..#.","#...#"],
    L:["#....","#....","#....","#....","#....","#....","#####"],
    M:["#...#","##.##","#.#.#","#.#.#","#...#","#...#","#...#"],
    N:["#...#","##..#","##..#","#.#.#","#..##","#..##","#...#"],
    Ñ:[".#.#.","##..#","##..#","#.#.#","#..##","#..##","#...#"],
    O:[".###.","#...#","#...#","#...#","#...#","#...#",".###."],
    P:["####.","#...#","#...#","####.","#....","#....","#...."],
    Q:[".###.","#...#","#...#","#...#","#.#.#","#..#.",".##.#"],
    R:["####.","#...#","#...#","####.","#.#..","#..#.","#...#"],
    S:[".####","#....","#....",".###.","....#","....#","####."],
    T:["#####","..#..","..#..","..#..","..#..","..#..","..#.."],
    U:["#...#","#...#","#...#","#...#","#...#","#...#",".###."],
    V:["#...#","#...#","#...#","#...#","#...#",".#.#.","..#.."],
    W:["#...#","#...#","#...#","#.#.#","#.#.#","##.##","#...#"],
    X:["#...#","#...#",".#.#.","..#..",".#.#.","#...#","#...#"],
    Y:["#...#","#...#",".#.#.","..#..","..#..","..#..","..#.."],
    Z:["#####","....#","...#.","..#..",".#...","#....","#####"]
};

const COL = {
    fondo: [18, 18, 19], borde: [58, 58, 60], g: [83, 141, 78], y: [181, 159, 59],
    x: [58, 58, 60], tecla: [129, 131, 132], blanco: [255, 255, 255]
};

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(tipo, datos) {
    const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
    const td = Buffer.concat([Buffer.from(tipo), datos]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}
function codificarPNG(w, h, px) {
    const fila = w * 3 + 1;
    const raw = Buffer.alloc(fila * h);
    for (let y = 0; y < h; y++) { raw[y * fila] = 0; px.copy(raw, y * fila + 1, y * w * 3, (y + 1) * w * 3); }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))
    ]);
}

function dibujarTablero(p) {
    const W = 480, H = 730;
    const px = Buffer.alloc(W * H * 3);
    const rect = (x, y, w, h, c) => {
        const fila = Buffer.alloc(w * 3);
        for (let i = 0; i < w; i++) { fila[i * 3] = c[0]; fila[i * 3 + 1] = c[1]; fila[i * 3 + 2] = c[2]; }
        for (let yy = y; yy < y + h; yy++) if (yy >= 0 && yy < H) fila.copy(px, (yy * W + x) * 3);
    };
    const letra = (x, y, ch, s, c) => {
        const g = FONT[ch]; if (!g) return;
        for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r][k] === "#") rect(x + k * s, y + r * s, s, s, c);
    };
    rect(0, 0, W, H, COL.fondo);

    // Tablero
    const T = 80, G = 8, X0 = 24, Y0 = 24;
    for (let r = 0; r < INTENTOS; r++) {
        for (let c = 0; c < 5; c++) {
            const x = X0 + c * (T + G), y = Y0 + r * (T + G);
            const it = p.intentos[r];
            if (it) {
                rect(x, y, T, T, COL[it.res[c]]);
                letra(x + (T - 35) / 2, y + (T - 49) / 2, it.palabra[c], 7, COL.blanco);
            } else {
                rect(x, y, T, T, COL.borde);
                rect(x + 3, y + 3, T - 6, T - 6, COL.fondo);
            }
        }
    }

    // Teclado con el estado de cada letra
    const mejor = {};
    const prio = { x: 1, y: 2, g: 3 };
    for (const it of p.intentos) for (let i = 0; i < 5; i++) {
        const l = it.palabra[i];
        if (!mejor[l] || prio[it.res[i]] > prio[mejor[l]]) mejor[l] = it.res[i];
    }
    const filas = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];
    const KW = 40, KH = 44, KG = 6;
    filas.forEach((fila, i) => {
        const total = fila.length * KW + (fila.length - 1) * KG;
        let x = Math.floor((W - total) / 2);
        const y = 572 + i * 50;
        for (const l of fila) {
            const col = mejor[l] ? COL[mejor[l]] : COL.tecla;
            rect(x, y, KW, KH, col);
            letra(x + (KW - 15) / 2, y + (KH - 21) / 2, l, 3, COL.blanco);
            x += KW + KG;
        }
    });
    return codificarPNG(W, H, px);
}

// ───────────── Envío ─────────────
async function enviarTablero(sock, chatId, p, caption, mentions = []) {
    await sock.sendMessage(chatId, { image: dibujarTablero(p), caption, mentions });
}

const tag = (jid) => `@${String(jid).split("@")[0].split(":")[0]}`;

async function reaccionar(sock, msg, emoji) {
    try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
}

async function iniciar(sock, chatId, msg, senderJid, db) {
    const dic = cargarDiccionario();
    const lista = [...dic];
    const palabra = lista[Math.floor(Math.random() * lista.length)];
    const p = { palabra, intentos: [], inicia: senderJid, dic };
    partidas.set(chatId, p);
    armarTimer(sock, chatId);
    const max = PREMIO_BASE + (INTENTOS - 1) * PREMIO_POR_INTENTO;
    await enviarTablero(sock, chatId, p,
        `🧩 *ADIVINA LA PALABRA*\n\n` +
        `Palabra de *5 letras* · *${INTENTOS}* intentos · entre todo el grupo.\n` +
        `✍️ Escribe una palabra de 5 letras directo en el chat.\n\n` +
        `🟩 letra y lugar correctos\n🟨 está, pero en otro lugar\n⬛ no está\n\n` +
        `${simbolo(db)} Premio para quien la acierte: hasta *${fmt(max)}* en su cartera de este grupo.`,
        [senderJid]);
}

// Procesa un intento. Devuelve true si el mensaje fue tratado como intento.
async function intentar(sock, chatId, msg, senderJid, texto, db, guardarDB) {
    const p = partidas.get(chatId);
    if (!p) return false;
    const w = norm(texto);
    if (!/^[A-ZÑ]{5}$/.test(w)) return false;
    if (!p.dic.has(w)) { await reaccionar(sock, msg, "❌"); return false; } // no está en el diccionario
    if (p.intentos.some((i) => i.palabra === w)) { await reaccionar(sock, msg, "🔁"); return true; }

    const res = evaluar(p.palabra, w);
    p.intentos.push({ palabra: w, res, jid: senderJid });
    const n = p.intentos.length;

    if (w === p.palabra) {
        clearTimeout(p.timer);
        partidas.delete(chatId);
        const premio = PREMIO_BASE + (INTENTOS - n) * PREMIO_POR_INTENTO;
        const cartera = acreditar(db, chatId, senderJid, premio);
        if (typeof guardarDB === "function") guardarDB();
        await enviarTablero(sock, chatId, p,
            `🎉 ¡${tag(senderJid)} adivinó la palabra *${p.palabra}* en el intento ${n}/${INTENTOS}!\n\n` +
            `${simbolo(db)} +${fmt(premio)} en su cartera de este grupo\n` +
            `💰 Cartera: ${fmt(cartera.saldo)}\n` +
            `🏆 Palabras ganadas aquí: ${cartera.ganadas}\n\n` +
            `Escribe *.wordle* para jugar otra.`, [senderJid]);
        return true;
    }

    if (n >= INTENTOS) {
        clearTimeout(p.timer);
        partidas.delete(chatId);
        await enviarTablero(sock, chatId, p, `😵 Se acabaron los intentos. La palabra era *${p.palabra}*.\n\nEscribe *.wordle* para intentar otra.`);
        return true;
    }

    armarTimer(sock, chatId);
    await enviarTablero(sock, chatId, p,
        `${tag(senderJid)} probó *${w}*\nIntento ${n}/${INTENTOS} · quedan ${INTENTOS - n}`, [senderJid]);
    return true;
}

// ───────────── Hook: los intentos se escriben sin prefijo ─────────────
async function onMessage({ sock, msg, chatId, senderJid, texto, db, guardarDB }) {
    if (!partidas.has(chatId)) return false;
    const t = String(texto || "").trim();
    if (!/^[A-Za-zÑñÁÉÍÓÚÜáéíóúü]{5}$/.test(t)) return false;
    return await intentar(sock, chatId, msg, senderJid, t, db, guardarDB);
}

// ───────────── Comandos ─────────────
export default {
    name: "wordle",
    description: "Minijuego: adivina la palabra de 5 letras con tablero en imagen. El premio va a la cartera del grupo.",
    onMessage,

    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, extra) => {
        const cmd = (comando || "").toLowerCase();
        if (!["wordle", "adivina", "adivinar", "palabra"].includes(cmd)) return;

        const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
        if (!chatId.endsWith("@g.us")) return responder("⚠️ Este juego solo funciona en grupos.");

        const sub = (args[0] || "").toLowerCase();
        const p = partidas.get(chatId);

        if (["rendirse", "stop", "terminar", "cancelar"].includes(sub)) {
            if (!p) return responder("⚠️ No hay ninguna partida activa.");
            let puede = !!extra?.esDueno || p.inicia === senderJid;
            if (!puede) {
                const meta = await sock.groupMetadata(chatId).catch(() => null);
                const num = String(senderJid).split("@")[0].replace(/[^0-9]/g, "");
                puede = !!meta?.participants?.find((x) =>
                    (x.id === senderJid || x.lid === senderJid || String(x.phoneNumber || "").split("@")[0] === num) && x.admin);
            }
            if (!puede) return responder("❌ Solo quien empezó la partida o un admin puede terminarla.");
            clearTimeout(p.timer);
            partidas.delete(chatId);
            return responder(`🏳️ Partida terminada. La palabra era *${p.palabra}*.`);
        }

        if (/^[A-Za-zÑñÁÉÍÓÚÜáéíóúü]{5}$/.test(args[0] || "")) {
            if (!p) return responder(`⚠️ No hay partida activa. Escribe *${prefijoUsado}wordle* para empezar.`);
            const ok = await intentar(sock, chatId, msg, senderJid, args[0], db, guardarDB);
            if (!ok) return responder("❌ Esa palabra no está en mi diccionario.");
            return;
        }

        if (p) {
            return enviarTablero(sock, chatId, p,
                `🧩 Ya hay una partida en curso · Intento ${p.intentos.length}/${INTENTOS}\nEscribe una palabra de 5 letras para jugar.\n(*${prefijoUsado}wordle rendirse* para terminarla)`);
        }
        return iniciar(sock, chatId, msg, senderJid, db);
    }
};
