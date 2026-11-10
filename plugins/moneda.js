import zlib from "zlib";

// ============================================================
// 🎨 Motor de imagen propio (sin librerías): genera un PNG A4 (800x1131) en estilo pixel
// ============================================================
const W = 800, H = 1131;
const C = {
    fondoTop: [17, 18, 34], fondoBot: [44, 30, 72],
    oro: [212, 175, 55], oroOscuro: [107, 90, 42], blanco: [240, 240, 248],
    lila: [160, 150, 220], gris: [156, 163, 175], verde: [74, 222, 128],
    rojo: [248, 113, 113], tarjeta: [45, 40, 68], negro: [10, 12, 20]
};

// Fuente pixel 5x7 (cada número es una fila de 5 bits)
const FUENTE = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
    D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
    J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
    P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
    V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
    3: [30, 1, 1, 14, 1, 1, 30], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
    6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
    9: [14, 17, 17, 15, 1, 2, 12],
    " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12], ",": [0, 0, 0, 0, 12, 4, 8],
    ":": [0, 12, 12, 0, 12, 12, 0], "/": [1, 1, 2, 4, 8, 16, 16], "-": [0, 0, 0, 31, 0, 0, 0],
    "+": [0, 4, 4, 31, 4, 4, 0], "!": [4, 4, 4, 4, 4, 0, 4], "?": [14, 17, 1, 2, 4, 0, 4],
    "%": [24, 25, 2, 4, 8, 19, 3], "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8],
    "'": [4, 4, 8, 0, 0, 0, 0], ">": [16, 8, 4, 2, 4, 8, 16], "<": [1, 2, 4, 8, 4, 2, 1], "=": [0, 0, 31, 0, 31, 0, 0]
};

// Monedas pixel (11 columnas): cara = carita, sello = estrella
const SIMBOLOS = {
    cara: ["...#####...", "..#.....#..", ".#.......#.", "#...#.#...#", "#...#.#...#", "#.........#", "#.#.....#.#", ".#.#####.#.", "..#.....#..", "...#####..."],
    sello: [".....#.....", ".....#.....", "....###....", "###########", ".#########.", "..#######..", "..#######..", ".####.####.", ".###...###.", ".#.......#."]
};

function lienzo() {
    const d = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
        const t = y / (H - 1);
        const r = Math.round(C.fondoTop[0] + (C.fondoBot[0] - C.fondoTop[0]) * t);
        const g = Math.round(C.fondoTop[1] + (C.fondoBot[1] - C.fondoTop[1]) * t);
        const b = Math.round(C.fondoTop[2] + (C.fondoBot[2] - C.fondoTop[2]) * t);
        for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    }
    return d;
}
function rect(d, x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
        for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
            const i = (yy * W + xx) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
        }
    }
}
const marco = (d, x, y, w, h, t, c) => { rect(d, x, y, w, t, c); rect(d, x, y + h - t, w, t, c); rect(d, x, y, t, h, c); rect(d, x + w - t, y, t, h, c); };
function rombo(d, cx, cy, r, c) { for (let dy = -r; dy <= r; dy++) { const hw = r - Math.abs(dy); rect(d, cx - hw, cy + dy, hw * 2 + 1, 1, c); } }

const limpio = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const anchoTexto = (s, e) => s.length * 6 * e - e;
function texto(d, str, x, y, e, c, alinear = "izq") {
    str = limpio(str);
    const w = anchoTexto(str, e);
    let cx = alinear === "centro" ? x - w / 2 : alinear === "der" ? x - w : x;
    for (const ch of str) {
        const g = FUENTE[ch] || FUENTE["?"];
        for (let f = 0; f < 7; f++) for (let k = 0; k < 5; k++) if (g[f] & (1 << (4 - k))) rect(d, cx + k * e, y + f * e, e, e, c);
        cx += 6 * e;
    }
}
function tarjeta(d, x, y, w, h, barra) {
    rect(d, x, y, w, h, C.tarjeta); marco(d, x, y, w, h, 2, C.oroOscuro); rect(d, x, y, 8, h, barra);
}
function dibujarMoneda(d, cx, cy, tipo) {
    const N = 20, e = 11, ox = cx - (N * e) / 2, oy = cy - (N * e) / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const dist = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2);
        if (dist > N / 2) continue;
        let col = dist > N / 2 - 1.6 ? [154, 123, 28] : [212, 175, 55];
        if (dist < N / 2 - 1.6 && dist > N / 2 - 3 && (i + j) % 2 === 0) col = [201, 164, 48];
        if (i + 0.5 < N / 2 - 2 && j + 0.5 < N / 2 - 2 && dist > N / 2 - 6 && dist < N / 2 - 3.2) col = [242, 214, 117];
        rect(d, ox + i * e, oy + j * e, e, e, col);
    }
    const s = SIMBOLOS[tipo], sx = cx - (11 * e) / 2, sy = cy - (s.length * e) / 2;
    s.forEach((fila, j) => [...fila].forEach((ch, i) => { if (ch === "#") rect(d, sx + i * e, sy + j * e, e, e, [138, 109, 20]); }));
}

