import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
    name: "welcome",
    description: "Sistema de bienvenida personalizable con captura automática de imágenes por adjunto o respuesta.",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        // 1. Validar que se use dentro de un grupo
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '⚠️ Este comando de bienvenida solo se puede usar dentro de los grupos.' }, { quoted: msg });
        }

        if (!db.grupos) db.grupos = {};
        if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
        
        // Configuración por defecto
        if (!db.grupos[chatId].welcomeConfig) {
            db.grupos[chatId].welcomeConfig = {
                activo: false,
                mensaje: "❀ ¡*Bienvenido* a {grupo}!\n\t» {user}\n\nDisfruta Del Grupo\n\n> ✐ Puedes usar *{prefijo}help* para ver la lista de comandos.\n> 🜸 https://nekos.club/channel",
                imagenUrl: "menu.jpg"
            };
        }

        let wConfig = db.grupos[chatId].welcomeConfig;

        // 2. Validar permisos
        let ownerNum = String(CONFIG.OWNER_NUMBER || "51947497514").replace(/[^0-9]/g, '');
        let senderNum = String(senderJid || "").replace(/[^0-9]/g, '');
        let esDueño = senderNum === ownerNum || senderJid.includes(ownerNum);
        
        let esAdmin = esDueño;
        if (!esAdmin) {
            let metadata = await sock.groupMetadata(chatId).catch(() => null);
            let participants = metadata?.participants || [];
            let adminCheck = participants.find(p => p.id === senderJid)?.admin;
            if (adminCheck) esAdmin = true;
        }

        // --- COMANDO: .welcome on / off ---
        if (["welcome", "bienvenida"].includes(cmdLimpio)) {
            let subArg = (args[0] || "").toLowerCase();
            if (!["on", "off", "activar", "desactivar"].includes(subArg)) {
                return sock.sendMessage(chatId, { 
                    text: `⚙️ *CONFIGURACIÓN DE BIENVENIDA*:\n\n• Estado actual: *${wConfig.activo ? "🟢 Activado" : "🔴 Desactivado"}*\n• Uso:\n  - \`${prefijoUsado}welcome on/off\`\n  - \`${prefijoUsado}verwelcome\`\n  - \`${prefijoUsado}setwelcome [texto]\`\n  - \`${prefijoUsado}setwelcomeimg\` (Respondiendo a una foto)` 
                }, { quoted: msg });
            }

            if (!esAdmin) {
                return sock.sendMessage(chatId, { text: "❌ Solo los administradores pueden cambiar esto." }, { quoted: msg });
            }

            wConfig.activo = ["on", "activar"].includes(subArg);
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: wConfig.activo ? "✅ ¡Bienvenida activada!" : "❌ Bienvenida desactivada." }, { quoted: msg });
        }

        // --- COMANDO: .verwelcome ---
        if (cmdLimpio === "verwelcome") {
            let txtPreview = `📜 *PLANTILLA DE BIENVENIDA*:\n\n` +
                             `• *Estado:* ${wConfig.activo ? "🟢 ON" : "🔴 OFF"}\n` +
                             `• *Imagen:* \`${wConfig.imagenUrl}\`\n\n` +
                             `────────────────────────\n` +
                             wConfig.mensaje + 
                             `\n────────────────────────\n` +
                             `📌 *Variables:* \`{user}\`, \`{grupo}\`, \`{total}\`, \`{prefijo}\``;
            
            if (wConfig.imagenUrl) {
                let imgSource = fs.existsSync(wConfig.imagenUrl) ? { url: wConfig.imagenUrl } : { url: wConfig.imagenUrl };
                return sock.sendMessage(chatId, { image: imgSource, caption: txtPreview }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: txtPreview }, { quoted: msg });
            }
        }

        // --- COMANDO: .setwelcome <texto> ---
        if (cmdLimpio === "setwelcome") {
            if (!esAdmin) return sock.sendMessage(chatId, { text: "❌ Solo administradores." }, { quoted: msg });
            let nuevoTexto = args.join(" ").trim();
            if (!nuevoTexto) return sock.sendMessage(chatId, { text: "⚠️ Escribe el texto de bienvenida." }, { quoted: msg });

            wConfig.mensaje = nuevoTexto;
            if (typeof guardarDB === "function") guardarDB();
            return sock.sendMessage(chatId, { text: "✅ ¡Mensaje de bienvenida actualizado!" }, { quoted: msg });
        }

        // --- COMANDO: .setwelcomeimg (Captura imagen adjunta o citada) ---
        if (cmdLimpio === "setwelcomeimg") {
            if (!esAdmin) return sock.sendMessage(chatId, { text: "❌ Solo administradores." }, { quoted: msg });

            let tipoMensaje = Object.keys(msg.message || {})[0];
            let mensajeConImagen = tipoMensaje === "imageMessage" ? msg.message.imageMessage : null;
            
            let contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            let mensajeCitado = contextInfo?.quotedMessage?.imageMessage;

            let targetImage = mensajeConImagen || mensajeCitado;

            if (!targetImage) {
                return sock.sendMessage(chatId, { text: `⚠️ Envía una imagen con el comando \`${prefijoUsado}setwelcomeimg\` o **responde a una foto** con ese comando.` }, { quoted: msg });
            }

            try {
                // Crear carpeta de recursos si no existe
                const dirRecursos = path.resolve("database");
                if (!fs.existsSync(dirRecursos)) fs.mkdirSync(dirRecursos, { recursive: true });
                
                let rutaDestino = path.resolve(dirRecursos, `welcome_${chatId.replace(/[^0-9]/g, '')}.jpg`);
                
                let stream = await downloadContentFromMessage(targetImage, 'image');
                let buffer = Buffer.from([]);
                for await (let chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                fs.writeFileSync(rutaDestino, buffer);
                wConfig.imagenUrl = rutaDestino;

                if (typeof guardarDB === "function") guardarDB();
                return sock.sendMessage(chatId, { text: "🖼️ ¡Imagen de bienvenida guardada y configurada exitosamente con la foto seleccionada!" }, { quoted: msg });
            } catch (e) {
                console.error("Error al descargar la imagen de bienvenida:", e);
                return sock.sendMessage(chatId, { text: "❌ Ocurrió un error al procesar la imagen." }, { quoted: msg });
            }
        }
    }
};
