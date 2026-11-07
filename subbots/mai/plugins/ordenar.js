import fs from "fs";
import path from "path";

export default {
    name: "ordenar",
    description: "Minijuego de ordenar palabras desordenadas con límite de tiempo, recompensas en cartera local y conteo para misiones",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["ordenar", "ord"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El juego de ordenar palabras solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if (!db.sesionesOrdenar) db.sesionesOrdenar = {};
        const prefijoActual = prefijoUsado || (Array.isArray(CONFIG.prefix) ? CONFIG.prefix[0] : CONFIG.prefix);

        if (args.length > 0) {
            const sesionO = db.sesionesOrdenar[chatId];
            if (!sesionO) {
                return sock.sendMessage(chatId, { text: `❌ No hay ningún juego de ordenar activo en este grupo. Usa \`${prefijoActual}ordenar\` para iniciar uno.` }, { quoted: msg });
            }

            const respuestaUsuario = args.join(" ").trim().toUpperCase();
            const palabraObjetivo = sesionO.palabra.toUpperCase();

            if (respuestaUsuario === palabraObjetivo) {
                clearTimeout(sesionO.timeout);
                delete db.sesionesOrdenar[chatId];

                const recompensa = 400;
                uGrupo.cartera = (uGrupo.cartera || 0) + recompensa;

                // 📋 Registrar avance en las Misiones Diarias del grupo
                if (!uGrupo.misionesDiarias) {
                    uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, monedasJugadas: 0, palabrasOrdenadas: 0, reclamado: false };
                }
                if (uGrupo.misionesDiarias.palabrasOrdenadas === undefined) {
                    uGrupo.misionesDiarias.palabrasOrdenadas = 0;
                }
                uGrupo.misionesDiarias.palabrasOrdenadas++;

                if (typeof guardarDB === "function") guardarDB();

                const tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

                let txtWin = `╭━━━ 🧩 ❮ PALABRA ORDENADA (LOCAL) ❯ 🧩 ━━━╮\n`;
                txtWin += `┃\n`;
                txtWin += `┃ 👤 *Ganador:* ${tagUser}\n`;
                txtWin += `┃ 🪙 *Premio local:* +${formatoMoneda(recompensa)}\n`;
                txtWin += `┃ ✨ *Palabra:* *${sesionO.palabra}*\n`;
                txtWin += `┃\n`;
                txtWin += `> 📋 _Progreso de misión actualizado (+1 palabra ordenada)_\n`;
                txtWin += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                return sock.sendMessage(chatId, { text: txtWin, mentions: [senderJid] }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: `❌ ¡Incorrecto! Inténtalo de nuevo con \`${prefijoActual}ord [tu respuesta]\`.` }, { quoted: msg });
            }
        }

        if (db.sesionesOrdenar[chatId]) {
            return sock.sendMessage(chatId, { text: `⚠️ ¡Ya hay un juego de ordenar activo en este grupo! Ordena las letras usando \`${prefijoActual}ord [palabra]\`.` }, { quoted: msg });
        }

        let lista = [];
        try {
            const filePath = path.resolve("./palabras_ordenar.json");
            const archivo = fs.readFileSync(filePath, "utf8");
            lista = JSON.parse(archivo);
        } catch (e) {
            lista = ["ABEJA", "PROGRAMACION", "GATO", "PERRO", "CASA", "COMPUTADORA", "KIRITO", "TERMINUX", "NODEJS"];
        }

        if (!Array.isArray(lista) || lista.length === 0) {
            lista = ["ABEJA", "PROGRAMACION", "GATO", "PERRO", "CASA"];
        }

        const palabraOriginal = String(lista[Math.floor(Math.random() * lista.length)]).trim().toUpperCase();

        // Desordenar letra por letra y separar por guiones (-)
        const letras = palabraOriginal.split("");
        for (let i = letras.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [letras[i], letras[j]] = [letras[j], letras[i]];
        }
        const palabraDesordenada = letras.join("-");

        let txtIntro = `╭━━━ 🧩 ❮ DESAFÍO DE ORDENAR ❯ 🧩 ━━━╮\n`;
        txtIntro += `┃\n`;
        txtIntro += `┃ ⏱️ Tienes *40 segundos* para ordenar las letras:\n\n`;
        txtIntro += `┃ 🔤 \`${palabraDesordenada}\`\n\n`;
        txtIntro += `> 💬 Responde con \`${prefijoActual}ord [palabra]\` para ganar.\n`;
        txtIntro += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, { text: txtIntro }, { quoted: msg });

        db.sesionesOrdenar[chatId] = {
            palabra: palabraOriginal,
            timeout: setTimeout(async () => {
                if (db.sesionesOrdenar[chatId]) {
                    delete db.sesionesOrdenar[chatId];
                    await sock.sendMessage(chatId, { text: `⏰ *¡TIEMPO AGOTADO (40s)!* Nadie pudo ordenar la palabra a tiempo en este grupo.\nLa palabra era: *${palabraOriginal}*` });
                }
            }, 40000)
        };
    }
};
