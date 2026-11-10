import fs from "fs";
import { generarImagenMisiones } from "./misionesImage.js";

export default {
    name: "misiones",
    description: "Misiones diarias en tarjeta de imagen (Jimp) con estética gótica en el caption",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        const cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["misiones", "quests", "mission"].includes(cmdLimpio)) return;

        if (!chatId.endsWith("@g.us")) {
            return sock.sendMessage(chatId, { text: "⚠️ Este comando debe usarse dentro de un grupo." }, { quoted: msg });
        }

        let targetJid = senderJid;
        if (typeof targetJid === "string" && targetJid.includes("@lid")) {
            targetJid = targetJid.split("@")[0] + "@s.whatsapp.net";
        }

        // --- Inicialización segura de la DB ---
        db.global = db.global || {};
        db.grupos = db.grupos || {};
        db.grupos[chatId] = db.grupos[chatId] || {};
        db.grupos[chatId].usuarios = db.grupos[chatId].usuarios || {};
        db.usuarios = db.usuarios || {};
        if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;

        if (!db.grupos[chatId].usuarios[targetJid]) {
            db.grupos[chatId].usuarios[targetJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
        }
        const uGrupo = db.grupos[chatId].usuarios[targetJid];

        if (!db.usuarios[targetJid]) {
            db.global.contadorUsuarios++;
            db.usuarios[targetJid] = { idUnico: String(db.global.contadorUsuarios).padStart(3, "0") };
            guardarDB();
        } else if (!db.usuarios[targetJid].idUnico) {
            db.global.contadorUsuarios++;
            db.usuarios[targetJid].idUnico = String(db.global.contadorUsuarios).padStart(3, "0");
            guardarDB();
        }

        const uGlobal = db.usuarios[targetJid];
        const numeroSeco = targetJid.replace(/[^0-9]/g, "");
        const nombreMostrar = uGlobal.nombreCustom || uGlobal.alias || (uGlobal.idUnico ? `User${uGlobal.idUnico}` : numeroSeco);

        // --- Inicializar misiones ---
        if (!uGrupo.misiones) uGrupo.misiones = {};
        if (!uGrupo.misiones.moneda) uGrupo.misiones.moneda = { progreso: 0, meta: 3, completado: false, recompensa: 6000 };
        if (!uGrupo.misiones.trivia) uGrupo.misiones.trivia = { progreso: 0, meta: 2, completado: false, recompensa: 5000 };
        if (!uGrupo.misiones.ahorcado) uGrupo.misiones.ahorcado = { progreso: 0, meta: 1, completado: false, recompensa: 7000 };

        const mis = uGrupo.misiones;

        const definiciones = [
            { num: 1, clave: "moneda", titulo: "Maestro del Azar", descripcion: `Gana ${mis.moneda.meta} veces en ${prefijoUsado}moneda` },
            { num: 2, clave: "trivia", titulo: "Sabio de la Trivia", descripcion: `Usa ${prefijoUsado}trivia` },
            { num: 3, clave: "ahorcado", titulo: "Cazador de Palabras", descripcion: `Usa ${prefijoUsado}ahorcado` }
        ];

        const lista = definiciones.map(d => ({
            num: d.num,
            titulo: d.titulo,
            descripcion: d.descripcion,
            progreso: mis[d.clave].progreso,
            meta: mis[d.clave].meta,
            completado: mis[d.clave].completado,
            recompensa: mis[d.clave].recompensa
        }));

        // --- Texto gótico completo (respaldo si falla la imagen) ---
        let txtMisiones = `「✿」 *ᴍɪꜱɪᴏɴᴇꜱ ᴅɪᴀʀɪᴀꜱ ᴅᴇ ${nombreMostrar}*:\n\n`;
        for (const m of lista) {
            const estado = m.completado ? "ᴄᴏᴍᴘʟᴇᴛᴀᴅᴏ 🜲" : `${m.progreso}/${m.meta} (ᴘᴇɴᴅɪᴇɴᴛᴇ)`;
            txtMisiones += `✰ ${m.num} » *${m.titulo}* (${m.descripcion})\n`;
            txtMisiones += `\t\t ᴇꜱᴛᴀᴅᴏ » *${estado}* | ᴘʀᴇᴍɪᴏ » *${formatoMoneda(m.recompensa)}*\n\n`;
        }
        txtMisiones += `> • ᴄᴏᴍᴘʟᴇᴛᴀ ᴛᴜꜱ ᴍɪꜱɪᴏɴᴇꜱ ᴘᴀʀᴀ ʀᴇᴄʟᴀᴍᴀʀ ʀᴇᴄᴏᴍᴘᴇɴꜱᴀꜱ.`;

        // --- Caption corto (premios con tu formatoMoneda) ---
        let caption = `「✿」 *ᴍɪꜱɪᴏɴᴇꜱ ᴅɪᴀʀɪᴀꜱ ᴅᴇ ${nombreMostrar}*\n\n`;
        for (const m of lista) {
            caption += `✰ ${m.num} » *${m.titulo}* » ${m.completado ? "🜲" : `${m.progreso}/${m.meta}`} » *${formatoMoneda(m.recompensa)}*\n`;
        }
        caption += `\n> • ᴄᴏᴍᴘʟᴇᴛᴀ ᴛᴜꜱ ᴍɪꜱɪᴏɴᴇꜱ ᴘᴀʀᴀ ʀᴇᴄʟᴀᴍᴀʀ ʀᴇᴄᴏᴍᴘᴇɴꜱᴀꜱ.`;

        let ruta = null;
        try {
            ruta = await generarImagenMisiones({ nombre: nombreMostrar, misiones: lista });
            return await sock.sendMessage(chatId, { image: { url: ruta }, caption }, { quoted: msg });
        } catch (e) {
            console.error("❌ Error generando la tarjeta de misiones:", e.message);
            return sock.sendMessage(chatId, { text: txtMisiones }, { quoted: msg });
        } finally {
            if (ruta) { try { fs.unlinkSync(ruta); } catch {} }
        }
    }
};
