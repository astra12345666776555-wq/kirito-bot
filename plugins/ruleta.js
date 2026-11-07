import fs from "fs";

export default {
    name: "ruleta",
    description: "Juego de Ruleta local por grupo con apuestas a colores (rojo, negro, verde), multiplicadores y conteo para misiones",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["ruleta", "roulette"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ La ruleta de apuestas solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        // 1. Verificar horario de trabajo en la base local
        const ahora = Date.now();
        if (uGrupo.trabajoActivoHasta && uGrupo.trabajoActivoHasta > ahora) {
            let jefe = uGrupo.jefeTrabajo || "tu jefe";
            return sock.sendMessage(chatId, { text: `❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *${jefe}* te prohibió jugar a la ruleta en pleno turno.` }, { quoted: msg });
        }

        let eleccion = (args[0] || "").toLowerCase();
        let apuesta = parseInt(args[1]);

        if (!["rojo", "negro", "verde"].includes(eleccion) || isNaN(apuesta) || apuesta <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}ruleta [rojo/negro/verde] [monto]\`\nEjemplo: \`${prefijoUsado}ruleta rojo 5000\`` }, { quoted: msg });
        }

        if ((uGrupo.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local de este grupo (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        let rand = Math.random();
        let resultadoColor = "rojo";
        if (rand < 0.47) resultadoColor = "rojo";
        else if (rand < 0.94) resultadoColor = "negro";
        else resultadoColor = "verde";

        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let txt = `╭━━━ 🎡 ❮ RULETA DE APUESTAS (LOCAL) ❯ 🎡 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👤 *Jugador:* ${tagUser}\n`;
        txt += `┃ 🎯 *Elegiste:* *${eleccion.toUpperCase()}*\n`;
        txt += `┃ 📍 *Cayó en:* *${resultadoColor.toUpperCase()}*\n`;
        txt += `┃\n`;

        if (eleccion === resultadoColor) {
            let multiplicador = resultadoColor === "verde" ? 10 : 2;
            let gananciaNeta = apuesta * multiplicador;
            uGrupo.cartera += gananciaNeta;
            txt += `┃ 🎉 *¡Felicidades!* Ganaste *${formatoMoneda(gananciaNeta)}* (x${multiplicador}).\n`;
        } else {
            uGrupo.cartera -= apuesta;
            txt += `┃ ❌ La bola cayó en *${resultadoColor}*. Perdiste *${formatoMoneda(apuesta)}* de tu cartera local.\n`;
        }

        // 📋 Registrar avance en las Misiones Diarias del grupo
        if (!uGrupo.misionesDiarias) {
            uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, monedasJugadas: 0, palabrasOrdenadas: 0, pptJugados: 0, rapidoJugados: 0, ruletaJugadas: 0, reclamado: false };
        }
        if (uGrupo.misionesDiarias.ruletaJugadas === undefined) {
            uGrupo.misionesDiarias.ruletaJugadas = 0;
        }
        uGrupo.misionesDiarias.ruletaJugadas++;

        txt += `┃\n`;
        txt += `> 📋 _Progreso de misión actualizado (+1 tirada de ruleta)_\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        if (typeof guardarDB === "function") guardarDB();

        return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
    }
};
