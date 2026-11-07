import fs from "fs";

export default {
    name: "ppt",
    description: "Juego de Piedra, Papel o Tijera local por grupo con apuestas en cartera y conteo para misiones",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["ppt", "piedrapapeltijera"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El juego de Piedra, Papel o Tijera solo se puede jugar dentro de los grupos.' }, { quoted: msg });
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
            return sock.sendMessage(chatId, { text: `❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *${jefe}* te descubrió jugando piedra, papel o tijera.` }, { quoted: msg });
        }

        let eleccion = (args[0] || "").toLowerCase();
        let apuesta = parseInt(args[1]);
        const opciones = ["piedra", "papel", "tijera"];

        if (!opciones.includes(eleccion) || isNaN(apuesta) || apuesta <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}ppt [piedra/papel/tijera] [monto]\`\nEjemplo: \`${prefijoUsado}ppt piedra 2000\`` }, { quoted: msg });
        }

        if ((uGrupo.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local de este grupo (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        let eleccionBot = opciones[Math.floor(Math.random() * opciones.length)];
        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let txt = `╭━━━ ✂️ ❮ PIEDRA, PAPEL O TIJERA (LOCAL) ❯ ✊ ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👤 *Jugador:* ${tagUser}\n`;
        txt += `┃ 🧑‍💻 *Tú elegiste:* *${eleccion.toUpperCase()}*\n`;
        txt += `┃ 🤖 *Bot eligió:* *${eleccionBot.toUpperCase()}*\n`;
        txt += `┃\n`;

        if (eleccion === eleccionBot) {
            txt += `┃ 🤝 *¡Empate!* Se te devuelve tu dinero íntegro.\n`;
        } else if (
            (eleccion === "piedra" && eleccionBot === "tijera") ||
            (eleccion === "papel" && eleccionBot === "piedra") ||
            (eleccion === "tijera" && eleccionBot === "papel")
        ) {
            let premioDoble = apuesta * 2;
            uGrupo.cartera += apuesta; // Recupera su apuesta + gana otro tanto igual
            txt += `┃ 🎉 *¡Has ganado!* Obtuviste *${formatoMoneda(premioDoble)}*.\n`;
        } else {
            uGrupo.cartera -= apuesta;
            txt += `┃ ❌ *¡Perdiste!* Te descontaron *${formatoMoneda(apuesta)}* de tu cartera local.\n`;
        }

        // 📋 Registrar avance en las Misiones Diarias del grupo
        if (!uGrupo.misionesDiarias) {
            uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, monedasJugadas: 0, palabrasOrdenadas: 0, pptJugados: 0, reclamado: false };
        }
        if (uGrupo.misionesDiarias.pptJugados === undefined) {
            uGrupo.misionesDiarias.pptJugados = 0;
        }
        uGrupo.misionesDiarias.pptJugados++;

        txt += `┃\n`;
        txt += `> 📋 _Progreso de misión actualizado (+1 partida de PPT)_\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        if (typeof guardarDB === "function") guardarDB();

        return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
    }
};
