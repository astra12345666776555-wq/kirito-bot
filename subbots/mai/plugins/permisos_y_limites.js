export default {
    name: "controles",
    description: "Control de uso global diario y gestión de permisos de comandos exclusivos.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        // Inicializar estructura en la base de datos
        db.global = db.global || {};
        db.global.usoGlobalDiario = db.global.usoGlobalDiario || { fecha: "", usado: false };
        db.global.comandosPublicos = db.global.comandosPublicos || {}; // Por defecto false (solo admins/permisos)

        let ownerJid = CONFIG.OWNER_NUMBER + "@s.whatsapp.net";
        let esDueño = senderJid === ownerJid;

        // ==========================================
        // 1. COMANDO DE PERMISOS: Público o con Permisos (Por defecto)
        // ==========================================
        if (cmdLimpio === "modo" || cmdLimpio === "permisos") {
            if (!esDueño) {
                let groupMetadata = chatId.endsWith("@g.us") ? await sock.groupMetadata(chatId).catch(() => null) : null;
                let participants = groupMetadata?.participants || [];
                let userAdminCheck = participants.find(p => p.id === senderJid)?.admin;
                if (!userAdminCheck) return; // Solo admins o dueño
            }

            let subCmd = (args[0] || "").toLowerCase();
            if (subCmd === "publico" || subCmd === "todos") {
                db.global.comandosPublicos[chatId] = true;
                guardarDB();
                return await sock.sendMessage(chatId, { text: "🔓 *Modo Público Activado*: Ahora todos pueden usar los comandos especiales en este chat." }, { quoted: msg });
            } else if (subCmd === "privado" || subCmd === "admin" || subCmd === "permiso") {
                db.global.comandosPublicos[chatId] = false;
                guardarDB();
                return await sock.sendMessage(chatId, { text: "🔒 *Modo Restringido Activado* (Por defecto): Solo los usuarios con permisos o administradores pueden usar los comandos especiales." }, { quoted: msg });
            } else {
                let estadoActual = db.global.comandosPublicos[chatId] ? "Público (Todos)" : "Restringido (Solo con permisos/admins - Por defecto)";
                return await sock.sendMessage(chatId, { text: `⚙️ *Estado Actual de Permisos*: ${estadoActual}\n\n• \`${prefijoUsado}modo publico\` -> Todos pueden usarlo\n• \`${prefijoUsado}modo privado\` -> Solo los que tienen permiso / admins (Por defecto)` }, { quoted: msg });
            }
        }

        // ==========================================
        // 2. EJEMPLO DE COMANDO CON LÍMITE GLOBAL DIARIO (1 uso al día en total)
        // ==========================================
        if (cmdLimpio === "especial" || cmdLimpio === "globaldia") {
            // Validar permisos si está en modo restringido (por defecto)
            let esPublico = db.global.comandosPublicos[chatId] === true;
            if (!esPublico && !esDueño) {
                let groupMetadata = chatId.endsWith("@g.us") ? await sock.groupMetadata(chatId).catch(() => null) : null;
                let participants = groupMetadata?.participants || [];
                let userAdminCheck = participants.find(p => p.id === senderJid)?.admin;
                
                if (!userAdminCheck) {
                    return await sock.sendMessage(chatId, { text: "❌ Este comando es exclusivo para usuarios con **permisos** o administradores (por defecto). Pídele a un admin que active el acceso público con `.modo publico`." }, { quoted: msg });
                }
            }

            // Validar límite general de 1 uso al día para todo el comando
            let hoy = new Date().toISOString().split('T')[0]; // Fecha actual YYYY-MM-DD

            if (db.global.usoGlobalDiario.fecha !== hoy) {
                // Es un nuevo día, reiniciamos el contador global
                db.global.usoGlobalDiario = { fecha: hoy, usado: false };
            }

            if (db.global.usoGlobalDiario.usado && !esDueño) {
                return await sock.sendMessage(chatId, { text: `⏳ Este comando ya alcanzó su **límite de 1 uso general del día** (${hoy}). Vuelve mañana o pídele al dueño que lo ejecute.` }, { quoted: msg });
            }

            // Marcar como usado a nivel general hoy
            db.global.usoGlobalDiario.usado = true;
            guardarDB();

            // Ejecución exitosa del comando
            return await sock.sendMessage(chatId, { text: `🌟 *¡Comando global ejecutado con éxito!* Se ha consumido el único uso diario disponible para hoy (${hoy}).` }, { quoted: msg });
        }
    }
};
