export default {
    name: "inv",
    description: "Muestra el inventario con diseño limpio",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        if (!["inv", "inventario"].includes(cmdLimpio)) return;

        let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (!targetJid && quotedJid) targetJid = quotedJid;
        if (!targetJid) targetJid = senderJid;

        if (typeof targetJid === 'string' && targetJid.includes('@lid')) {
            targetJid = targetJid.split('@')[0] + '@s.whatsapp.net';
        }

        let uGlobal = db.usuarios?.[targetJid] || {};
        let nombreUsuario = uGlobal.alias ? uGlobal.alias : `~${targetJid.split('@')[0]}`;

        let uGrupo = { cartera: 1000, banco: 0, nivel: 1, xp: 0, inventario: [], negocios: [], guardia: "Inactivo" };
        if (chatId.endsWith('@g.us') && db.grupos && db.grupos[chatId] && db.grupos[chatId].usuarios && db.grupos[chatId].usuarios[targetJid]) {
            uGrupo = db.grupos[chatId].usuarios[targetJid];
        } else if (db.usuarios && db.usuarios[targetJid]) {
            uGrupo = db.usuarios[targetJid];
        }

        let cartera = uGrupo.cartera || 0;
        let banco = uGrupo.banco || 0;
        let nivel = uGrupo.nivel || 1;
        let xp = uGrupo.xp || 0;
        let guardia = uGrupo.guardia || "Inactivo";
        let inventario = uGrupo.inventario || [];
        let negocios = uGrupo.negocios || [];

        let parejaStr = 'Soltero/a';
        if (db.matrimonios) {
            for (const key in db.matrimonios) {
                const mat = db.matrimonios[key];
                if (mat.pareja1 === targetJid || mat.pareja2 === targetJid) {
                    let parejaJidReal = mat.pareja1 === targetJid ? mat.pareja2 : mat.pareja1;
                    let aliasPareja = db.usuarios?.[parejaJidReal]?.alias || `~${parejaJidReal.split('@')[0]}`;
                    parejaStr = `Casado/a con ${aliasPareja}`;
                }
            }
        }

        let porPagina = 20;
        let pagina = parseInt(args[0]) || 1;
        let totalPaginas = Math.ceil(inventario.length / porPagina) || 1;
        if (pagina < 1) pagina = 1;
        if (pagina > totalPaginas) pagina = totalPaginas;

        let txtInv = `✦ ─── ɪɴᴠᴇɴᴛᴀʀɪᴏ ─── ✦\n`;
        txtInv += `➪ Usuario: *${nombreUsuario}*\n`;
        txtInv += `──────────────────\n`;
        txtInv += `✰ Nivel Local: *${nivel}* | XP: *${xp.toLocaleString()}*\n`;
        txtInv += `⛀ Cartera: *${formatoMoneda(cartera)}*\n`;
        txtInv += `⚿ Banco: *${formatoMoneda(banco)}*\n`;
        txtInv += `☯︎ Estado Civil: *${parejaStr}*\n`;
        txtInv += `⛊ Guardia Local: *${guardia}*\n`;
        txtInv += `──────────────────\n\n`;

        txtInv += `🃜 Equipo Táctico : *(${inventario.length})* 🃚\n`;
        if (inventario.length === 0) {
            txtInv += `» *(Inventario vacío)*\n`;
        } else {
            let conteoItems = {};
            inventario.forEach(item => { conteoItems[item] = (conteoItems[item] || 0) + 1; });
            for (let [item, cantidad] of Object.entries(conteoItems)) {
                let cantidadStr = cantidad > 1 ? ` (x${cantidad})` : '';
                txtInv += `» *${item}*${cantidadStr}\n`;
            }
        }

        txtInv += `\n🃜 Negocios : *(${negocios.length})* 🃚\n`;
        if (negocios.length === 0) {
            txtInv += `» *(Sin negocios)*\n`;
        } else {
            negocios.forEach(neg => { txtInv += `» *${neg}*\n`; });
        }

        txtInv += `\n──────────────────\n`;
        txtInv += `> ⁺˚⋆｡°✩₊ Página *${pagina}* de *${totalPaginas}*`;

        return sock.sendMessage(chatId, { text: txtInv }, { quoted: msg });
    }
};
