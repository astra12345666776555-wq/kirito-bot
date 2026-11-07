import fs from "fs";

export default {
    name: "ruletarusa",
    description: "Juego de Ruleta Rusa local por grupo con selección de balas, sistema de agallas, multiplicadores y misiones",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["ruletarusa", "disparar", "bang", "retirarruleta", "rrsa"].includes(cmdLimpio)) return;

        // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ La ruleta rusa solo se puede jugar dentro de los grupos.' }, { quoted: msg });
        }

        // Inicializar base de datos local del grupo
        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        if (!db.grupos[chatId].usuarios[senderJid]) {
            db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0 };
        }

        let uGrupo = db.grupos[chatId].usuarios[senderJid];

        if (!db.sesionesRuleta) db.sesionesRuleta = {};
        const sesionKey = `${chatId}_${senderJid}`;

        // --- INICIAR JUEGO: .ruletarusa <balas> <apuesta> ---
        if (cmdLimpio === 'ruletarusa') {
            if (db.sesionesRuleta[sesionKey]) {
                return sock.sendMessage(chatId, { text: `⚠️ Ya tienes una partida de Ruleta Rusa activa en este grupo.\nUsa \`${prefijoUsado}disparar\` para jalar el gatillo o \`${prefijoUsado}retirarruleta\` para cobrar y salir con vida.` }, { quoted: msg });
            }

            const balasArg = parseInt(args[0]);
            const apuestaArg = args[1] ? args[1].toLowerCase() : '';
            let apuesta = 0;

            if (isNaN(balasArg) || balasArg < 1 || balasArg > 5) {
                return sock.sendMessage(chatId, { text: `⚠️ Uso incorrecto.\nElige entre *1 y 5 balas* para cargar el revólver.\nEjemplo: \`${prefijoUsado}ruletarusa 3 1000\`\n*(Apuesta mínima: 100 Cols)*` }, { quoted: msg });
            }

            if (apuestaArg === 'all' || apuestaArg === 'todo') {
                apuesta = uGrupo.cartera || 0;
            } else {
                apuesta = parseInt(apuestaArg);
            }

            if (isNaN(apuesta) || apuesta < 100) {
                return sock.sendMessage(chatId, { text: `❌ La apuesta mínima para la Ruleta Rusa es de *100 Cols*.` }, { quoted: msg });
            }

            if ((uGrupo.cartera || 0) < apuesta) {
                return sock.sendMessage(chatId, { text: `❌ No tienes suficiente dinero en tu cartera local. Tienes ${formatoMoneda(uGrupo.cartera || 0)}.` }, { quoted: msg });
            }

            // Descontar la apuesta inicial de la cartera local
            uGrupo.cartera -= apuesta;
            if (typeof guardarDB === "function") guardarDB();

            // Preparar el tambor (6 recámaras: true = bala, false = vacío)
            let tambor = new Array(6).fill(false);
            let puestas = 0;
            while (puestas < balasArg) {
                let index = Math.floor(Math.random() * 6);
                if (!tambor[index]) {
                    tambor[index] = true;
                    puestas++;
                }
            }

            // Guardar sesión aislada
            db.sesionesRuleta[sesionKey] = {
                tambor: tambor,
                balasTotales: balasArg,
                apuesta: apuesta,
                pasoActual: 0
            };

            let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

            let txt = `╭━━━ 🔫 ❮ RULETA RUSA TÁCTICA ❯ 🔫 ━━━╮\n`;
            txt += `┃\n`;
            txt += `┃ 👤 *Jugador:* ${tagUser}\n`;
            txt += `┃ 💰 *Apuesta local:* ${formatoMoneda(apuesta)}\n`;
            txt += `┃ 💥 *Carga:* ${balasArg} bala(s) en 6 recámaras\n`;
            txt += `┃\n`;
            txt += `> 🎲 *¡El tambor giró con fuerza!* La tensión se siente en el grupo.\n`;
            txt += `┃ 👉 Escribe \`${prefijoUsado}disparar\` para jalar el gatillo.\n`;
            txt += `┃ 💵 Escribe \`${prefijoUsado}retirarruleta\` para cobrar antes de arriesgar.\n`;
            txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txt, mentions: [senderJid] }, { quoted: msg });
        }

        // --- DISPARAR / JALAR GATILLO ---
        if (["disparar", "bang"].includes(cmdLimpio)) {
            if (!db.sesionesRuleta[sesionKey]) {
                return sock.sendMessage(chatId, { text: `⚠️ No tienes ninguna partida activa de Ruleta Rusa.\nInicia una con \`${prefijoUsado}ruletarusa <balas> <apuesta>\`.` }, { quoted: msg });
            }

            let sesion = db.sesionesRuleta[sesionKey];
            let slotActual = sesion.pasoActual;
            let hayBala = sesion.tambor[slotActual];
            sesion.pasoActual++;

            let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

            if (hayBala) {
                // --- ¡MURIÓ! ---
                const perdida = sesion.apuesta;
                delete db.sesionesRuleta[sesionKey];
                if (typeof guardarDB === "function") guardarDB();

                let txtMuerte = `╭━━━ 💥 ❮ ¡BANG! ¡DISPARO FATAL! ❯ 💀 ━━━╮\n`;
                txtMuerte += `┃\n`;
                txtMuerte += `┃ 👤 *Jugador:* ${tagUser}\n`;
                txtMuerte += `┃ 🔫 La recámara #${sesion.pasoActual} estaba cargada.\n`;
                txtMuerte += `┃ 💸 Has perdido tu apuesta de *${formatoMoneda(perdida)}* en este grupo.\n`;
                txtMuerte += `┃\n`;
                txtMuerte += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                return sock.sendMessage(chatId, { text: txtMuerte, mentions: [senderJid] }, { quoted: msg });
            } else {
                // --- ¡SOBREVIVIÓ! ---
                // Multiplicador más agresivo y jugable basado en agallas
                let multiplicador = 1 + (sesion.balasTotales * 0.20 * sesion.pasoActual);
                
                // Bono secreto de racha si sobrevive al paso 3 o más
                if (sesion.pasoActual >= 3) {
                    multiplicador *= 1.35; // +35% extra de agallas
                }

                let gananciasAcumuladas = Math.floor(sesion.apuesta * multiplicador);

                if (sesion.pasoActual >= 6) {
                    uGrupo.cartera = (uGrupo.cartera || 0) + gananciasAcumuladas;
                    delete db.sesionesRuleta[sesionKey];

                    // Registrar en misiones diarias
                    if (!uGrupo.misionesDiarias) {
                        uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, ruletaRusaJugadas: 0, reclamado: false };
                    }
                    if (uGrupo.misionesDiarias.ruletaRusaJugadas === undefined) uGrupo.misionesDiarias.ruletaRusaJugadas = 0;
                    uGrupo.misionesDiarias.ruletaRusaJugadas++;

                    if (typeof guardarDB === "function") guardarDB();

                    let txtEpico = `╭━━━ 🏆 ❮ ¡TAMBOR COMPLETADO! ❯ 🌟 ━━━╮\n`;
                    txtEpico += `┃\n`;
                    txtEpico += `┃ 👤 *Sobreviviente Legendario:* ${tagUser}\n`;
                    txtEpico += `┃ 🎯 ¡Vaciaste las 6 recámaras con ${sesion.balasTotales} balas!\n`;
                    txtEpico += `┃ 💰 *Recompensa Épica:* *${formatoMoneda(gananciasAcumuladas)}*\n`;
                    txtEpico += `┃\n`;
                    txtEpico += `> 📋 _Progreso de misión actualizado_\n`;
                    txtEpico += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                    return sock.sendMessage(chatId, { text: txtEpico, mentions: [senderJid] }, { quoted: msg });
                }

                let txtSobrevive = `╭━━━ ✨ ❮ ¡CLICK... VACÍA! ❯ 😅 ━━━╮\n`;
                txtSobrevive += `┃\n`;
                txtSobrevive += `┃ 👤 *Jugador:* ${tagUser}\n`;
                txtSobrevive += `┃ 🛡️ Sobreviviste a la recámara #${sesion.pasoActual} de 6.\n`;
                txtSobrevive += `┃ 💰 *Pozo acumulado:* ${formatoMoneda(gananciasAcumuladas)} (~${multiplicador.toFixed(2)}x)\n`;
                txtSobrevive += `┃\n`;
                txtSobrevive += `> ⚔️ ¿Qué decides, arriesgas el pellejo o te retiras?\n`;
                txtSobrevive += `┃ 👉 \`${prefijoUsado}disparar\` (Siguiente cámara)\n`;
                txtSobrevive += `┃ 💵 \`${prefijoUsado}retirarruleta\` (Cobrar ahora)\n`;
                txtSobrevive += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

                return sock.sendMessage(chatId, { text: txtSobrevive, mentions: [senderJid] }, { quoted: msg });
            }
        }

        // --- RETIRARSE DE LA RULETA ---
        if (["retirarruleta", "rrsa"].includes(cmdLimpio)) {
            if (!db.sesionesRuleta[sesionKey]) {
                return sock.sendMessage(chatId, { text: `⚠️ No tienes ninguna partida activa de Ruleta Rusa en este grupo.` }, { quoted: msg });
            }

            let sesion = db.sesionesRuleta[sesionKey];
            let aCobrar = sesion.apuesta;

            if (sesion.pasoActual > 0) {
                let multiplicador = 1 + (sesion.balasTotales * 0.20 * sesion.pasoActual);
                if (sesion.pasoActual >= 3) multiplicador *= 1.35;
                aCobrar = Math.floor(sesion.apuesta * multiplicador);
            }

            uGrupo.cartera = (uGrupo.cartera || 0) + aCobrar;
            delete db.sesionesRuleta[sesionKey];

            // Registrar en misiones diarias
            if (!uGrupo.misionesDiarias) {
                uGrupo.misionesDiarias = { triviasJugadas: 0, trabajosHechos: 0, ruletaRusaJugadas: 0, reclamado: false };
            }
            if (uGrupo.misionesDiarias.ruletaRusaJugadas === undefined) uGrupo.misionesDiarias.ruletaRusaJugadas = 0;
            uGrupo.misionesDiarias.ruletaRusaJugadas++;

            if (typeof guardarDB === "function") guardarDB();

            let tagUser = typeof obtenerTagUsuario === "function" ? obtenerTagUsuario(senderJid) : "@" + senderJid.split("@")[0];

            let txtRetiro = `╭━━━ 🏳️ ❮ RETIRO TÁCTICO EXITOSO ❯ 💵 ━━━╮\n`;
            txtRetiro += `┃\n`;
            txtRetiro += `┃ 👤 *Cobrador:* ${tagUser}\n`;
            txtRetiro += `┃ 🛡️ Decidiste retirarte a tiempo con vida.\n`;
            txtRetiro += `┃ 💰 *Dinero asegurado:* *${formatoMoneda(aCobrar)}*\n`;
            txtRetiro += `┃\n`;
            txtRetiro += `> 📋 _Progreso de misión actualizado_\n`;
            txtRetiro += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

            return sock.sendMessage(chatId, { text: txtRetiro, mentions: [senderJid] }, { quoted: msg });
        }
    }
};
