export default {
    name: "prestar",
    description: "Sistema de préstamos personales entre usuarios 100% local por grupo",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "prestar") return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Los préstamos personales entre usuarios solo operan dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uEmisor = db.grupos[chatId].usuarios[senderJid];

        // Identificar al deudor (mención o respuesta)
        let mencion = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        let monto = parseInt(args[1]);
        let interesPct = parseInt(args[2]) || 5; // Interés por defecto 5%

        if (!mencion || mencion.includes("undefined") || isNaN(monto) || monto <= 0) {
            return sock.sendMessage(chatId, { text: `⚠️ Uso correcto: \`${prefijoUsado}prestar @usuario [monto] [interés%]\`\nEjemplo: \`${prefijoUsado}prestar @user 5000 10\`` }, { quoted: msg });
        }
        if (mencion === senderJid) {
            return sock.sendMessage(chatId, { text: "❌ No te puedes prestar dinero a ti mismo, crack." }, { quoted: msg });
        }

        // Validar fondos en la cartera local del emisor
        if ((uEmisor.cartera || 0) < monto) {
            return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local en este grupo para hacer este préstamo (*Disponibles:* ${formatoMoneda(uEmisor.cartera || 0)}).` }, { quoted: msg });
        }

        // Inicializar estructura del deudor en este grupo si no existe
        if (!db.grupos[chatId].usuarios[mencion]) {
            db.grupos[chatId].usuarios[mencion] = { cartera: 0, banco: 0, prestamosPersonales: [] };
        }
        let uDeudor = db.grupos[chatId].usuarios[mencion];

        // Transacción local
        uEmisor.cartera -= monto;
        uDeudor.cartera = (uDeudor.cartera || 0) + monto;

        let gananciaInteres = Math.floor(monto * (interesPct / 100));
        let totalCobro = monto + gananciaInteres;

        if (!uDeudor.prestamosPersonales || !Array.isArray(uDeudor.prestamosPersonales)) {
            uDeudor.prestamosPersonales = [];
        }

        uDeudor.prestamosPersonales.push({ 
            acreedor: senderJid, 
            deudaTotal: totalCobro,
            capital: monto,
            interes: interesPct,
            fecha: Date.now()
        });

        if (typeof guardarDB === "function") guardarDB();

        let tagEmisor = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];
        let tagDeudor = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(mencion) : "@" + mencion.split("@")[0];

        let txt = `╭━━━ 🤝 ❮ PRÉSTAMO PERSONAL (LOCAL) ❯ 🤝 ━━━╮\n`;
        txt += `┃\n`;
        txt += `┃ 👑 *Prestamista:* ${tagEmisor}\n`;
        txt += `┃ 👤 *Deudor:* ${tagDeudor}\n`;
        txt += `┃ 💵 *Capital entregado:* ${formatoMoneda(monto)}\n`;
        txt += `┃ 📈 *Interés acordado:* ${interesPct}%\n`;
        txt += `┃ 📋 *Total a devolver:* *${formatoMoneda(totalCobro)}*\n`;
        txt += `┃\n`;
        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txt, mentions: [senderJid, mencion] }, { quoted: msg });
    }
};
