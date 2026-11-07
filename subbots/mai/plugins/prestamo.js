export default {
    name: "prestamo",
    description: "Banco Central local por grupo con créditos a plazos, cuotas diarias e intereses automáticos",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["prestamo", "prestar"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ El Banco Central solo opera dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, reputacionBanco: 100, deudaBanco: 0, cuotaDiaria: 0, diasPlazoRestantes: 0, vencimientoPrestamo: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];
        let ahora = Date.now();
        let unDiaMs = 24 * 60 * 60 * 1000;

        // 🏛️ VERIFICAR CADUCIDAD Y COBRO AUTOMÁTICO DE PLAZOS / INTERESES
        if (uGrupo.deudaBanco > 0 && uGrupo.vencimientoPrestamo && ahora > uGrupo.vencimientoPrestamo) {
            let interesExtra = Math.floor(uGrupo.cuotaDiaria > 0 ? uGrupo.cuotaDiaria * 0.20 : uGrupo.deudaBanco * 0.15); // 20% de la cuota o 15% general
            uGrupo.deudaBanco += interesExtra;
            uGrupo.reputacionBanco = Math.max(0, (uGrupo.reputacionBanco || 100) - 20);

            // Intentar cobro automático de la cuota diaria de la cartera local
            let cuotaCobrar = uGrupo.cuotaDiaria > 0 ? uGrupo.cuotaDiaria : Math.floor(uGrupo.deudaBanco / Math.max(1, uGrupo.diasPlazoRestantes || 1));
            
            if ((uGrupo.cartera || 0) >= cuotaCobrar) {
                uGrupo.cartera -= cuotaCobrar;
                uGrupo.deudaBanco -= cuotaCobrar;
                uGrupo.diasPlazoRestantes = Math.max(0, (uGrupo.diasPlazoRestantes || 1) - 1);
                uGrupo.vencimientoPrestamo = ahora + unDiaMs; // Renueva por el siguiente día

                if (typeof guardarDB === "function") guardarDB();

                let txtCobroAuto = `╭━━━ 🏛️ ❮ COBRO AUTOMÁTICO DE CUOTA ❯ 🏛️ ━━━╮\n`;
                txtCobroAuto += `┃\n`;
                txtCobroAuto += `┃ ⏱️ Se cumplió el plazo de 24h en este grupo.\n`;
                txtCobroAuto += `┃ 💳 Cuota descontada: *${formatoMoneda(cuotaCobrar)}*\n`;
                txtCobroAuto += `┃ 📈 Se añadió un interés por demora de *${formatoMoneda(interesExtra)}*.\n`;
                txtCobroAuto += `┃ 📊 Deuda restante: *${formatoMoneda(uGrupo.deudaBanco)}* (${uGrupo.diasPlazoRestantes} días restantes).\n`;
                txtCobroAuto += `┃\n`;
                txtCobroAuto += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                return sock.sendMessage(chatId, { text: txtCobroAuto, mentions: [senderJid] }, { quoted: msg });
            } else {
                // Si no tiene suficiente en cartera, cae en negativo (Embargo)
                uGrupo.cartera = (uGrupo.cartera || 0) - cuotaCobrar;
                uGrupo.deudaBanco = Math.max(0, uGrupo.deudaBanco - cuotaCobrar);
                uGrupo.vencimientoPrestamo = ahora + unDiaMs;
                if (typeof guardarDB === "function") guardarDB();

                let txtEmbargo = `╭━━━ 🚨 ❮ EMBARGO BANCARIO LOCAL ❯ 🚨 ━━━╮\n`;
                txtEmbargo += `┃\n`;
                txtEmbargo += `┃ ❌ No tenías suficiente en cartera para tu cuota en este grupo.\n`;
                txtEmbargo += `┃ 📉 Se te aplicó embargo forzoso: *${formatoMoneda(cuotaCobrar)}*.\n`;
                txtEmbargo += `┃ ⚠️ *Tu cartera local quedó en NEGATIVO* (${formatoMoneda(uGrupo.cartera)}).\n`;
                txtEmbargo += `┃ 📉 Reputación cayó a: *${uGrupo.reputacionBanco}/100*\n`;
                txtEmbargo += `┃\n`;
                txtEmbargo += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                return sock.sendMessage(chatId, { text: txtEmbargo, mentions: [senderJid] }, { quoted: msg });
            }
        }

        let subOp = (args[0] || "").toLowerCase();

        // --- PAGAR PRÉSTAMO ---
        if (subOp === "pagar") {
            let deuda = uGrupo.deudaBanco || 0;
            if (deuda <= 0) {
                return sock.sendMessage(chatId, { text: "🎉 No tienes deudas pendientes con el Banco Central en este grupo." }, { quoted: msg });
            }
            if ((uGrupo.cartera || 0) < deuda) {
                return sock.sendMessage(chatId, { text: `❌ No tienes suficientes Cols en tu cartera local para pagar tu deuda total de *${formatoMoneda(deuda)}*.` }, { quoted: msg });
            }

            uGrupo.cartera -= deuda;
            uGrupo.deudaBanco = 0;
            uGrupo.cuotaDiaria = 0;
            uGrupo.diasPlazoRestantes = 0;
            uGrupo.vencimientoPrestamo = 0;
            uGrupo.reputacionBanco = Math.min(100, (uGrupo.reputacionBanco || 100) + 15);
            if (typeof guardarDB === "function") guardarDB();

            return sock.sendMessage(chatId, { text: `✅ ¡Préstamo saldado por completo en este grupo! Tu reputación bancaria subió a *${uGrupo.reputacionBanco}/100*.`, mentions: [senderJid] }, { quoted: msg });
        }

        // --- SOLICITAR PRÉSTAMO A PLAZOS: .prestamo [monto] [dias] ---
        let montoPedido = parseInt(args[0]);
        let diasPlazo = parseInt(args[1]) || 3; // Por defecto 3 días si no especifica
        let nivelUser = uGrupo.nivel || 1;
        let maxPermitido = nivelUser * 15000;

        if (isNaN(montoPedido) || montoPedido <= 0) {
            let deudaActual = uGrupo.deudaBanco || 0;
            let txtInfo = `╭━━━ 🏛️ ❮ BANCO CENTRAL (LOCAL) ❯ 🏛️ ━━━╮\n`;
            txtInfo += `┃\n`;
            txtInfo += `┃ 📈 *Tu Nivel en este Grupo:* Nivel ${nivelUser} (Límite: ${formatoMoneda(maxPermitido)})\n`;
            txtInfo += `┃ ⭐ *Reputación Crediticia:* ${uGrupo.reputacionBanco || 100}/100\n`;
            txtInfo += `┃ 📊 *Deuda Activa:* ${formatoMoneda(deudaActual)}\n`;
            if (deudaActual > 0) {
                txtInfo += `┃ 📅 *Plazos restantes:* ${uGrupo.diasPlazoRestantes || 0} días\n`;
                txtInfo += `┃ 💳 *Cuota Diaria:* ${formatoMoneda(uGrupo.cuotaDiaria || 0)}\n`;
                let horasRestantes = Math.max(0, Math.ceil((uGrupo.vencimientoPrestamo - ahora) / 3600000));
                txtInfo += `┃ ⏱️ *Próximo cobro en:* ${horasRestantes} horas\n`;
            }
            txtInfo += `┃\n`;
            txtInfo += `┣━━━ 🕹️ *COMANDOS:* ━━━\n`;
            txtInfo += `┃ • \`${prefijoUsado}prestamo <monto> <días>\`\n`;
            txtInfo += `┃ • \`${prefijoUsado}prestamo pagar\`\n`;
            txtInfo += `┃\n`;
            txtInfo += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
            return sock.sendMessage(chatId, { text: txtInfo, mentions: [senderJid] }, { quoted: msg });
        }

        if ((uGrupo.deudaBanco || 0) > 0) {
            return sock.sendMessage(chatId, { text: "❌ Ya tienes un préstamo activo en este grupo. Debes saldarlo antes de solicitar otro." }, { quoted: msg });
        }
        if (montoPedido > maxPermitido) {
            return sock.sendMessage(chatId, { text: `❌ Tu nivel actual (${nivelUser}) te limita a un crédito máximo de *${formatoMoneda(maxPermitido)}* en este grupo.` }, { quoted: msg });
        }
        if (diasPlazo < 1 || diasPlazo > 30) {
            return sock.sendMessage(chatId, { text: "❌ El plazo en días debe ser entre 1 y 30 días." }, { quoted: msg });
        }

        // Cálculo de interés (12% total fraccionado por plazo) y cuota diaria
        let interesTotal = Math.floor(montoPedido * (0.05 * diasPlazo)); // 5% por cada día de plazo
        let totalDeuda = montoPedido + interesTotal;
        let cuotaDiariaCalculada = Math.ceil(totalDeuda / diasPlazo);

        uGrupo.cartera = (uGrupo.cartera || 0) + montoPedido;
        uGrupo.deudaBanco = totalDeuda;
        uGrupo.cuotaDiaria = cuotaDiariaCalculada;
        uGrupo.diasPlazoRestantes = diasPlazo;
        uGrupo.vencimientoPrestamo = ahora + unDiaMs; // Primer vencimiento en 24 horas exactas
        if (typeof guardarDB === "function") guardarDB();

        let txtPrestamo = `╭━━━ 🏛️ ❮ CRÉDITO A PLAZOS OTORGADO ❯ 🏛️ ━━━╮\n`;
        txtPrestamo += `┃\n`;
        txtPrestamo += `┃ 💵 *Monto recibido:* +${formatoMoneda(montoPedido)}\n`;
        txtPrestamo += `┃ 📈 *Interés total:* +${formatoMoneda(interesTotal)} (${diasPlazo} días de plazo)\n`;
        txtPrestamo += `┃ 📋 *Deuda total:* *${formatoMoneda(totalDeuda)}*\n`;
        txtPrestamo += `┃ 💳 *Cuota Diaria:* *${formatoMoneda(cuotaDiariaCalculada)} / día*\n`;
        txtPrestamo += `┃ ⏱️ *Primer cobro:* En exactamente *24 horas*.\n`;
        txtPrestamo += `┃\n`;
        txtPrestamo += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        return sock.sendMessage(chatId, { text: txtPrestamo, mentions: [senderJid] }, { quoted: msg });
    }
};
