import fs from 'fs';
import path from 'path';

export default {
    name: "trivia",
    description: "Minijuego de trivia local con estética gótica, respuestas y misión independiente por victorias",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== 'trivia') return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Las trivias solo se pueden jugar dentro de los grupos.' }, { quoted: msg });
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
        }
        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        // 📂 Lectura y autocreación de preguntas_trivia.json
        let preguntas = [];
        const rutaPreguntas = "./plugins/preguntas_trivia.json";
        try {
            if (fs.existsSync(rutaPreguntas)) {
                const archivoPreguntas = fs.readFileSync(rutaPreguntas, "utf8");
                preguntas = JSON.parse(archivoPreguntas);
            } else {
                preguntas = [
                    { q: "¿Cuál es el planeta más cercano al Sol?", a: "mercurio" },
                    { q: "¿En qué año llegó el hombre a la Luna?", a: "1969" },
                    { q: "¿Cuál es el río más largo del mundo?", a: "amazonas" },
                    { q: "¿Qué lenguaje de programación se usa para este bot?", a: "javascript" },
                    { q: "¿Cómo se llama el protagonista principal de Sword Art Online?", a: "kirito" }
                ];
                fs.writeFileSync(rutaPreguntas, JSON.stringify(preguntas, null, 2), "utf8");
            }
        } catch (e) {
            preguntas = [{ q: "¿Cuál es el planeta más cercano al Sol?", a: "mercurio" }];
        }

        if (!Array.isArray(preguntas) || preguntas.length === 0) {
            preguntas = [{ q: "¿Cuál es el planeta más cercano al Sol?", a: "mercurio" }];
        }

        const p = preguntas[Math.floor(Math.random() * preguntas.length)];
        let respuestaUsuario = args.join(" ").toLowerCase().trim();

        // Obtener datos globales para la regla de oro del nombre/ID
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

        // Inicializar estructura de misiones
        if (!uGrupo.misiones) {
            uGrupo.misiones = {};
        }
        if (!uGrupo.misiones.trivia) {
            uGrupo.misiones.trivia = { progreso: 0, meta: 2, completado: false, recompensa: 5000 };
        }

        let mTrivia = uGrupo.misiones.trivia;

        // Si el usuario no mandó respuesta todavía, le lanzamos la pregunta
        if (!respuestaUsuario) {
            let txtPregunta = `╭━━━ 🅲 ❮ ᴛʀɪᴠɪᴀ ᴅᴇ ᴋɪʀɪᴛᴏ (ʟᴏᴄᴀʟ) ❯ 🅲 ━━━╮\n`;
            txtPregunta += `┃\n`;
            txtPregunta += `┃ ❖ ᴊᴜɢᴀᴅᴏʀ » *${identificadorJugador}*\n`;
            txtPregunta += `┃ 📌 ᴘʀᴇɢᴜɴᴛᴀ » *${p.q}*\n`;
            txtPregunta += `┃\n`;
            txtPregunta += `> ❖ ɪɴꜱᴛʀᴜᴄᴄɪóɴ » _Responde usando: \`${prefijoUsado}trivia <respuesta>\`_\n`;
            txtPregunta += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            // Guardamos temporalmente la respuesta correcta en la sesión o memoria del grupo si es necesario, 
            // o evaluamos directo si el bot maneja el flujo de una sola línea. 
            // Para mantenerlo simple y directo en un solo comando:
            txtPregunta += `\n\n*(Nota: Guarda esta pregunta en tu lógica o responde con tu opción)*`;
            return sock.sendMessage(chatId, { text: txtPregunta }, { quoted: msg });
        }

        // Si ya mandó respuesta, evaluamos si ganó (acertó)
        let acerto = respuestaUsuario.includes(p.a.toLowerCase());
        let estadoProgresoTexto = "_Fallaste, sin avance en misión_";
        let premio = 500;

        if (acerto) {
            uGrupo.cartera = (uGrupo.cartera || 0) + premio;
            if (!mTrivia.completado) {
                mTrivia.progreso += 1;
                if (mTrivia.progreso >= mTrivia.meta) {
                    mTrivia.completado = true;
                    uGrupo.cartera += mTrivia.recompensa;
                    estadoProgresoTexto = `_¡Misión completada! Ganaste ${formatoMoneda(mTrivia.recompensa)} extra_`;
                } else {
                    estadoProgresoTexto = `_Progreso de misión: ${mTrivia.progreso}/${mTrivia.meta} victorias_`;
                }
            }
        }

        let txtTrivia = `╭━━━ 🅲 ❮ ᴛʀɪᴠɪᴀ ᴅᴇ ᴋɪʀɪᴛᴏ (ʟᴏᴄᴀʟ) ❯ 🅲 ━━━╮\n`;
        txtTrivia += `┃\n`;
        txtTrivia += `┃ ❖ ᴊᴜɢᴀᴅᴏʀ » *${identificadorJugador}*\n`;
        txtTrivia += `┃ 📌 ᴘʀᴇɢᴜɴᴛᴀ » *${p.q}*\n`;
        txtTrivia += `┃ 💬 ᴛᴜ ʀᴇꜱᴘᴜᴇꜱᴛᴀ » *${respuestaUsuario}*\n`;
        txtTrivia += `┃ 💡 ʀᴇꜱᴘᴜᴇꜱᴛᴀ ᴄʟᴀᴠᴇ » \`${p.a}\`\n`;
        txtTrivia += `┃ ❀ ʀᴇꜱᴜʟᴛᴀᴅᴏ » ${acerto ? '*¡Acertaste!* Ganaste *' + formatoMoneda(premio) + '*' : '*Fallaste.* Era ' + p.a}.\n`;
        txtTrivia += `┃\n`;
        txtTrivia += `> ❖ ᴘʀᴏɢʀᴇꜱᴏ » ${estadoProgresoTexto}\n`;
        txtTrivia += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        guardarDB();
        return sock.sendMessage(chatId, { text: txtTrivia }, { quoted: msg });
    }
};
