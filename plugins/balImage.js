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
const C_GRIS = [160, 165, 180];

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
    "+": ["00000","00100","00100","11111","00100","00100","00000"]
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

// Bloque: barra dorada + etiqueta pequeña arriba + valor grande abajo (se achica si no cabe)
function bloque(c, y, etiqueta, valor, colorValor, escalaValor, x = 104, maxAncho = 616) {
    const e = escalaPara(valor, escalaValor, 2, maxAncho);
    const altoValor = 7 * e;
    rect(c, x - 24, y, 6, 31 + altoValor, C_ORO_SUAVE);
    texto(c, etiqueta, x, y, 3, C_ETIQUETA);
    texto(c, valor, x, y + 31, e, colorValor);
}

/**
 * datos: { nombre, cartera, banco, bancoCompartido(bool), total, nivel, xp,
 *          proteccion(string), misionCompleta(bool), pareja(string|null) }
 */
export async function generarImagenBal(datos) {
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
    const titulo = "ECONOMIA";
    textoCentro(c, titulo, 84, 8, C_ORO);
    const anchoT = anchoTexto(titulo, 8);
    rombo(c, Math.floor((W - anchoT) / 2) - 40, 112, 12, C_ORO);
    rombo(c, Math.floor((W + anchoT) / 2) + 40, 112, 12, C_ORO);

    // Nombre
    const nombre = (limpiar(datos.nombre) || "USUARIO").slice(0, 24);
    const en = escalaPara(nombre, 6, 3, 640);
    textoCentro(c, nombre, 164, en, C_BLANCO);

    rect(c, 80, 236, 640, 3, C_ORO_SUAVE);

    // Dinero
    bloque(c, 266, "CARTERA", fmt(datos.cartera), C_BLANCO, 7);
    bloque(c, 366, datos.bancoCompartido ? "BANCO COMPARTIDO" : "BANCO", fmt(datos.banco), C_BLANCO, 7);
    bloque(c, 466, "TOTAL", fmt(datos.total), C_ORO, 8);

    rect(c, 80, 585, 640, 3, C_ORO_SUAVE);

    // Nivel y XP en dos columnas
    bloque(c, 615, "NIVEL", fmt(datos.nivel), C_BLANCO, 7, 104, 280);
    bloque(c, 615, "XP", fmt(datos.xp), C_BLANCO, 7, 440, 280);

    rect(c, 80, 727, 640, 3, C_ORO_SUAVE);

    // Protección y misión
    const prot = limpiar(datos.proteccion) || "NINGUNA";
    bloque(c, 757, "PROTECCION", prot, prot === "NINGUNA" ? C_GRIS : C_VERDE, 6);
    bloque(c, 860, "MISION", datos.misionCompleta ? "COMPLETADA" : "PENDIENTES", datos.misionCompleta ? C_VERDE : C_GRIS, 6);

    if (datos.pareja) {
        bloque(c, 963, "PAREJA", (limpiar(datos.pareja) || "PAREJA").slice(0, 20), C_ORO, 6);
    }

    // Pie
    textoCentro(c, "KIRITO BOT", H - 34 - 42, 4, C_ORO_SUAVE);

    const imagen = new Jimp({ width: W, height: H, data: c.data });
    const ruta = path.join(os.tmpdir(), `bal_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);

    if (typeof imagen.writeAsync === "function") await imagen.writeAsync(ruta); // jimp 0.x
    else await imagen.write(ruta); // jimp 1.x

    return ruta;
}

// Export vacío para que el cargador de plugins no marque error
export default {
    name: "balImage",
    description: "Utilidad interna: dibuja la tarjeta de balance con Jimp",
    run: async () => {}
};
