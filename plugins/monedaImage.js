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
const C_ROJO = [248, 113, 113];
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
    "+": ["00000","00100","00100","11111","00100","00100","00000"],
    "!": ["00100","00100","00100","00100","00100","00000","00100"]
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

function circulo(c, cx, cy, r, color, alpha = 1) {
    for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++) {
        for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            mezclar(c, x, y, color, (r + 0.5 - d) * alpha);
        }
    }
}

function anillo(c, cx, cy, R, grosor, color) {
    const m = Math.ceil(R + grosor / 2) + 2;
    for (let y = Math.floor(cy) - m; y <= Math.floor(cy) + m; y++) {
        for (let x = Math.floor(cx) - m; x <= Math.floor(cx) + m; x++) {
            const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            mezclar(c, x, y, color, grosor / 2 + 0.5 - Math.abs(r - R));
        }
    }
}

function dentroPoligono(px, py, pts) {
    let dentro = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
}

function poligono(c, pts, color) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const N = 3;
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
            let n = 0;
            for (let sy = 0; sy < N; sy++) {
                for (let sx = 0; sx < N; sx++) {
                    if (dentroPoligono(x + (sx + 0.5) / N, y + (sy + 0.5) / N, pts)) n++;
                }
            }
            mezclar(c, x, y, color, n / (N * N));
        }
    }
}

function estrella(c, cx, cy, R1, R2, color) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? R1 : R2;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    poligono(c, pts, color);
}

function lerpColor(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}

function simbolo(c, cx, cy, tipo, color) {
    if (tipo === "cara") {
        estrella(c, cx, cy, 84, 34, color);
    } else {
        anillo(c, cx, cy, 78, 12, color);
        anillo(c, cx, cy, 44, 10, color);
        circulo(c, cx, cy, 15, color);
    }
}

function dibujarMoneda(c, cx, cy, R, tipo) {
    // Sombra
    circulo(c, cx + 10, cy + 14, R, [0, 0, 0], 0.35);

    for (let y = Math.floor(cy - R - 2); y <= Math.ceil(cy + R + 2); y++) {
        for (let x = Math.floor(cx - R - 2); x <= Math.ceil(cx + R + 2); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
            const d = Math.hypot(dx, dy);
            const cob = R + 0.5 - d;
            if (cob <= 0) continue;
            // Luz desde arriba a la izquierda
            const t = Math.max(0, Math.min(1, 0.5 + (dx + dy) / (2 * R * 1.5)));
            let col = d > R - 18
                ? lerpColor([240, 205, 85], [125, 90, 18], t)
                : lerpColor([252, 226, 128], [190, 145, 42], t);
            if (Math.abs(d - (R - 36)) < 2.2) col = lerpColor([150, 108, 28], [110, 78, 15], t);
            mezclar(c, x, y, col, cob);
        }
    }

    // Símbolo grabado (resalte + sombra)
    simbolo(c, cx - 3, cy - 3, tipo, [255, 238, 165]);
    simbolo(c, cx, cy, tipo, [118, 84, 18]);
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
    rect(c, x - 24, y, 6, 31 + 7 * e, C_ORO_SUAVE);
    texto(c, etiqueta, x, y, 3, C_ETIQUETA);
    texto(c, valor, x, y + 31, e, colorValor);
}

/**
 * datos: { nombre, eleccion, resultado, gano(bool), monto, cartera,
 *          mision: { progreso, meta, completado } }
 */
