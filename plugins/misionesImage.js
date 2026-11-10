import os from "os";
import path from "path";
import * as JimpModule from "jimp";

// Compatible con jimp v1.x ({ Jimp }) y v0.x (export por defecto CJS)
const Jimp = JimpModule.Jimp || JimpModule.default?.Jimp || JimpModule.default;

// Formato A4 vertical (proporción 1 : 1.414)
const W = 800;
const H = 1131;

const C_ORO = [212, 175, 55];
const C_ORO_SUAVE = [120, 98, 40];
const C_ETIQUETA = [165, 155, 210];
const C_BLANCO = [240, 240, 250];
const C_VERDE = [74, 222, 128];
const C_VERDE_SUAVE = [30, 100, 60];
const C_GRIS = [160, 165, 180];
const C_OSCURO = [20, 22, 36];

const FUENTE = {
    A: ["01110","10001","10001","11111","10001","10001","10001"],
    B: ["11110","10001","10001","11110","10001","10001","11110"],
    C: ["01110","10001","10000","10000","10000","10001","01110"],
    D: ["11110","10001","10001","10001","10001","10001","11110"],
    E: ["11111","10000","10000","11110","10000","10000","11111"],
    F: ["11111","10000","10000","11110","10000","10000","10000"],
    G: ["01110","10001","10000","10111","10001","10001","01111"],
    H: ["10001","10001","10001","11111","10001","10001","10001"],
    I: ["01110","00100","00100","00100","00100","00100","01110"],
    J: ["00111","00010","00010","00010","00010","10010","01100"],
    K: ["10001","10010","10100","11000","10100","10010","10001"],
    L: ["10000","10000","10000","10000","10000","10000","11111"],
    M: ["10001","11011","10101","10101","10001","10001","10001"],
    N: ["10001","11001","10101","10011","10001","10001","10001"],
    O: ["01110","10001","10001","10001","10001","10001","01110"],
    P: ["11110","10001","10001","11110","10000","10000","10000"],
    Q: ["01110","10001","10001","10001","10101","10010","01101"],
    R: ["11110","10001","10001","11110","10100","10010","10001"],
    S: ["01111","10000","10000","01110","00001","00001","11110"],
    T: ["11111","00100","00100","00100","00100","00100","00100"],
    U: ["10001","10001","10001","10001","10001","10001","01110"],
    V: ["10001","10001","10001","10001","10001","01010","00100"],
    W: ["10001","10001","10001","10101","10101","11011","10001"],
    X: ["10001","10001","01010","00100","01010","10001","10001"],
    Y: ["10001","10001","01010","00100","00100","00100","00100"],
    Z: ["11111","00001","00010","00100","01000","10000","11111"],
    "0": ["01110","10001","10011","10101","11001","10001","01110"],
    "1": ["00100","01100","00100","00100","00100","00100","01110"],
    "2": ["01110","10001","00001","00010","00100","01000","11111"],
    "3": ["11110","00001","00001","01110","00001","00001","11110"],
    "4": ["00010","00110","01010","10010","11111","00010","00010"],
    "5": ["11111","10000","11110","00001","00001","10001","01110"],
    "6": ["00110","01000","10000","11110","10001","10001","01110"],
    "7": ["11111","00001","00010","00100","01000","01000","01000"],
    "8": ["01110","10001","10001","01110","10001","10001","01110"],
    "9": ["01110","10001","10001","01111","00001","00010","01100"],
    ".": ["00000","00000","00000","00000","00000","01100","01100"],
    ",": ["00000","00000","00000","00000","01100","00100","01000"],
    ":": ["00000","01100","01100","00000","01100","01100","00000"],
    "-": ["00000","00000","00000","11111","00000","00000","00000"],
    "/": ["00001","00001","00010","00100","01000","10000","10000"],
    "%": ["11001","11010","00010","00100","01000","01011","10011"],
    "+": ["00000","00100","00100","11111","00100","00100","00000"],
    "!": ["00100","00100","00100","00100","00100","00000","00100"],
    "#": ["01010","01010","11111","01010","11111","01010","01010"]
};

