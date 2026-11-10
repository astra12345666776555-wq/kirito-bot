import fs from 'fs';

export default {
    name: "robar",
    description: "Sistema de robos y atracos locales por grupo con validación de guardias y horarios",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        if (comando === "robar" || comando === "steal") {
            // 🛡️ REGLA DE GRUPO: Validar que se use en un grupo
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '⚠️ El comando `.robar` solo se puede ejecutar dentro de los grupos.' }, { quoted: msg });
            }

            // Inicializar base de datos local del grupo para emisor y estructura general
            if (!db.grupos) db.grupos = {};
            if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, inventario: [] };
            }

            let uGrupo = db.grupos[chatId].usuarios[senderJid];
            const ahora = Date.now();

            // 1. Verificar horario de trabajo local en este grupo
            if (uGrupo.trabajoActivoHasta && uGrupo.trabajoActivoHasta > ahora) {
                let jefe = uGrupo.jefeTrabajo || "tu jefe";
                let msgBloqueo = "╭━━━ ❌ ❮ HORARIO LABORAL ❯ ❌ ━━━╮\n";
                msgBloqueo += "┃\n";
                msgBloqueo += "┃ 👔 Tu jefe *" + jefe + "* te descubrió intentando robar en pleno turno dentro de este grupo.\n";
                msgBloqueo += "┃\n";
                msgBloqueo += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";
                return sock.sendMessage(chatId, { text: msgBloqueo, mentions: [senderJid] }, { quoted: msg });
            }

            // 2. Verificar Cooldown local de 10 minutos
            if (uGrupo.cooldownRobo && uGrupo.cooldownRobo > ahora) {
                let tiempoRestante = Math.ceil((uGrupo.cooldownRobo - ahora) / 1000);
                let minutos = Math.floor(tiempoRestante / 60);
                let segundos = tiempoRestante % 60;
                return sock.sendMessage(chatId, { text: `⏳ *¡ESTÁS EN COOLDOWN EN ESTE GRUPO!* \nDebes esperar *[${minutos}m ${segundos}s]* para volver a intentar un atraco aquí.`, mentions: [senderJid] }, { quoted: msg });
            }

            // 3. Identificar a la víctima
            let objetivoId = null;
            if (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) {
                let ctx = msg.message.extendedTextMessage.contextInfo;
                if (ctx.participant) objetivoId = ctx.participant;
                else if (ctx.mentionedJid && ctx.mentionedJid.length > 0) objetivoId = ctx.mentionedJid[0];
            }

            if (!objetivoId && msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                objetivoId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            }

            if (!objetivoId) {
                return sock.sendMessage(chatId, { text: "⚠️ Debes responder al mensaje de la víctima o mencionarla con *@usuario* para intentar robarle en este grupo." }, { quoted: msg });
            }

            if (objetivoId === senderJid) {
                return sock.sendMessage(chatId, { text: "❌ No puedes robarte a ti mismo, crack." }, { quoted: msg });
            }

            // Buscar a la víctima en el mismo grupo
            let usuariosGrupo = db.grupos[chatId].usuarios;
            if (!usuariosGrupo[objetivoId]) {
                return sock.sendMessage(chatId, { text: "❌ Esa persona no tiene registros económicos en este grupo aún." }, { quoted: msg });
            }

            let victimaLocal = usuariosGrupo[objetivoId];

            if (!victimaLocal.cartera || victimaLocal.cartera <= 0) {
                return sock.sendMessage(chatId, { text: "❌ La cartera de tu objetivo está vacía en este grupo. ¡No hay nada que saquear!" }, { quoted: msg });
            }

            // 4. Calcular el botín potencial (entre 10% y 30% de la cartera local de la víctima)
            let porcentajePotencial = Math.floor(Math.random() * 21) + 10;
            let botinPotencial = Math.floor((victimaLocal.cartera * porcentajePotencial) / 100);
            if (botinPotencial < 1) botinPotencial = 1;

            // 4.5 Guardia por tiempo (comprada en .shop guardias)
            if (victimaLocal.guardianHasta && victimaLocal.guardianHasta > ahora) {
                const ms = victimaLocal.guardianHasta - ahora;
                const h = Math.floor(ms / 3600000);
                const m = Math.floor((ms % 3600000) / 60000);
                let txtG = "╭━━━ 🛡️ ❮ ROBO FRUSTRADO ❯ 🛡️ ━━━╮\n";
                txtG += "┃\n";
                txtG += "┃ Un guardia protege la cartera de tu objetivo.\n";
                txtG += "┃ ⏳ Protección restante: *" + h + "h " + m + "m*\n";
                txtG += "┃\n";
                txtG += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";
                return sock.sendMessage(chatId, { text: txtG, mentions: [senderJid, objetivoId] }, { quoted: msg });
            }

            // 5. Verificar si la víctima tiene guardia activo con usos disponibles en este grupo
            let tieneGuardiaActivo = false;
            let usosGuardia = victimaLocal.usosGuardia || 0;

            if ((victimaLocal.guardiaHasta && victimaLocal.guardiaHasta > ahora) || victimaLocal.guardia === true || usosGuardia > 0) {
                tieneGuardiaActivo = true;
            }

            if (tieneGuardiaActivo) {
                if (usosGuardia > 1) {
                    victimaLocal.usosGuardia = usosGuardia - 1;
                } else {
                    victimaLocal.guardia = false;
                    victimaLocal.guardiaHasta = 0;
                    victimaLocal.usosGuardia = 0;
                    if (Array.isArray(victimaLocal.inventario)) {
                        victimaLocal.inventario = victimaLocal.inventario.filter(item => {
                            let nombre = typeof item === "string" ? item : (item.nombre || "");
                            return !nombre.toLowerCase().includes("guardia") && !nombre.toLowerCase().includes("escolta") && !nombre.toLowerCase().includes("perro") && !nombre.toLowerCase().includes("cyborg") && !nombre.toLowerCase().includes("nanobot") && !nombre.toLowerCase().includes("enjambre");
                        });
                    }
                }
                if (typeof guardarDB === "function") guardarDB();

                let txtGuardia = "╭━━━ 🛡️ ❮ ROBO FRUSTRADO ❯ 🛡️ ━━━╮\n";
                txtGuardia += "┃\n";
                txtGuardia += "┃ El sistema de seguridad local de tu objetivo neutralizó el ataque.\n";
                txtGuardia += "┃ 📉 Usos restantes del defensor: *" + (victimaLocal.usosGuardia || 0) + "*\n";
                txtGuardia += "┃\n";
                txtGuardia += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";
                return sock.sendMessage(chatId, { text: txtGuardia, mentions: [senderJid, objetivoId] }, { quoted: msg });
            }

            // 6. Probabilidad de éxito (20%)
            let exito = Math.random() < 0.20;

            if (exito) {
                victimaLocal.cartera -= botinPotencial;
                uGrupo.cartera = (uGrupo.cartera || 0) + botinPotencial;
                if (typeof guardarDB === "function") guardarDB();

                let txtExito = "╭━━━ 🥷 ❮ ROBO EXITOSO ❯ 🥷 ━━━╮\n";
                txtExito += "┃\n";
                txtExito += "┃ ¡Lograste saquear la cartera local de tu objetivo!\n";
                txtExito += "┃ 🎉 Botín obtenido: 🪙 *" + formatoMoneda(botinPotencial) + "* (" + porcentajePotencial + "%).\n";
                txtExito += "┃\n";
                txtExito += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";
                return sock.sendMessage(chatId, { text: txtExito, mentions: [senderJid, objetivoId] }, { quoted: msg });
            } else {
                // Activar Cooldown local de 10 minutos
                uGrupo.cooldownRobo = ahora + (10 * 60 * 1000);

                let porcentajeMulta = Math.floor(Math.random() * 41) + 10; // Entre 10% y 50% del botín
                let multaRobo = Math.floor((botinPotencial * porcentajeMulta) / 100);
                if (multaRobo < 1) multaRobo = 1;
                if (multaRobo > uGrupo.cartera) multaRobo = uGrupo.cartera || 0;

                uGrupo.cartera -= multaRobo;
                if (typeof guardarDB === "function") guardarDB();

                let txtFallo = "╭━━━ 🚨 ❮ ATRAPADO EN EL ROBO ❯ 🚨 ━━━╮\n";
                txtFallo += "┃\n";
                txtFallo += "┃ La policía local frustró tu atraco (Probabilidad: 20%).\n";
                txtFallo += "┃ 💸 Multa aplicada (*" + porcentajeMulta + "%*): 🪙 *" + formatoMoneda(multaRobo) + "*.\n";
                txtFallo += "┃ ⏳ *Cooldown:* Debes esperar 10 minutos en este grupo para volver a robar.\n";
                txtFallo += "┃\n";
                txtFallo += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯";
                return sock.sendMessage(chatId, { text: txtFallo, mentions: [senderJid] }, { quoted: msg });
            }
        }
    }
};
