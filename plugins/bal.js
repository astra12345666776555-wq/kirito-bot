import fs from "fs";
import { generarImagenBal } from "./balImage.js";

export default {
    name: "bal",
    description: "Comando de balance con tarjeta en imagen (Jimp) y diseño gótico en el caption",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        const cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["bal", "balance", "cartera", "dinero"].includes(cmdLimpio)) return;

        if (!chatId.endsWith("@g.us")) {
            return sock.sendMessage(chatId, { text: "⚠️ Este comando debe usarse dentro de un grupo." }, { quoted: msg });
        }

        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        let targetJid = ctx?.mentionedJid?.[0] || ctx?.participant || senderJid;

        if (typeof targetJid === "string" && targetJid.includes("@lid")) {
            targetJid = targetJid.split("@")[0] + "@s.whatsapp.net";
        }

        // --- Inicialización segura de la DB ---
        db.global = db.global || {};
        db.grupos = db.grupos || {};
        db.grupos[chatId] = db.grupos[chatId] || {};
        db.grupos[chatId].usuarios = db.grupos[chatId].usuarios || {};
        db.usuarios = db.usuarios || {};
        db.matrimonios = db.matrimonios || {};
        if (!db.global.contadorUsuarios) db.global.contadorUsuarios = 0;

        if (!db.grupos[chatId].usuarios[targetJid]) {
            db.grupos[chatId].usuarios[targetJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0, guardianHasta: 0 };
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

        // --- Buscar si está casado ---
        let parejaJid = null;
        for (const key in db.matrimonios) {
            const mat = db.matrimonios[key];
            if (mat.pareja1 === targetJid) { parejaJid = mat.pareja2; break; }
            else if (mat.pareja2 === targetJid) { parejaJid = mat.pareja1; break; }
        }

        const cartera = uGrupo.cartera || 0;
        const bancoPersonal = uGrupo.banco || 0;
        let bancoTotal = bancoPersonal;
        let nombrePareja = null;

        if (parejaJid) {
            if (!db.usuarios[parejaJid]) {
                db.global.contadorUsuarios++;
                db.usuarios[parejaJid] = { idUnico: String(db.global.contadorUsuarios).padStart(3, "0") };
                guardarDB();
            }
            const uGlobPareja = db.usuarios[parejaJid];
            const numSecoPareja = parejaJid.replace(/[^0-9]/g, "");
            nombrePareja = uGlobPareja.nombreCustom || uGlobPareja.alias || (uGlobPareja.idUnico ? `User${uGlobPareja.idUnico}` : numSecoPareja);

            if (db.grupos[chatId].usuarios[parejaJid]) {
                bancoTotal = bancoPersonal + (db.grupos[chatId].usuarios[parejaJid].banco || 0);
            }
        }

        const total = cartera + bancoTotal;
        const nivel = uGrupo.nivel || 1;
        const xp = uGrupo.xp || 0;

        // --- Guardián ---
        let tiempoProteccionTexto = "Ninguna";
        const ahora = Date.now();
        if (uGrupo.guardianHasta && uGrupo.guardianHasta > ahora) {
            const ms = uGrupo.guardianHasta - ahora;
            const horas = Math.floor(ms / (1000 * 60 * 60));
            const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            tiempoProteccionTexto = `${horas}h ${minutos}m restantes`;
        }

        // --- Misiones ---
        let misionesCompletadasTotal = true;
        if (uGrupo.misiones) {
            for (const mKey in uGrupo.misiones) {
                if (!uGrupo.misiones[mKey].completado) { misionesCompletadasTotal = false; break; }
            }
        } else {
            misionesCompletadasTotal = false;
        }
        const estadoMisionTxt = misionesCompletadasTotal ? "➪ *¡Misión Completada!* 🜲" : "Pendientes";

        // --- Texto gótico completo (respaldo si falla la imagen) ---
        let txtBal = `✦ ─── ᴇᴄᴏɴᴏᴍíᴀ ─── ✦\n`;
        txtBal += `➪ ᴜꜱᴜᴀʀɪᴏ » *${nombreMostrar}*\n`;
        txtBal += `──────────────────\n`;
        txtBal += `⛀ ᴄᴀʀᴛᴇʀᴀ » *${formatoMoneda(cartera)}*\n`;
        txtBal += parejaJid
            ? `⚿ ʙᴀɴᴄᴏ ᴄᴏᴍᴘᴀʀᴛɪᴅᴏ » *${formatoMoneda(bancoTotal)}*\n`
            : `⚿ ʙᴀɴᴄᴏ » *${formatoMoneda(bancoPersonal)}*\n`;
        txtBal += `⛁ ᴛᴏᴛᴀʟ » *${formatoMoneda(total)}*\n`;
        txtBal += `──────────────────\n`;
        txtBal += `✰ ɴɪᴠᴇʟ » *${nivel}*\n`;
        txtBal += `✰ xᴘ » *${xp}*\n`;
        if (parejaJid) txtBal += `ꨄ︎ ᴘᴀʀᴇᴊᴀ » *${nombrePareja}*\n`;
        txtBal += `⛊ ᴘʀᴏᴛᴇᴄᴄɪóɴ » *${tiempoProteccionTexto}*\n`;
        txtBal += `➶ ᴍɪꜱɪÓɴ » ${estadoMisionTxt}\n`;
        txtBal += `──────────────────\n\n`;
        txtBal += `> ⁺˚⋆｡°✩₊ ᴘᴀʀᴀ ᴘʀᴏᴛᴇɢᴇʀ ᴛᴜ ᴅɪɴᴇʀᴏ, ᴅᴇᴘóꜱɪᴛᴀ ᴄᴏɴ \`${prefijoUsado}dep all\``;

        // --- Caption corto que acompaña a la imagen ---
        let caption = `✦ ─── ᴇᴄᴏɴᴏᴍíᴀ ─── ✦\n`;
        caption += `➪ ᴜꜱᴜᴀʀɪᴏ » *${nombreMostrar}*\n`;
        caption += `⛁ ᴛᴏᴛᴀʟ » *${formatoMoneda(total)}*\n\n`;
        caption += `> ⁺˚⋆｡°✩₊ ᴘᴀʀᴀ ᴘʀᴏᴛᴇɢᴇʀ ᴛᴜ ᴅɪɴᴇʀᴏ, ᴅᴇᴘóꜱɪᴛᴀ ᴄᴏɴ \`${prefijoUsado}dep all\``;

        let ruta = null;
        try {
            ruta = await generarImagenBal({
                nombre: nombreMostrar,
                cartera,
                banco: bancoTotal,
                bancoCompartido: !!parejaJid,
                total,
                nivel,
                xp,
                proteccion: tiempoProteccionTexto,
                misionCompleta: misionesCompletadasTotal,
                pareja: nombrePareja
            });
            return await sock.sendMessage(chatId, { image: { url: ruta }, caption }, { quoted: msg });
        } catch (e) {
            console.error("❌ Error generando la tarjeta de balance:", e.message);
            return sock.sendMessage(chatId, { text: txtBal }, { quoted: msg });
        } finally {
            if (ruta) { try { fs.unlinkSync(ruta); } catch {} }
        }
    }
};
