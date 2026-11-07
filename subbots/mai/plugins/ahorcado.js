import fs from "fs";

export default {
    name: "ahorcado",
    description: "Juego del ahorcado local por grupo con premios y lectura de JSON con pistas",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        if (["ahorcado", "hangman"].includes(cmdLimpio)) {
            // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '⚠️ El juego del ahorcado solo se puede jugar dentro de los grupos.' }, { quoted: msg });
            }

            if (!global.partidasAhorcado) global.partidasAhorcado = {};
            if (global.partidasAhorcado[chatId] && global.partidasAhorcado[chatId].activo) {
                return sock.sendMessage(chatId, { text: "⚠️ ¡Ya hay una partida de Ahorcado en curso en este grupo!" }, { quoted: msg });
            }

            let archivoJson = "palabras_ahorcada.json";
            let listaPalabras = [];

            try {
                if (fs.existsSync(archivoJson)) {
                    let contenido = JSON.parse(fs.readFileSync(archivoJson, "utf8"));
                    if (Array.isArray(contenido) && contenido.length > 0) {
                        listaPalabras = contenido.map(item => {
                            if (typeof item === "string") {
                                return { palabra: item.toLowerCase().trim(), pista: "Sin pista" };
                            } else if (item && typeof item.palabra === "string") {
                                return { 
                                    palabra: item.palabra.toLowerCase().trim(), 
                                    pista: item.pista || "Sin pista" 
                                };
                            }
                            return null;
                        }).filter(item => item && item.palabra.length > 1);
                    }
                }
            } catch (e) {
                console.log("[AHORCADO ERROR] ❌ Error leyendo " + archivoJson, e);
            }

            // Lista de respaldo por si el archivo está vacío o no existe
            if (listaPalabras.length === 0) {
                listaPalabras = [
                    { palabra: "moneda", pista: "Tiene un valor" },
                    { palabra: "banco", pista: "Guarda dinero" },
                    { palabra: "cambio", pista: "Puede modificar algo" }
                ];
            }

            let seleccion = listaPalabras[Math.floor(Math.random() * listaPalabras.length)];

            global.partidasAhorcado[chatId] = {
                activo: true,
                palabra: seleccion.palabra,
                pista: seleccion.pista,
                letrasAdivinadas: [],
                intentosMaximos: 6,
                intentosRestantes: 6,
                letrasErroneas: []
            };

            mostrarEstadoAhorcado(sock, chatId);
        }

        if (cmdLimpio === "a") {
            if (!chatId.endsWith('@g.us')) return;

            let juego = global.partidasAhorcado && global.partidasAhorcado[chatId];
            if (!juego || !juego.activo) {
                return sock.sendMessage(chatId, { text: `❌ No hay ninguna partida de Ahorcado activa en este grupo. Inicia una con \`${prefijoUsado}ahorcado\`` }, { quoted: msg });
            }

            let intento = (args[0] || "").toLowerCase().trim();
            if (!intento) {
                return sock.sendMessage(chatId, { text: `⚠️ Debes escribir una letra o palabra.\nEjemplo: \`${prefijoUsado}a m\` o \`${prefijoUsado}a moneda\`` }, { quoted: msg });
            }

            // Inicializar base de datos local del grupo para el usuario
            if (!db.grupos) db.grupos = {};
            if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
            }
            let uGrupo = db.grupos[chatId].usuarios[senderJid];

            if (intento.length > 1) {
                if (intento === juego.palabra) {
                    let premioCols = juego.palabra.length * 150;
                    uGrupo.cartera = (uGrupo.cartera || 0) + premioCols;
                    if (typeof guardarDB === "function") guardarDB();

                    let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];
                    let textoGanador = `╭━━━ 🎉 ❮ VICTORIA EN EL AHORCADO ❯ 🎉 ━━━╮\n`;
                    textoGanador += `┃\n`;
                    textoGanador += `┃ 👑 Ganador: ${tagUser}\n`;
                    textoGanador += `┃ 🔤 Palabra secreta: *${juego.palabra.toUpperCase()}*\n`;
                    textoGanador += `┃ 🪙 *Premio obtenido:* +${formatoMoneda(premioCols)}\n`;
                    textoGanador += `┃\n`;
                    textoGanador += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                    delete global.partidasAhorcado[chatId];
                    return sock.sendMessage(chatId, { text: textoGanador, mentions: [senderJid] }, { quoted: msg });
                } else {
                    juego.intentosRestantes--;
                    if (juego.intentosRestantes <= 0) {
                        let textoPerdedor = `╭━━━ 💀 ❮ JUEGO TERMINADO ❯ 💀 ━━━╮\n`;
                        textoPerdedor += `┃\n`;
                        textoPerdedor += `┃ ❌ ¡Se acabaron los intentos en este grupo!\n`;
                        textoPerdedor += `┃ 🔤 La palabra secreta era: *${juego.palabra.toUpperCase()}*\n`;
                        textoPerdedor += `┃\n`;
                        textoPerdedor += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                        delete global.partidasAhorcado[chatId];
                        return sock.sendMessage(chatId, { text: textoPerdedor }, { quoted: msg });
                    } else {
                        return sock.sendMessage(chatId, { text: `❌ ¡Palabra incorrecta! Te quedan *${juego.intentosRestantes} intentos* en este grupo.` }, { quoted: msg });
                    }
                }
            }

            let letra = intento[0];
            if (juego.letrasAdivinadas.includes(letra) || juego.letrasErroneas.includes(letra)) {
                return sock.sendMessage(chatId, { text: `⚠️ Ya intentaron con la letra *${letra.toUpperCase()}*. Prueben otra.` }, { quoted: msg });
            }

            if (juego.palabra.includes(letra)) {
                juego.letrasAdivinadas.push(letra);

                let palabraCompleta = juego.palabra.split("").every(l => juego.letrasAdivinadas.includes(l));
                if (palabraCompleta) {
                    let premioCols = juego.palabra.length * 150;
                    uGrupo.cartera = (uGrupo.cartera || 0) + premioCols;
                    if (typeof guardarDB === "function") guardarDB();

                    let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];
                    let textoGanador = `╭━━━ 🎉 ❮ VICTORIA EN EL AHORCADO ❯ 🎉 ━━━╮\n`;
                    textoGanador += `┃\n`;
                    textoGanador += `┃ 👑 ¡Palabra completada por ${tagUser}!\n`;
                    textoGanador += `┃ 🔤 Palabra: *${juego.palabra.toUpperCase()}*\n`;
                    textoGanador += `┃ 🪙 *Premio obtenido:* +${formatoMoneda(premioCols)}\n`;
                    textoGanador += `┃\n`;
                    textoGanador += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                    delete global.partidasAhorcado[chatId];
                    return sock.sendMessage(chatId, { text: textoGanador, mentions: [senderJid] }, { quoted: msg });
                } else {
                    mostrarEstadoAhorcado(sock, chatId);
                }
            } else {
                juego.letrasErroneas.push(letra);
                juego.intentosRestantes--;

                if (juego.intentosRestantes <= 0) {
                    let textoPerdedor = `╭━━━ 💀 ❮ JUEGO TERMINADO ❯ 💀 ━━━╮\n`;
                    textoPerdedor += `┃\n`;
                    textoPerdedor += `┃ ❌ ¡Se acabaron los intentos! El monigote fue ahorcado.\n`;
                    textoPerdedor += `┃ 🔤 La palabra era: *${juego.palabra.toUpperCase()}*\n`;
                    textoPerdedor += `┃\n`;
                    textoPerdedor += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                    delete global.partidasAhorcado[chatId];
                    return sock.sendMessage(chatId, { text: textoPerdedor }, { quoted: msg });
                } else {
                    mostrarEstadoAhorcado(sock, chatId);
                }
            }
        }
    }
};

