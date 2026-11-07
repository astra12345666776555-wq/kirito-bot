import fs from 'fs';

export default {
    name: "adv",
    description: "Sistema avanzado de advertencias automáticas (link, spam, palabrota, admins) con castigos configurables (mute, ban, kick).",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (cmdLimpio !== "adv") return;

        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando de moderación solo se usa en grupos.' }, { quoted: msg });
        }

        // Validar permisos (Dueño o Administrador del grupo)
        let ownerNum = String(CONFIG.OWNER_NUMBER || "51947497514").replace(/[^0-9]/g, '');
        let jidStr = typeof senderJid === 'string' ? senderJid : (senderJid?.remoteJid || senderJid?.id || String(senderJid || ""));
        let senderNum = jidStr.replace(/[^0-9]/g, '');
        let esDueño = senderNum === ownerNum || jidStr.includes(ownerNum);

        let esAdmin = esDueño;
        if (!esAdmin) {
            let metadata = await sock.groupMetadata(chatId).catch(() => null);
            let participants = metadata?.participants || [];
            let adminCheck = participants.find(p => p.id === jidStr || p.id.includes(senderNum))?.admin;
            if (adminCheck) esAdmin = true;
        }

        if (!esAdmin) {
            return sock.sendMessage(chatId, { text: "❌ Solo los administradores o el dueño pueden configurar el sistema de advertencias." }, { quoted: msg });
        }

        // Inicializar estructura en la base de datos para el grupo
        db.grupos = db.grupos || {};
        db.grupos[chatId] = db.grupos[chatId] || {};
        db.grupos[chatId].advConfig = db.grupos[chatId].advConfig || {
            adminsLibres: true, // Por defecto off para admins (admins libres)
            filtros: {
                link: { activo: false, accion: "mute", max: 3, tiempo: 10 },
                spam: { activo: false, accion: "mute", max: 3, tiempo: 5 },
                palabrota: { activo: false, accion: "mute", max: 3, tiempo: 5 }
            }
        };

        let config = db.grupos[chatId].advConfig;
        let tipoFiltro = (args[0] || "").toLowerCase();

        // 1. Configurar si los admins están sujetos a advertencias (.adv admin on/off)
        if (tipoFiltro === "admin" || tipoFiltro === "admins") {
            let estadoAdmin = (args[1] || "").toLowerCase();
            if (!["on", "off"].includes(estadoAdmin)) {
                return sock.sendMessage(chatId, { 
                    text: `⚙️ *CONFIGURACIÓN DE ADMINS EN ADV*:\n\n• Estado actual (Admins libres): *${config.adminsLibres ? "🟢 Libres (Apagado)" : "🔴 Sujetos a normas (Encendido)"}*\n• Uso:\n  - \`${prefijoUsado}adv admin on\` (Los admins también reciben advertencias)\n  - \`${prefijoUsado}adv admin off\` (Admins libres de castigos)` 
                }, { quoted: msg });
            }

            config.adminsLibres = estadoAdmin === "off";
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Configuración de administradores actualizada! Admins libres: *${config.adminsLibres ? "SÍ" : "NO"}*` }, { quoted: msg });
        }

        // 2. Validar tipo de filtro válido (link, spam, palabrota)
        if (!["link", "spam", "palabrota"].includes(tipoFiltro)) {
            let estLink = config.filtros.link.activo ? `🟢 (${config.filtros.link.accion}, máx ${config.filtros.link.max})` : "🔴 OFF";
            let estSpam = config.filtros.spam.activo ? `🟢 (${config.filtros.spam.accion}, máx ${config.filtros.spam.max})` : "🔴 OFF";
            let estPal = config.filtros.palabrota.activo ? `🟢 (${config.filtros.palabrota.accion}, máx ${config.filtros.palabrota.max})` : "🔴 OFF";

            return sock.sendMessage(chatId, {
                text: `🛡️ *SISTEMA DE ADVERTENCIAS (ADV)*:\n\n` +
                      `• *link:* ${estLink}\n` +
                      `• *spam:* ${estSpam}\n` +
                      `• *palabrota:* ${estPal}\n\n` +
                      `📌 *Ejemplos de uso*:\n` +
                      `- \`${prefijoUsado}adv link mute 3 on 10\` (Mute de 10 mins al 3er aviso)\n` +
                      `- \`${prefijoUsado}adv link ban 3 on\` (Ban directo al 3er aviso)\n` +
                      `- \`${prefijoUsado}adv link off\` (Desactivar filtro)\n` +
                      `- \`${prefijoUsado}adv admin off\` (Admins libres)`
            }, { quoted: msg });
        }

        let subArg2 = (args[1] || "").toLowerCase();

        // Desactivar filtro (.adv link off)
        if (subArg2 === "off") {
            config.filtros[tipoFiltro].activo = false;
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: `❌ Filtro antiavisos de *${tipoFiltro}* desactivado.` }, { quoted: msg });
        }

        // Activar con parámetros: .adv link mute 3 on 10  o  .adv link ban 3 on
        let accionCastigo = subArg2; // "mute", "ban", "kick"
        let maxAdvertencias = parseInt(args[2]) || 3;
        let estadoOnes = (args[3] || "").toLowerCase();
        let tiempoMuteMinutos = parseInt(args[4]) || 10;

        if (!["mute", "ban", "kick"].includes(accionCastigo) || (estadoOnes !== "on" && args[3]?.toLowerCase() !== "on" && args[1]?.toLowerCase() !== "on")) {
            // Si el usuario puso formato simple o faltan datos
            if (args[1]?.toLowerCase() === "on") {
                config.filtros[tipoFiltro].activo = true;
                if (typeof guardarDB === "function") guardarDB();
                return sock.sendMessage(chatId, { text: `✅ Filtro de *${tipoFiltro}* activado con configuración por defecto.` }, { quoted: msg });
            }
            return sock.sendMessage(chatId, { text: `⚠️ Formato incorrecto.\nEjemplo: \`${prefijoUsado}adv link mute 3 on 10\` o \`${prefijoUsado}adv link off\`` }, { quoted: msg });
        }

        config.filtros[tipoFiltro] = {
            activo: true,
            accion: accionCastigo,
            max: maxAdvertencias,
            tiempo: tiempoMuteMinutos
        };

        if (typeof guardarDB === "function") guardarDB();
        return sock.sendMessage(chatId, { 
            text: `🛡️ ¡Filtro *${tipoFiltro}* configurado y activado!\n\n• Acción: *${accionCastigo.toUpperCase()}*\n• Límite: *${maxAdvertencias} advertencias*\n` + (accionCastigo === "mute" ? `• Duración: *${tiempoMuteMinutos} minutos*\n` : ``) + `• Admins libres: *${config.adminsLibres ? "Sí" : "No"}*` 
        }, { quoted: msg });
    }
};
