import fs from "fs";

export default {
    name: "rapido",
    description: "Desafío de mecanografía rápido local por grupo con recompensas en cartera local y conteo para misiones",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["rapido", "r"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El desafío de mecanografía rápido solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if (!db.sesionesRapido) db.sesionesRapido = {};
        const prefijoActual = prefijoUsado || (Array.isArray(CONFIG.prefix) ? CONFIG.prefix[0] : CONFIG.prefix);

        if (args.length > 0) {
            const sesionR = db.sesionesRapido[chatId];
            if (!sesionR) {
                return sock.sendMessage(chatId, { text: `❌ No hay ningún desafío de mecanografía activo en este grupo. Usa \`${prefijoActual}rapido\` para iniciar uno.` }, { quoted: msg });
            }

            const respuestaUsuario = args.join(" ").trim();
            const fraseObjetivo = sesionR.frase.trim();

            if (respuestaUsuario === fraseObjetivo) {
                clearTimeout(sesionR.timeout);
                delete db.sesionesRapido[chatId];

                const tiempoTardado = ((Date.now() - sesionR.tiempoInicio) / 1000).toFixed(2);
                const recompensa = 500;

                uGrupo.cartera = (uGrupo.cartera || 0) + recompensa;

                // 📋 Registrar avance en las Misiones Diarias del grupo
                if (!uGrupo.misionesDiarias) {
                    uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, monedasJugadas: 0, palabrasOrdenadas: 0, pptJugados: 0, rapidoJugados: 0, reclamado: false };
                }
                if (uGrupo.misionesDiarias.rapidoJugados === undefined) {
                    uGrupo.misionesDiarias.rapidoJugados = 0;
                }
                uGrupo.misionesDiarias.rapidoJugados++;

                if (typeof guardarDB === "function") guardarDB();

                const tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

                let txtWin = `╭━━━ 🏆 ❮ MECANOGRAFÍA EXITOSA (LOCAL) ❯ ⚡ ━━━╮\n`;
                txtWin += `┃\n`;
                txtWin += `┃ 👤 *Ganador:* ${tagUser}\n`;
                txtWin += `┃ ⏱️ *Tiempo:* *${tiempoTardado} segundos*\n`;
                txtWin += `┃ 🪙 *Premio local:* +${formatoMoneda(recompensa)}\n`;
                txtWin += `┃ 📜 _"${sesionR.frase}"_\n`;
                txtWin += `┃\n`;
                txtWin += `> 📋 _Progreso de misión actualizado (+1 mecanografía rápida)_\n`;
                txtWin += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                return sock.sendMessage(chatId, { text: txtWin, mentions: [senderJid] }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: `❌ ¡Frase incorrecta! Inténtalo de nuevo con \`${prefijoActual}r [frase]\`.` }, { quoted: msg });
            }
        }

        if (db.sesionesRapido[chatId]) {
            return sock.sendMessage(chatId, { text: `⚠️ ¡Ya hay un desafío activo en este grupo! Escribe tu respuesta con \`${prefijoActual}r [frase]\`.` }, { quoted: msg });
        }

        // 📂 Lectura y autocreación blindada de frases.json
        let frases = [];
        const rutaFrases = "./plugins/frases.json";
        try {
            if (fs.existsSync(rutaFrases)) {
                const archivoFrases = fs.readFileSync(rutaFrases, "utf8");
                frases = JSON.parse(archivoFrases);
            } else {
                frases = [
                    "Del dicho al hecho hay un gran trecho de camino.",
                    "El conocimiento es poder en el mundo virtual.",
                    "Kirito bot dominará los servidores de WhatsApp.",
                    "Termux y Node.js son el hogar de los verdaderos programadores."
                ];
                fs.writeFileSync(rutaFrases, JSON.stringify(frases, null, 2), "utf8");
            }
        } catch (e) {
            frases = ["Del dicho al hecho hay un gran trecho de camino."];
        }

        if (!Array.isArray(frases) || frases.length === 0) {
            frases = ["Del dicho al hecho hay un gran trecho de camino."];
        }

        const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];

        let txtIntro = `╭━━━ ⚡ ❮ DESAFÍO DE MECANOGRAFÍA ❯ ⚡ ━━━╮\n`;
        txtIntro += `┃\n`;
        txtIntro += `┃ ⏱️ Tienes *40 segundos* para escribir la frase exacta:\n\n`;
        txtIntro += `┃ 📜 \`\`\`${fraseAleatoria}\`\`\`\n\n`;
        txtIntro += `> 💬 Responde con \`${prefijoActual}r [frase]\` para ganar.\n`;
        txtIntro += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(chatId, { text: txtIntro }, { quoted: msg });

        db.sesionesRapido[chatId] = {
            frase: fraseAleatoria,
            tiempoInicio: Date.now(),
            timeout: setTimeout(async () => {
                if (db.sesionesRapido[chatId]) {
                    delete db.sesionesRapido[chatId];
                    await sock.sendMessage(chatId, { text: `⏰ *¡TIEMPO AGOTADO (40s)!* Nadie pudo escribir la frase a tiempo en este grupo.\nLa frase era:\n> _"${fraseAleatoria}"_` });
                }
            }, 40000)
        };
    }
};