function mostrarEstadoAhorcado(sock, chatId) {
    let juego = global.partidasAhorcado && global.partidasAhorcado[chatId];
    if (!juego) return;

    let progreso = juego.palabra.split("").map(l => (juego.letrasAdivinadas.includes(l) ? l.toUpperCase() : "_")).join(" ");

    let monigotes = [
        "  o  \n /|\\ \n / \\ ",
        "  o  \n /|\\ \n /   ",
        "  o  \n /|\\ \n     ",
        "  o  \n /|  \n     ",
        "  o  \n  |  \n     ",
        "  o  \n     \n     ",
        "     \n     \n     "
    ];

    let dibujo = monigotes[juego.intentosRestantes] || "";

    let txt = `╭━━━ 🎯 ❮ JUEGO DEL AHORCADO ❯ 🎯 ━━━╮\n`;
    txt += `┃\n`;
    txt += `\`\`\`\n${dibujo}\n\`\`\`\n`;
    txt += `┃ 🔤 Palabra: *${progreso}*\n`;
    txt += `┃ 💡 Pista: *${juego.pista}*\n`;
    txt += `┃ ❤️ Intentos: *${juego.intentosRestantes} / ${juego.intentosMaximos}*\n`;
    txt += `┃ ❌ Fallidas: ${juego.letrasErroneas.join(", ").toUpperCase() || "Ninguna"}\n`;
    txt += `┃\n`;
    txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    txt += `> 💡 _Usa_ \`.a <letra>\` _o_ \`.a <palabra>\` _para adivinar._`;

    sock.sendMessage(chatId, { text: txt });
}
