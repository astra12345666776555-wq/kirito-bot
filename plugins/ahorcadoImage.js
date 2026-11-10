import fs from "fs";
import os from "os";
import path from "path";
import * as JimpModule from "jimp";

// Compatible con jimp v1.x ({ Jimp }) y v0.x (export por defecto CJS)
const Jimp = JimpModule.Jimp || JimpModule.default?.Jimp || JimpModule.default;

const SIZE = 512;

const C_FONDO = [245, 247, 250];
const C_PANEL = [232, 237, 245];
const C_HORCA = [92, 64, 51];
const C_FIGURA = [30, 41, 59];
const C_ROJO = [220, 38, 38];
const C_VERDE = [22, 163, 74];
const C_GRIS = [200, 207, 219];
const C_TEXTO = [30, 41, 59];

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
    "-": ["00000","00000","00000","11111","00000","00000","00000"]
};

function mezclar(data, x, y, color, cobertura) {
    if (cobertura <= 0 || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    if (cobertura > 1) cobertura = 1;
    const i = (y * SIZE + x) * 4;
    for (let k = 0; k < 3; k++) {
        data[i + k] = Math.round(data[i + k] * (1 - cobertura) + color[k] * cobertura);
    }
    data[i + 3] = 255;
}

function rect(data, x0, y0, w, h, color) {
    for (let y = Math.max(0, y0); y < Math.min(SIZE, y0 + h); y++) {
        for (let x = Math.max(0, x0); x < Math.min(SIZE, x0 + w); x++) mezclar(data, x, y, color, 1);
    }
}

function distSegmento(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const den = dx * dx + dy * dy;
    let t = den === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / den;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function linea(data, ax, ay, bx, by, grosor, color) {
    const m = Math.ceil(grosor / 2) + 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx)) - m);
    const x1 = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx)) + m);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by)) - m);
    const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by)) + m);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const d = distSegmento(x + 0.5, y + 0.5, ax, ay, bx, by);
            mezclar(data, x, y, color, grosor / 2 + 0.5 - d);
        }
    }
}

function anillo(data, cx, cy, R, grosor, color) {
    const m = Math.ceil(R + grosor / 2) + 2;
    for (let y = Math.max(0, Math.floor(cy) - m); y <= Math.min(SIZE - 1, Math.floor(cy) + m); y++) {
        for (let x = Math.max(0, Math.floor(cx) - m); x <= Math.min(SIZE - 1, Math.floor(cx) + m); x++) {
            const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            mezclar(data, x, y, color, grosor / 2 + 0.5 - Math.abs(r - R));
        }
    }
}

function circulo(data, cx, cy, r, color) {
    const m = Math.ceil(r) + 2;
    for (let y = Math.max(0, Math.floor(cy) - m); y <= Math.min(SIZE - 1, Math.floor(cy) + m); y++) {
        for (let x = Math.max(0, Math.floor(cx) - m); x <= Math.min(SIZE - 1, Math.floor(cx) + m); x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            mezclar(data, x, y, color, r + 0.5 - d);
        }
    }
}

function letra(data, ch, x, y, escala, color) {
    const c = String(ch).toUpperCase();
    const glifo = FUENTE[c === "Ñ" ? "N" : c];
    if (!glifo) return;
    glifo.forEach((fila, j) => {
        for (let i = 0; i < fila.length; i++) {
            if (fila[i] === "1") rect(data, x + i * escala, y + j * escala, escala, escala, color);
        }
    });
    if (c === "Ñ") rect(data, x + escala, y - 2 * escala, 3 * escala, escala, color);
}

function esLetra(c) {
    return /^[a-zñ]$/i.test(c);
}

/**
 * opciones: { palabra, letrasAdivinadas, letrasErroneas, intentosRestantes, intentosMaximos, final }
 * final: null | "ganado" | "perdido"
 */