function mezclar(c, x, y, color, cobertura) {
    if (cobertura <= 0 || x < 0 || y < 0 || x >= c.w || y >= c.h) return;
    if (cobertura > 1) cobertura = 1;
    const i = (y * c.w + x) * 4;
    for (let k = 0; k < 3; k++) {
        c.data[i + k] = Math.round(c.data[i + k] * (1 - cobertura) + color[k] * cobertura);
    }
    c.data[i + 3] = 255;
}

function rect(c, x0, y0, w, h, color) {
    for (let y = Math.max(0, y0); y < Math.min(c.h, y0 + h); y++) {
        for (let x = Math.max(0, x0); x < Math.min(c.w, x0 + w); x++) mezclar(c, x, y, color, 1);
    }
}

function rectAlpha(c, x0, y0, w, h, color, alpha) {
    for (let y = Math.max(0, y0); y < Math.min(c.h, y0 + h); y++) {
        for (let x = Math.max(0, x0); x < Math.min(c.w, x0 + w); x++) mezclar(c, x, y, color, alpha);
    }
}

function marco(c, x, y, w, h, g, color) {
    rect(c, x, y, w, g, color);
    rect(c, x, y + h - g, w, g, color);
    rect(c, x, y, g, h, color);
    rect(c, x + w - g, y, g, h, color);
}

function rombo(c, cx, cy, r, color) {
    for (let dy = -r - 1; dy <= r + 1; dy++) {
        for (let dx = -r - 1; dx <= r + 1; dx++) {
            mezclar(c, cx + dx, cy + dy, color, r + 0.5 - (Math.abs(dx) + Math.abs(dy)));
        }
    }
}

function circulo(c, cx, cy, r, color) {
    for (let dy = -r - 1; dy <= r + 1; dy++) {
        for (let dx = -r - 1; dx <= r + 1; dx++) {
            mezclar(c, cx + dx, cy + dy, color, r + 0.5 - Math.hypot(dx, dy));
        }
    }
}

function anchoTexto(txt, escala) {
    return txt.length ? txt.length * 6 * escala - escala : 0;
}

function texto(c, txt, x, y, escala, color) {
    let cx = x;
    for (const ch of txt) {
        const glifo = FUENTE[ch];
        if (glifo) {
            glifo.forEach((fila, j) => {
                for (let i = 0; i < fila.length; i++) {
                    if (fila[i] === "1") rect(c, cx + i * escala, y + j * escala, escala, escala, color);
                }
            });
        }
        cx += 6 * escala;
    }
}

function textoDerecha(c, txt, xDer, y, escala, color) {
    texto(c, txt, xDer - anchoTexto(txt, escala), y, escala, color);
}

function textoCentro(c, txt, y, escala, color) {
    texto(c, txt, Math.floor((c.w - anchoTexto(txt, escala)) / 2), y, escala, color);
}

function escalaPara(txt, max, min, anchoMax) {
    let e = max;
    while (e > min && anchoTexto(txt, e) > anchoMax) e--;
    return e;
}

