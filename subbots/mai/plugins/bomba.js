import fs from "fs";

export default {
    name: "bomba",
    description: "Juego de campo minado (bomba) local por grupo con control de JID y carteras locales",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["bomba", "mine", "minas"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El campo minado solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Blindaje absoluto de JID para evitar errores con @lid
        if (!senderJid || typeof senderJid !== 'string') {
            senderJid = msg.key.participant || msg.key.remoteJid || "desconocido@s.whatsapp.net";
        }
        if (senderJid.includes('@lid')) {
            senderJid = senderJid.split('@')[0] + '@s.whatsapp.net';
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        let apuesta = parseInt(args[0]);
        if (isNaN(apuesta) || apuesta <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}bomba [monto]\`\nEjemplo: \`${prefijoUsado}bomba 1000\`` }, { quoted: msg });
        }

        if ((uGrupo.cartera || 0) < apuesta) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local de este grupo (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)}).` }, { quoted: msg });
        }

        uGrupo.cartera -= apuesta;
        if (typeof guardarDB === "function") guardarDB();

        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        let txt = `╭━━━ 💣 ❮ CAMPO MINADO (LOCAL) ❯ 💣 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👤 *Jugador:* ${tagUser}\n`;
        txt += `┃ 💰 *Apuesta:* ${formatoMoneda(apuesta)}\n`;
        txt += `┃ ⚠️ *¡Campo activado con éxito!*\n`;
        txt += `┃\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
    }
};