function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = (crc ^ buf[n]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, datos) {
    const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
    const t = Buffer.from(tipo, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
    return Buffer.concat([len, t, datos, crc]);
}
function aPNG(d) {
    const raw = Buffer.alloc((W * 4 + 1) * H);
    for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; d.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}

const num = (n) => Number(n || 0).toLocaleString("en-US");

function tarjetaMoneda(p) {
    const d = lienzo();
    // marco dorado doble + rombos en las esquinas
    marco(d, 20, 20, W - 40, H - 40, 4, C.oro);
    marco(d, 34, 34, W - 68, H - 68, 2, C.oroOscuro);
    for (const [x, y] of [[28, 28], [W - 28, 28], [28, H - 28], [W - 28, H - 28]]) rombo(d, x, y, 9, C.oro);

    // encabezado
    texto(d, "MONEDA", W / 2, 62, 8, C.oro, "centro");
    rombo(d, 190, 90, 11, C.oro); rombo(d, W - 190, 90, 11, C.oro);
    texto(d, p.jugador, W / 2, 140, 6, C.blanco, "centro");
    texto(d, "CARA O SELLO", W / 2, 192, 3, C.oro, "centro");
    rect(d, 80, 235, 640, 2, C.oroOscuro);

    // 1) la moneda
    tarjeta(d, 80, 255, 640, 365, p.gano ? C.verde : C.oro);
    dibujarMoneda(d, W / 2, 385, p.resultado);
    texto(d, "CAYO " + p.resultado, W / 2, 520, 6, C.blanco, "centro");
    texto(d, "TU ELECCION: " + p.eleccion, W / 2, 580, 3, C.lila, "centro");

    // 2) resultado
    const colRes = p.gano ? C.verde : C.rojo;
    tarjeta(d, 80, 635, 640, 120, colRes);
    texto(d, p.gano ? "GANASTE" : "PERDISTE", 112, 662, 6, colRes);
    texto(d, (p.gano ? "+" : "-") + num(p.monto), 692, 662, 6, C.oro, "der");
    texto(d, "APUESTA " + num(p.monto), 112, 718, 3, C.lila);

    // 3) cartera
    tarjeta(d, 80, 770, 640, 90, C.oro);
    texto(d, "CARTERA", 112, 786, 3, C.lila);
    texto(d, num(p.cartera), 112, 815, 5, C.blanco);

    // 4) misión (igual que en la tarjeta de misiones)
    const m = p.mision, ok = m.completado;
    tarjeta(d, 80, 878, 640, 152, ok ? C.verde : C.oro);
    texto(d, "MAESTRO DEL AZAR", 112, 894, 4, C.blanco);
    texto(d, "GANA " + m.meta + " VECES EN .MONEDA", 112, 930, 2, C.lila);
    rect(d, 112, 956, 576, 18, C.negro); marco(d, 112, 956, 576, 18, 2, C.oroOscuro);
    const lleno = Math.round(572 * Math.min(1, m.progreso / m.meta));
    if (lleno > 0) rect(d, 114, 958, lleno, 14, C.verde);
    texto(d, Math.min(m.progreso, m.meta) + "/" + m.meta, 112, 982, 3, C.blanco);
    texto(d, ok ? "COMPLETADO" : "PENDIENTE", 688, 982, 3, ok ? C.verde : C.gris, "der");
    texto(d, "PREMIO " + num(m.recompensa), 112, 1008, 2, C.oro);

    texto(d, "KIRITO BOT", W / 2, 1056, 4, [120, 98, 46], "centro");
    return aPNG(d);
}

// ============================================================
// 🪙 Plugin
// ============================================================
export default {
    name: "moneda",
    description: "Cara o sello con tarjeta en imagen A4 y misión de victorias",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["moneda", "carasello", "cs"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        let eleccion = (args[0] || "").toLowerCase().trim();
        let montoStr = args[1];

        if (!["cara", "sello"].includes(eleccion)) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso incorrecto. Debes elegir cara o sello.\nEjemplo: \`${prefijoUsado}moneda cara 100\`` }, { quoted: msg });
        }

        let monto = parseInt(montoStr);
        if (isNaN(monto) || monto <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Ingresa una cantidad válida de dinero a apostar.\nEjemplo: \`${prefijoUsado}moneda cara 100\`` }, { quoted: msg });
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios) db.grupos[chatId].usuarios = {};
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
        }
        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if ((uGrupo.cartera || 0) < monto) {
            return sock.sendMessage(chatId, { text: `⚠️ No tienes suficiente dinero en tu cartera local. Tienes *${formatoMoneda(uGrupo.cartera || 0)}*.` }, { quoted: msg });
        }

        if (!db.usuarios) db.usuarios = {};
        if (!db.global) db.global = {};
        if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;

        if (!db.usuarios[senderJid]) {
            db.global.contadorUsuarios++;
            db.usuarios[senderJid] = { idUnico: String(db.global.contadorUsuarios).padStart(3, '0') };
            guardarDB();
        } else if (!db.usuarios[senderJid].idUnico) {
            db.global.contadorUsuarios++;
            db.usuarios[senderJid].idUnico = String(db.global.contadorUsuarios).padStart(3, '0');
            guardarDB();
        }

        let uGlobal = db.usuarios[senderJid];
        let numeroSeco = senderJid.replace(/[^0-9]/g, '');

        let identificadorJugador = uGlobal.nombreCustom || uGlobal.alias;
        if (!identificadorJugador) {
            identificadorJugador = uGlobal.idUnico ? `User${uGlobal.idUnico}` : numeroSeco;
        }

        let resultado = Math.random() < 0.5 ? "cara" : "sello";
        let gano = (eleccion === resultado);

        // Inicializar estructura de misiones si no existe
        if (!uGrupo.misiones) {
            uGrupo.misiones = {};
        }
        if (!uGrupo.misiones.moneda) {
            uGrupo.misiones.moneda = { progreso: 0, meta: 3, completado: false, recompensa: 6000 };
        }

        let estadoProgresoTexto = "_Misión actualizada_";

        if (gano) {
            uGrupo.cartera += monto;
            // Sumar progreso a la misión independiente de ganar en la moneda
            let mMoneda = uGrupo.misiones.moneda;
            if (!mMoneda.completado) {
                mMoneda.progreso += 1;
                if (mMoneda.progreso >= mMoneda.meta) {
                    mMoneda.completado = true;
                    uGrupo.cartera += mMoneda.recompensa; // Premio extra al completar la misión
                    estadoProgresoTexto = `_¡Misión completada! Ganaste ${formatoMoneda(mMoneda.recompensa)} extra_`;
                } else {
                    estadoProgresoTexto = `_Progreso de misión: ${mMoneda.progreso}/${mMoneda.meta} victorias_`;
                }
            }
        } else {
            uGrupo.cartera -= monto;
            estadoProgresoTexto = "_Fallaste, sin avance en misión_";
        }

        guardarDB();

        // 🖼️ Tarjeta en imagen A4 (si algo fallara al dibujarla, se envía el texto de siempre)
        try {
            const png = tarjetaMoneda({
                jugador: identificadorJugador, eleccion: eleccion.toUpperCase(), resultado, gano, monto,
                cartera: uGrupo.cartera, mision: uGrupo.misiones.moneda
            });
            return await sock.sendMessage(chatId, { image: png }, { quoted: msg });
        } catch (e) {
            console.error("❌ No pude dibujar la imagen de moneda:", e?.message || e);
        }

        let txtMoneda = `╭━━━ 🅲 ❮ ᴄᴀʀᴀ ᴏ ꜱᴇʟʟᴏ (ʟᴏᴄᴀʟ) ❯ 🅲 ━━━╮\n`;
        txtMoneda += `┃\n`;
        txtMoneda += `┃ ❖ ᴊᴜɢᴀᴅᴏʀ » *${identificadorJugador}*\n`;
        txtMoneda += `┃ ✰ ᴇʟᴇᴄᴄɪóɴ » *${eleccion.toUpperCase()}*\n`;
        txtMoneda += `┃ ✦ ᴄᴀʏó » *${resultado.toUpperCase()}*\n`;
        txtMoneda += `┃\n`;
        txtMoneda += `┃ ❀ ʀᴇꜱᴜʟᴛᴀᴅᴏ » ${gano ? '*¡Acertaste!* Ganaste *' + formatoMoneda(monto) + '*' : '*Fallaste.* Perdiste *' + formatoMoneda(monto) + '*'}.\n`;
        txtMoneda += `┃\n`;
        txtMoneda += `> ❖ ᴘʀᴏɢʀᴇꜱᴏ » ${estadoProgresoTexto}\n`;
        txtMoneda += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txtMoneda }, { quoted: msg });
    }
};
