import fs from "fs";
import os from "os";
import path from "path";
import * as JimpModule from "jimp";

// Compatible con jimp v1.x ({ Jimp }) y v0.x (export por defecto CJS)
const Jimp = JimpModule.Jimp || JimpModule.default?.Jimp || JimpModule.default;

const SIZE = 512;
const PAD = 16;
const CELL = 160;

const COLOR_X = [37, 99, 235];
const COLOR_O = [220, 38, 38];
const COLOR_LINEA = [60, 70, 90];
const COLOR_NUM = [190, 198, 212];

const FUENTE = {
    1: ["010", "110", "010", "010", "111"],
    2: ["111", "001", "111", "100", "111"],
    3: ["111", "001", "111", "001", "111"],
    4: ["101", "101", "111", "001", "001"],
    5: ["111", "100", "111", "001", "111"],
    6: ["111", "100", "111", "101", "111"],
    7: ["111", "001", "001", "001", "001"],
    8: ["111", "101", "111", "101", "111"],
    9: ["111", "101", "111", "001", "111"]
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
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) mezclar(data, x, y, color, 1);
    }
}

function digito(data, n, x0, y0, escala, color) {
    const filas = FUENTE[n];
    if (!filas) return;
    filas.forEach((fila, j) => {
        for (let i = 0; i < fila.length; i++) {
            if (fila[i] === "1") rect(data, x0 + i * escala, y0 + j * escala, escala, escala, color);
        }
    });
}

function distSegmento(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function dibujarX(data, x0, y0) {
    const m = 36, grosor = 7;
    const a1 = [x0 + m, y0 + m], b1 = [x0 + CELL - m, y0 + CELL - m];
    const a2 = [x0 + CELL - m, y0 + m], b2 = [x0 + m, y0 + CELL - m];
    for (let y = y0; y < y0 + CELL; y++) {
        for (let x = x0; x < x0 + CELL; x++) {
            const d1 = distSegmento(x + 0.5, y + 0.5, a1[0], a1[1], b1[0], b1[1]);
            const d2 = distSegmento(x + 0.5, y + 0.5, a2[0], a2[1], b2[0], b2[1]);
            mezclar(data, x, y, COLOR_X, grosor + 0.5 - Math.min(d1, d2));
        }
    }
}

function dibujarO(data, x0, y0) {
    const cx = x0 + CELL / 2, cy = y0 + CELL / 2;
    const R = 46, mitad = 7;
    for (let y = y0; y < y0 + CELL; y++) {
        for (let x = x0; x < x0 + CELL; x++) {
            const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            mezclar(data, x, y, COLOR_O, mitad + 0.5 - Math.abs(r - R));
        }
    }
}

export async function generarImagenTablero(tablero) {
    const data = Buffer.alloc(SIZE * SIZE * 4);

    // Fondo
    rect(data, 0, 0, SIZE, SIZE, [245, 247, 250]);

    // Casillas con fondo sutil + números en las vacías
    for (let f = 0; f < 3; f++) {
        for (let c = 0; c < 3; c++) {
            const x0 = PAD + c * CELL;
            const y0 = PAD + f * CELL;
            const fondo = (f + c) % 2 === 0 ? [255, 255, 255] : [236, 240, 246];
            rect(data, x0 + 3, y0 + 3, CELL - 6, CELL - 6, fondo);
            if (tablero[f][c] === "⬜") {
                digito(data, f * 3 + c + 1, x0 + 14, y0 + 12, 5, COLOR_NUM);
            }
        }
    }

    // Líneas del tablero
    for (let i = 1; i <= 2; i++) {
        rect(data, PAD + CELL * i - 3, PAD, 6, CELL * 3, COLOR_LINEA);
        rect(data, PAD, PAD + CELL * i - 3, CELL * 3, 6, COLOR_LINEA);
    }

    // Fichas
    for (let f = 0; f < 3; f++) {
        for (let c = 0; c < 3; c++) {
            const x0 = PAD + c * CELL;
            const y0 = PAD + f * CELL;
            if (tablero[f][c] === "❌") dibujarX(data, x0, y0);
            else if (tablero[f][c] === "⭕") dibujarO(data, x0, y0);
        }
    }

    const imagen = new Jimp({ width: SIZE, height: SIZE, data });
    const ruta = path.join(os.tmpdir(), `gato_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);

    if (typeof imagen.writeAsync === "function") await imagen.writeAsync(ruta); // jimp 0.x
    else await imagen.write(ruta); // jimp 1.x

    return ruta;
}

// Export vacío para que el cargador de plugins no marque error
export default {
    name: "gatoImage",
    description: "Utilidad interna: dibuja el tablero del Gato con Jimp",
    run: async () => {}
};