// Deja solo caracteres que la fuente puede dibujar (sin tildes, sin emojis)
function limpiar(s) {
    return String(s || "").toUpperCase().split("")
        .map(ch => (ch === "Ñ" ? "N" : ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
        .join("").split("")
        .filter(ch => ch === " " || FUENTE[ch])
        .join("").replace(/\s+/g, " ").trim();
}

function fmt(n) {
    n = Math.trunc(Number(n) || 0);
    const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 ? "-" : "") + s;
}

function panel(c, y, m) {
    const x = 80, w = 640, h = 244;
    const completado = !!m.completado;
    const meta = Math.max(1, Number(m.meta) || 1);
    const progreso = Math.max(0, Number(m.progreso) || 0);
    const ratio = completado ? 1 : Math.min(1, progreso / meta);
    const acento = completado ? C_VERDE : C_ORO;

    rectAlpha(c, x, y, w, h, [255, 255, 255], 0.06);
    marco(c, x, y, w, h, 2, completado ? C_VERDE_SUAVE : C_ORO_SUAVE);
    rect(c, x, y, 8, h, acento);

    // Número en círculo
    circulo(c, x + 78, y + 62, 34, acento);
    texto(c, String(m.num), x + 78 - 12, y + 62 - 17, 5, C_OSCURO);

    // Título y descripción
    const tx = x + 140;
    const maxAncho = w - 140 - 24;
    const titulo = limpiar(m.titulo) || "MISION";
    const et = escalaPara(titulo, 5, 2, maxAncho);
    texto(c, titulo, tx, y + 26, et, C_BLANCO);

    const desc = limpiar(m.descripcion);
    const ed = escalaPara(desc, 3, 2, maxAncho);
    texto(c, desc, tx, y + 26 + 7 * et + 14, ed, C_ETIQUETA);

    // Barra de progreso
    const bx = x + 28, bw = w - 56, by = y + 112, bh = 30;
    rect(c, bx, by, bw, bh, [10, 12, 22]);
    rect(c, bx, by, Math.floor(bw * ratio), bh, acento);
    marco(c, bx, by, bw, bh, 2, C_ORO_SUAVE);

    // Progreso y estado
    texto(c, `${Math.min(progreso, meta)}/${meta}`, bx, y + 158, 5, C_BLANCO);
    textoDerecha(c, completado ? "COMPLETADO" : "PENDIENTE", x + w - 28, y + 164, 4, completado ? C_VERDE : C_GRIS);

    // Premio
    texto(c, "PREMIO", bx, y + 206, 3, C_ETIQUETA);
    texto(c, fmt(m.recompensa), bx + anchoTexto("PREMIO", 3) + 18, y + 202, 4, C_ORO);
}

/**
 * datos: { nombre, misiones: [ { num, titulo, descripcion, progreso, meta, completado, recompensa } ] }
 */
export async function generarImagenMisiones(datos) {
    const c = { w: W, h: H, data: Buffer.alloc(W * H * 4) };

    // Fondo en degradado vertical
    for (let y = 0; y < H; y++) {
        const t = y / (H - 1);
        const col = [
            Math.round(18 + (44 - 18) * t),
            Math.round(20 + (30 - 20) * t),
            Math.round(34 + (66 - 34) * t)
        ];
        rect(c, 0, y, W, 1, col);
    }

    // Marcos dorados con rombos en las esquinas
    marco(c, 20, 20, W - 40, H - 40, 5, C_ORO);
    marco(c, 34, 34, W - 68, H - 68, 2, C_ORO_SUAVE);
    rombo(c, 34, 34, 9, C_ORO);
    rombo(c, W - 34, 34, 9, C_ORO);
    rombo(c, 34, H - 34, 9, C_ORO);
    rombo(c, W - 34, H - 34, 9, C_ORO);

    // Título con rombos
    const titulo = "MISIONES";
    textoCentro(c, titulo, 74, 8, C_ORO);
    const anchoT = anchoTexto(titulo, 8);
    rombo(c, Math.floor((W - anchoT) / 2) - 40, 102, 12, C_ORO);
    rombo(c, Math.floor((W + anchoT) / 2) + 40, 102, 12, C_ORO);

    // Nombre
    const nombre = (limpiar(datos.nombre) || "USUARIO").slice(0, 24);
    const en = escalaPara(nombre, 5, 3, 640);
    textoCentro(c, nombre, 150, en, C_BLANCO);

    // Contador de completadas
    const lista = (datos.misiones || []).slice(0, 3);
    const hechas = lista.filter(m => m.completado).length;
    const todas = lista.length > 0 && hechas === lista.length;
    textoCentro(c, `COMPLETADAS ${hechas}/${lista.length}`, 198, 3, todas ? C_VERDE : C_ORO);

    rect(c, 80, 236, 640, 3, C_ORO_SUAVE);

    // Paneles de misiones
    lista.forEach((m, i) => panel(c, 256 + i * 260, m));

    // Pie
    textoCentro(c, "KIRITO BOT", H - 34 - 42, 4, C_ORO_SUAVE);

    const imagen = new Jimp({ width: W, height: H, data: c.data });
    const ruta = path.join(os.tmpdir(), `misiones_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);

    if (typeof imagen.writeAsync === "function") await imagen.writeAsync(ruta); // jimp 0.x
    else await imagen.write(ruta); // jimp 1.x

    return ruta;
}

// Export vacío para que el cargador de plugins no marque error
export default {
    name: "misionesImage",
    description: "Utilidad interna: dibuja la tarjeta de misiones con Jimp",
    run: async () => {}
};
