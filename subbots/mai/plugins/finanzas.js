import fs from "fs";

export default {
    name: "finanzas",
    description: "Sistema financiero local por grupo (.dep, .ret, .pagar, .transferir)",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["finanzas", "dep", "depositar", "ret", "retirar", "pagar", "transferir"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Las operaciones financieras solo se pueden realizar dentro de los grupos.' }, { quoted: msg });
        }

        // Blindaje absoluto de JID
        if (!senderJid || typeof senderJid !== 'string') {
            senderJid = msg.key.participant || msg.key.remoteJid || "desconocido@s.whatsapp.net";
        }
        if (senderJid.includes('@lid')) {
            senderJid = senderJid.split('@')[0] + '@s.whatsapp.net';
        }

        // Inicializar base de datos local del grupo de forma segura (Línea 14 blindada)
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 1000, banco: 0, carteraCompartida: 0, bancoCompartido: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];
        let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

        // --- COMANDO DEPOSITAR (.dep / .depositar) ---
        if (["dep", "depositar"].includes(cmdLimpio)) {
            let argMonto = (args[0] || "").toLowerCase();
            let monto = 0;

            if (argMonto === "all" || argMonto === "todo") {
                monto = uGrupo.cartera || 0;
            } else {
                monto = parseInt(argMonto);
            }

            if (isNaN(monto) || monto <= 0) {
                return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}dep [monto | all]\`` }, { quoted: msg });
            }

            if ((uGrupo.cartera || 0) < monto) {
                return sock.sendMessage(chatId, { text: `❌ No tienes esa cantidad en tu cartera local. (*Tienes:* ${formatoMoneda(uGrupo.cartera || 0)})` }, { quoted: msg });
            }

            uGrupo.cartera -= monto;
            uGrupo.banco = (uGrupo.banco || 0) + monto;
            if (typeof guardarDB === "function") guardarDB();

            let txt = `╭━━━ 🏦 ❮ DEPÓSITO BANCARIO (LOCAL) ❯ 💰 ━━━╮\n`;
            txt += `┃\n`;
            txt += `┃ 👤 *Usuario:* ${tagUser}\n`;
            txt += `┃ 📥 Depositado: *${formatoMoneda(monto)}*\n`;
            txt += `┃ 💼 Cartera actual: *${formatoMoneda(uGrupo.cartera)}*\n`;
            txt += `┃ 🏛️ Banco actual: *${formatoMoneda(uGrupo.banco)}*\n`;
            txt += `┃\n`;
            txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
        }

        // --- COMANDO RETIRAR (.ret / .retirar) ---
        if (["ret", "retirar"].includes(cmdLimpio)) {
            let argMonto = (args[0] || "").toLowerCase();
            let monto = 0;

            if (argMonto === "all" || argMonto === "todo") {
                monto = uGrupo.banco || 0;
            } else {
                monto = parseInt(argMonto);
            }

            if (isNaN(monto) || monto <= 0) {
                return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}ret [monto | all]\`` }, { quoted: msg });
            }

            if ((uGrupo.banco || 0) < monto) {
                return sock.sendMessage(chatId, { text: `❌ No tienes esa cantidad en tu banco local. (*Banco:* ${formatoMoneda(uGrupo.banco || 0)})` }, { quoted: msg });
            }

            uGrupo.banco -= monto;
            uGrupo.cartera = (uGrupo.cartera || 0) + monto;
            if (typeof guardarDB === "function") guardarDB();

            let txt = `╭━━━ 💸 ❮ RETIRO BANCARIO (LOCAL) ❯ 💰 ━━━╮\n`;
            txt += `┃\n`;
            txt += `┃ 👤 *Usuario:* ${tagUser}\n`;
            txt += `┃ 📤 Retirado: *${formatoMoneda(monto)}*\n`;
            txt += `┃ 💼 Cartera actual: *${formatoMoneda(uGrupo.cartera)}*\n`;
            txt += `┃ 🏛️ Banco actual: *${formatoMoneda(uGrupo.banco)}*\n`;
            txt += `┃\n`;
            txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
        }
    }
};