export async function generarImagenAhorcado(opciones) {
    const palabra = String(opciones.palabra || "").toLowerCase();
    const adivinadas = opciones.letrasAdivinadas || [];
    const erroneas = opciones.letrasErroneas || [];
    const max = opciones.intentosMaximos || 6;
    const restantes = Math.max(0, Math.min(max, opciones.intentosRestantes ?? max));
    const errores = max - restantes;
    const final = opciones.final || null;

    const data = Buffer.alloc(SIZE * SIZE * 4);
    rect(data, 0, 0, SIZE, SIZE, C_FONDO);

    // --- Horca ---
    linea(data, 50, 300, 270, 300, 10, C_HORCA);   // base
    linea(data, 110, 300, 110, 40, 10, C_HORCA);   // poste
    linea(data, 105, 40, 275, 40, 10, C_HORCA);    // viga
    linea(data, 110, 95, 165, 40, 7, C_HORCA);     // refuerzo
    linea(data, 270, 40, 270, 90, 5, C_HORCA);     // cuerda

    // --- Monigote (aparece según los errores) ---
    const col = final === "perdido" ? C_ROJO : C_FIGURA;
    if (errores >= 1) anillo(data, 270, 120, 30, 6, col);                 // cabeza
    if (errores >= 2) linea(data, 270, 150, 270, 225, 6, col);            // cuerpo
    if (errores >= 3) linea(data, 270, 170, 235, 205, 6, col);            // brazo izq
    if (errores >= 4) linea(data, 270, 170, 305, 205, 6, col);            // brazo der
    if (errores >= 5) linea(data, 270, 225, 240, 275, 6, col);            // pierna izq
    if (errores >= 6) linea(data, 270, 225, 300, 275, 6, col);            // pierna der

    // --- Intentos restantes (círculos) ---
    for (let i = 0; i < max; i++) {
        const cx = 365 + (i % 3) * 45;
        const cy = 70 + Math.floor(i / 3) * 45;
        circulo(data, cx, cy, 14, i < restantes ? C_ROJO : C_GRIS);
    }

    // --- Letras falladas ---
    erroneas.slice(0, 9).forEach((l, i) => {
        const x = 350 + (i % 3) * 45;
        const y = 185 + Math.floor(i / 3) * 50;
        letra(data, l, x, y, 4, C_ROJO);
    });

    // --- Panel de la palabra ---
    rect(data, 0, 330, SIZE, 182, C_PANEL);

    const n = palabra.length || 1;
    const hueco = Math.min(60, Math.floor(480 / n));
    const escala = Math.max(2, Math.min(7, Math.floor((hueco * 0.7) / 5)));
    const anchoLetra = 5 * escala;
    const altoLetra = 7 * escala;
    const inicioX = Math.floor((SIZE - hueco * n) / 2);
    const baseY = 430;

    for (let i = 0; i < n; i++) {
        const ch = palabra[i];
        const x0 = inicioX + i * hueco;
        const xl = x0 + Math.floor((hueco - anchoLetra) / 2);

        if (!esLetra(ch)) {
            if (ch === "-") letra(data, "-", xl, baseY - altoLetra - 8, escala, C_TEXTO);
            continue; // espacios u otros símbolos: sin raya
        }

        const acertada = adivinadas.includes(ch);
        let colorLetra = C_TEXTO;
        if (final === "ganado") colorLetra = C_VERDE;

        if (acertada || final === "ganado") {
            letra(data, ch, xl, baseY - altoLetra - 10, escala, colorLetra);
        } else if (final === "perdido") {
            letra(data, ch, xl, baseY - altoLetra - 10, escala, C_ROJO);
        }

        const ancho = Math.max(8, Math.floor(hueco * 0.8));
        rect(data, x0 + Math.floor((hueco - ancho) / 2), baseY, ancho, 5, C_TEXTO);
    }

    const imagen = new Jimp({ width: SIZE, height: SIZE, data });
    const ruta = path.join(os.tmpdir(), `ahorcado_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);

    if (typeof imagen.writeAsync === "function") await imagen.writeAsync(ruta); // jimp 0.x
    else await imagen.write(ruta); // jimp 1.x

    return ruta;
}

// Export vacío para que el cargador de plugins no marque error
export default {
    name: "ahorcadoImage",
    description: "Utilidad interna: dibuja el tablero del Ahorcado con Jimp",
    run: async () => {}
};