export async function generarImagenMoneda(datos) {
    const c = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
    const gano = !!datos.gano;
    const colorRes = gano ? C_VERDE : C_ROJO;

    // Fondo en degradado vertical
    for (let y = 0; y < H; y++) {
        const t = y / (H - 1);
        rect(c, 0, y, W, 1, [
            Math.round(18 + (44 - 18) * t),
            Math.round(20 + (30 - 20) * t),
            Math.round(34 + (66 - 34) * t)
        ]);
    }

    // Marcos dorados con rombos en las esquinas
    marco(c, 20, 20, W - 40, H - 40, 5, C_ORO);
    marco(c, 34, 34, W - 68, H - 68, 2, C_ORO_SUAVE);
    rombo(c, 34, 34, 9, C_ORO);
    rombo(c, W - 34, 34, 9, C_ORO);
    rombo(c, 34, H - 34, 9, C_ORO);
    rombo(c, W - 34, H - 34, 9, C_ORO);

    // Título
    const titulo = "CARA O SELLO";
    textoCentro(c, titulo, 84, 7, C_ORO);
    const anchoT = anchoTexto(titulo, 7);
    rombo(c, Math.floor((W - anchoT) / 2) - 36, 108, 11, C_ORO);
    rombo(c, Math.floor((W + anchoT) / 2) + 36, 108, 11, C_ORO);

    // Nombre
    const nombre = (limpiar(datos.nombre) || "USUARIO").slice(0, 24);
    textoCentro(c, nombre, 152, escalaPara(nombre, 5, 3, 640), C_BLANCO);

    rect(c, 80, 206, 640, 3, C_ORO_SUAVE);

    // Moneda
    dibujarMoneda(c, W / 2, 410, 150, datos.resultado === "cara" ? "cara" : "sello");

    // Banner de resultado
    rectAlpha(c, 80, 600, 640, 80, colorRes, 0.18);
    marco(c, 80, 600, 640, 80, 3, colorRes);
    textoCentro(c, gano ? "ACERTASTE" : "FALLASTE", 619, 6, colorRes);

    // Monto
    const montoTxt = (gano ? "+" : "-") + fmt(datos.monto);
    textoCentro(c, montoTxt, 702, escalaPara(montoTxt, 8, 4, 640), colorRes);

    rect(c, 80, 784, 640, 3, C_ORO_SUAVE);

    // Elección y resultado
    bloque(c, 808, "TU ELECCION", limpiar(datos.eleccion) || "-", C_BLANCO, 6, 104, 280);
    bloque(c, 808, "CAYO", limpiar(datos.resultado) || "-", colorRes, 6, 440, 280);

    // Cartera y misión
    const m = datos.mision || { progreso: 0, meta: 1, completado: false };
    const meta = Math.max(1, Number(m.meta) || 1);
    const prog = Math.max(0, Number(m.progreso) || 0);
    const ratio = m.completado ? 1 : Math.min(1, prog / meta);
    const acento = m.completado ? C_VERDE : C_ORO;

    bloque(c, 903, "CARTERA", fmt(datos.cartera), C_ORO, 6, 104, 280);
    bloque(c, 903, "MISION", m.completado ? "COMPLETADA" : `${Math.min(prog, meta)}/${meta}`, m.completado ? C_VERDE : C_BLANCO, 6, 440, 280);

    // Barra de progreso de la misión
    const bx = 80, bw = 640, by = 996, bh = 24;
    rect(c, bx, by, bw, bh, [10, 12, 22]);
    rect(c, bx, by, Math.floor(bw * ratio), bh, acento);
    marco(c, bx, by, bw, bh, 2, C_ORO_SUAVE);

    // Pie
    textoCentro(c, "KIRITO BOT", H - 34 - 42, 4, C_ORO_SUAVE);

    const imagen = new Jimp({ width: W, height: H, data: c.data });
    const ruta = path.join(os.tmpdir(), `moneda_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);

    if (typeof imagen.writeAsync === "function") await imagen.writeAsync(ruta); // jimp 0.x
    else await imagen.write(ruta); // jimp 1.x

    return ruta;
}

// Export vacío para que el cargador de plugins no marque error
export default {
    name: "monedaImage",
    description: "Utilidad interna: dibuja la tarjeta de Cara o Sello con Jimp",
    run: async () => {}
};
