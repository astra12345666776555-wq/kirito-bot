import fs from 'fs';
import path from 'path';

const DIR_FOTOS = path.resolve('./fotos_perfil');
if (!fs.existsSync(DIR_FOTOS)) {
    fs.mkdirSync(DIR_FOTOS, { recursive: true });
}

export default {
    name: "perfil",
    description: "Perfil gótico con ID único automático, nombre personalizable y foto local",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid, textoLimpio, obtenerJidDesdeTexto) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        if (cmdLimpio === 'perfil') {
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '⚠️ El comando `.perfil` debe usarse dentro de un grupo.' }, { quoted: msg });
            }

            let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (!targetJid && quotedJid) targetJid = quotedJid;
            if (!targetJid) targetJid = senderJid;

            if (typeof targetJid === 'string' && targetJid.includes('@lid')) {
                targetJid = targetJid.split('@')[0] + '@s.whatsapp.net';
            }

            if (!db.usuarios) db.usuarios = {};
            
            // Asignación de ID único incremental y secuencial para cada usuario registrado
            if (!db.global) db.global = {};
            if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;

            if (!db.usuarios[targetJid]) {
                db.global.contadorUsuarios++;
                db.usuarios[targetJid] = { cartera: 1000, banco: 0, nivel: 1, xp: 0, idUnico: String(db.global.contadorUsuarios).padStart(3, '0') };
                guardarDB();
            } else if (!db.usuarios[targetJid].idUnico) {
                db.global.contadorUsuarios++;
                db.usuarios[targetJid].idUnico = String(db.global.contadorUsuarios).padStart(3, '0');
                guardarDB();
            }

            const uGlobal = db.usuarios[targetJid];

            if (!db.grupos) db.grupos = {};
            if (!db.grupos[chatId]) db.grupos[chatId] = { usuarios: {} };
            if (!db.grupos[chatId].usuarios[targetJid]) {
                db.grupos[chatId].usuarios[targetJid] = { cartera: 1000, banco: 0, nivel: 1, xp: 0 };
            }
            const uGrupo = db.grupos[chatId].usuarios[targetJid];

            // Nombre modificable (reemplaza al antiguo 'Viajero'), si no tiene usa su ID por defecto
            let nombreUsuario = uGlobal.nombreCustom || uGlobal.alias || `User${uGlobal.idUnico}`;
            const genero = uGlobal.genero || 'No especificado';
            const edad = uGlobal.edad || 'No especificada';
            const cumple = uGlobal.cumple || 'No especificado';
            const pasatiempo = uGlobal.pasatiempo || 'No especificado';
            const pais = uGlobal.pais || 'No especificado';
            
            let parejaStr = 'Soltero/a';
            if (db.matrimonios) {
                for (const key in db.matrimonios) {
                    const mat = db.matrimonios[key];
                    if (mat.pareja1 === targetJid || mat.pareja2 === targetJid) {
                        let parejaJidReal = mat.pareja1 === targetJid ? mat.pareja2 : mat.pareja1;
                        let parejaData = db.usuarios?.[parejaJidReal];
                        let aliasPareja = parejaData?.nombreCustom || parejaData?.alias || `User${parejaData?.idUnico || '001'}`;
                        parejaStr = `Casado/a con ${aliasPareja}`;
                        break;
                    }
                }
            }

            const dineroLocalTotal = (uGrupo.cartera || 0) + (uGrupo.banco || 0);
            const nivelLocal = uGrupo.nivel || 1;
            const xpLocal = uGrupo.xp || 0;
            const idFijoUnico = uGlobal.idUnico;
            
            let txtPerfil = `✦ ─── ᴘᴇʀꜰɪʟ ᴅᴇ ${nombreUsuario} ─── ✦\n`;
            txtPerfil += `──────────────────\n`;
            txtPerfil += `⌦ Género: *${genero}*\n`;
            txtPerfil += `⌦ Edad: *${edad}*\n`;
            txtPerfil += `⌦ Cumpleaños: *${cumple}*\n`;
            txtPerfil += `⌦ País: *${pais}*\n`;
            txtPerfil += `⌦ Hobby: *${pasatiempo}*\n`;
            txtPerfil += `⌦ Estado Civil: *${parejaStr}*\n`;
            txtPerfil += `⌦ Dinero Total: *${formatoMoneda(dineroLocalTotal)}*\n`;
            txtPerfil += `⌦ Nivel Local: *Nivel ${nivelLocal}* (XP: *${xpLocal.toLocaleString()}*)\n`;
            txtPerfil += `⌦ ID Único: *${idFijoUnico}*\n`;
            txtPerfil += `──────────────────\n\n`;

            if (targetJid === senderJid) {
                txtPerfil += `> ⁺˚⋆｡°✩₊ Usa \`${prefijoUsado}user <nombre>\`, \`${prefijoUsado}setgenero\`, \`${prefijoUsado}setedad\`, \`${prefijoUsado}setcumple\`, \`${prefijoUsado}setpais\`, \`${prefijoUsado}setpasatiempo\` o \`${prefijoUsado}setperfil\` (en foto) para editar.`;
            }

            const rutaFotoLocal = path.join(DIR_FOTOS, `${targetJid.replace(/[^0-9]/g, '')}.jpg`);
            let mencionesArray = [targetJid];

            if (fs.existsSync(rutaFotoLocal)) {
                return sock.sendMessage(chatId, { image: { url: rutaFotoLocal }, caption: txtPerfil, mentions: mencionesArray }, { quoted: msg });
            } else {
                return sock.sendMessage(chatId, { text: txtPerfil, mentions: mencionesArray }, { quoted: msg });
            }
        }

        if (cmdLimpio === 'setperfil') {
            const m = msg.message;
            const quotedMsg = m?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = m?.imageMessage || quotedMsg?.imageMessage;

            if (!imageMessage) {
                return sock.sendMessage(chatId, { text: `⚠️ Debes enviar una imagen con el comando \`${prefijoUsado}setperfil\` o responder a una foto con él.` }, { quoted: msg });
            }

            try {
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
                const stream = await downloadMediaMessage(
                    { message: { imageMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );

                const limpioJid = senderJid.replace(/[^0-9]/g, '');
                const destinoArchivo = path.join(DIR_FOTOS, `${limpioJid}.jpg`);
                fs.writeFileSync(destinoArchivo, stream);

                return sock.sendMessage(chatId, { text: `✅ ¡Tu foto de perfil personalizada ha sido guardada! Usa \`${prefijoUsado}perfil\` para verla.` }, { quoted: msg });
            } catch (err) {
                console.error("Error al guardar foto:", err);
                return sock.sendMessage(chatId, { text: `❌ Ocurrió un error al procesar la imagen.` }, { quoted: msg });
            }
        }

        // Comando para cambiar el nombre/usuario personalizable (reemplaza a Viajero)
        if (['user', 'setuser', 'setalias', 'setapodo', 'alias', 'apodo'].includes(cmdLimpio)) {
            if (!db.usuarios) db.usuarios = {};
            if (!db.usuarios[senderJid]) {
                if (!db.global) db.global = {};
                if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;
                db.global.contadorUsuarios++;
                db.usuarios[senderJid] = { cartera: 1000, banco: 0, nivel: 1, xp: 0, idUnico: String(db.global.contadorUsuarios).padStart(3, '0') };
            }
            const nuevoNombre = args.join(' ');
            if (!nuevoNombre) return sock.sendMessage(chatId, { text: `⚠️ Uso: \`${prefijoUsado}user <tu nuevo nombre>\`` }, { quoted: msg });
            db.usuarios[senderJid].nombreCustom = nuevoNombre;
            db.usuarios[senderJid].alias = nuevoNombre; // Sincronización por compatibilidad
            guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Nombre de perfil actualizado a: *${nuevoNombre}*!` }, { quoted: msg });
        }

        if (['setgenero', 'genero'].includes(cmdLimpio)) {
            if (!db.usuarios) db.usuarios = {};
            if (!db.usuarios[senderJid]) db.usuarios[senderJid] = {};
            const nuevoTexto = args.join(' ');
            if (!nuevoTexto) return sock.sendMessage(chatId, { text: `⚠️ Uso: \`${prefijoUsado}setgenero <texto>\`` }, { quoted: msg });
            db.usuarios[senderJid].genero = nuevoTexto;
            guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Género actualizado a: *${nuevoTexto}*!` }, { quoted: msg });
        }

        if (['setedad', 'edad'].includes(cmdLimpio)) {
            if (!db.usuarios) db.usuarios = {};
            if (!db.usuarios[senderJid]) db.usuarios[senderJid] = {};
            const nuevaEdad = args[0];
            if (!nuevaEdad || isNaN(nuevaEdad)) return sock.sendMessage(chatId, { text: `⚠️ Uso: \`${prefijoUsado}setedad <número>\`` }, { quoted: msg });
            db.usuarios[senderJid].edad = nuevaEdad;
            guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Edad actualizada a: *${nuevaEdad}*!` }, { quoted: msg });
        }

        if (['setcumple', 'cumple'].includes(cmdLimpio)) {
            const nuevoCumple = args.join(' ');
            if (!nuevoCumple) return sock.sendMessage(chatId, { text: `⚠️ Uso: \`${prefijoUsado}setcumple <fecha>\`` }, { quoted: msg });
            if (!db.usuarios) db.usuarios = {};
            if (!db.usuarios[senderJid]) db.usuarios[senderJid] = {};
            db.usuarios[senderJid].cumple = nuevoCumple;
            guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Cumpleaños actualizado a: *${nuevoCumple}*!` }, { quoted: msg });
        }

        if (['setpais', 'pais'].includes(cmdLimpio)) {
            const nuevoPais = args.join(' ');
            if (!nuevoPais) return sock.sendMessage(chatId, { text: `⚠️ Uso: \`${prefijoUsado}setpais <país>\`` }, { quoted: msg });
            if (!db.usuarios) db.usuarios = {};
            if (!db.usuarios[senderJid]) db.usuarios[senderJid] = {};
            db.usuarios[senderJid].pais = nuevoPais;
            guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡País actualizado a: *${nuevoPais}*!` }, { quoted: msg });
        }

        if (['setpasatiempo', 'pasatiempo'].includes(cmdLimpio)) {
            const nuevoPasatiempo = args.join(' ');
            if (!nuevoPasatiempo) return sock.sendMessage(chatId, { text: `⚠️ Uso: \`${prefijoUsado}setpasatiempo <hobby>\`` }, { quoted: msg });
            if (!db.usuarios) db.usuarios = {};
            if (!db.usuarios[senderJid]) db.usuarios[senderJid] = {};
            db.usuarios[senderJid].pasatiempo = nuevoPasatiempo;
            guardarDB();
            return sock.sendMessage(chatId, { text: `✅ ¡Pasatiempo actualizado a: *${nuevoPasatiempo}*!` }, { quoted: msg });
        }
    }
};
