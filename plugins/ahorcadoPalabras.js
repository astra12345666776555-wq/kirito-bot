import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const RESPALDO = [
    { palabra: "moneda", pista: "Tiene un valor" },
    { palabra: "banco", pista: "Guarda dinero" },
    { palabra: "cambio", pista: "Puede modificar algo" }
];

function encontrarArchivo() {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const candidatos = [
        path.join(process.cwd(), "palabras.json"),
        path.join(aqui, "..", "palabras.json")
    ];
    return candidatos.find(r => fs.existsSync(r)) || null;
}

function parsear(texto) {
    texto = texto.replace(/^\uFEFF/, "");
    try {
        return JSON.parse(texto);
    } catch (e1) {
        // Intento de reparación: comas sobrantes antes de } o ]
        try {
            const arreglado = texto.replace(/,(\s*[}\]])/g, "$1");
            const r = JSON.parse(arreglado);
            console.log("[AHORCADO] ⚠️ palabras.json tenía comas sobrantes; se leyó igual. Arréglalo cuando puedas.");
            return r;
        } catch {
            console.log("[AHORCADO ERROR] ❌ palabras.json inválido:", e1.message);
            return null;
        }
    }
}

function cargarLista() {
    const ruta = encontrarArchivo();
    if (!ruta) return [];
    let contenido;
    try {
        contenido = parsear(fs.readFileSync(ruta, "utf8"));
    } catch (e) {
        console.log("[AHORCADO ERROR] ❌ No se pudo leer palabras.json:", e.message);
        return [];
    }
    if (!Array.isArray(contenido)) return [];

    const vistas = new Set();
    const lista = [];
    for (const item of contenido) {
        let palabra, pista;
        if (typeof item === "string") { palabra = item; pista = "Sin pista"; }
        else if (item && typeof item.palabra === "string") { palabra = item.palabra; pista = item.pista || "Sin pista"; }
        else continue;

        palabra = palabra.toLowerCase().trim();
        if (palabra.length < 2 || vistas.has(palabra)) continue; // sin duplicados
        vistas.add(palabra);
        lista.push({ palabra, pista });
    }
    return lista;
}

// Elige una palabra que no se haya usado aún en ese grupo; al agotar la lista, reinicia
export function elegirPalabra(chatId) {
    if (!global.ahorcadoUsadas) global.ahorcadoUsadas = {};
    if (!global.ahorcadoUsadas[chatId]) global.ahorcadoUsadas[chatId] = new Set();
    const usadas = global.ahorcadoUsadas[chatId];

    let lista = cargarLista();
    if (lista.length === 0) lista = RESPALDO;

    let disponibles = lista.filter(i => !usadas.has(i.palabra));
    if (disponibles.length === 0) {
        usadas.clear();
        disponibles = lista;
    }

    const sel = disponibles[Math.floor(Math.random() * disponibles.length)];
    usadas.add(sel.palabra);
    return sel;
}

// Export vacío para que el cargador de plugins no marque error
export default {
    name: "ahorcadoPalabras",
    description: "Utilidad interna: selector de palabras del Ahorcado",
    run: async () => {}
};
