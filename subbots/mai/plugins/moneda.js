export default {
    name: "moneda",
    description: "Juego de cara o sello con estética gótica y avance en misión independiente de victorias",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["moneda", "carasello", "cs"].includes(cmdLimpio)) return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando debe usarse dentro de un grupo.' }, { quoted: msg });
        }

        let eleccion = (args[0] || "").toLowerCase().trim();
        let montoStr = args[1];

        if (!["cara", "sello"].includes(eleccion)) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso incorrecto. Debes elegir cara o sello.\nEjemplo: \`${prefijoUsado}moneda cara 100\`` }, { quoted: msg });
        }

        let monto = parseInt(montoStr);
        if (isNaN(monto) || monto <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Ingresa una cantidad válida de dinero a apostar.\nEjemplo: \`${prefijoUsado}moneda cara 100\`` }, { quoted: msg });
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
        }
        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if ((uGrupo.cartera || 0) < monto) {
            return sock.sendMessage(chatId, { text: `⚠️ No tienes suficiente dinero en tu cartera local. Tienes *${formatoMoneda(uGrupo.cartera || 0)}*.` }, { quoted: msg });
        }

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

        let resultado = Math.random() < 0.5 ? "cara" : "sello";
        let gano = (eleccion === resultado);

        // Inicializar estructura de misiones si no existe
        if (!uGrupo.misiones) {
            uGrupo.misiones = {};
        }
        if (!uGrupo.misiones.moneda) {
            uGrupo.misiones.moneda = { progreso: 0, meta: 3, completado: false, recompensa: 6000 };
        }

        let estadoProgresoTexto = "_Misión actualizada_";

        if (gano) {
            uGrupo.cartera += monto;
            // Sumar progreso a la misión independiente de ganar en la moneda
            let mMoneda = uGrupo.misiones.moneda;
            if (!mMoneda.completado) {
                mMoneda.progreso += 1;
                if (mMoneda.progreso >= mMoneda.meta) {
                    mMoneda.completado = true;
                    uGrupo.cartera += mMoneda.recompensa; // Premio extra al completar la misión
                    estadoProgresoTexto = `_¡Misión completada! Ganaste ${formatoMoneda(mMoneda.recompensa)} extra_`;
                } else {
                    estadoProgresoTexto = `_Progreso de misión: ${mMoneda.progreso}/${mMoneda.meta} victorias_`;
                }
            }
        } else {
            uGrupo.cartera -= monto;
            estadoProgresoTexto = "_Fallaste, sin avance en misión_";
        }

        let txtMoneda = `╭━━━ 🅲 ❮ ᴄᴀʀᴀ ᴏ ꜱᴇʟʟᴏ (ʟᴏᴄᴀʟ) ❯ 🅲 ━━━╮\n`;
        txtMoneda += `┃\n`;
        txtMoneda += `┃ ❖ ᴊᴜɢᴀᴅᴏʀ » *${identificadorJugador}*\n`;
        txtMoneda += `┃ ✰ ᴇʟᴇᴄᴄɪóɴ » *${eleccion.toUpperCase()}*\n`;
        txtMoneda += `┃ ✦ ᴄᴀʏó » *${resultado.toUpperCase()}*\n`;
        txtMoneda += `┃\n`;
        txtMoneda += `┃ ❀ ʀᴇꜱᴜʟᴛᴀᴅᴏ » ${gano ? '*¡Acertaste!* Ganaste *' + formatoMoneda(monto) + '*' : '*Fallaste.* Perdiste *' + formatoMoneda(monto) + '*'}.\n`;
        txtMoneda += `┃\n`;
        txtMoneda += `> ❖ ᴘʀᴏɢʀᴇꜱᴏ » ${estadoProgresoTexto}\n`;
        txtMoneda += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        guardarDB();
        return sock.sendMessage(chatId, { text: txtMoneda }, { quoted: msg });
    }
};
