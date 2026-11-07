import fs from 'fs';

export function normalizarJid(jid) {
    if (!jid || typeof jid !== 'string') return "desconocido@s.whatsapp.net";
    let limpio = jid.split('@')[0].replace(/[^0-9]/g, '');
    return limpio ? limpio + '@s.whatsapp.net' : "desconocido@s.whatsapp.net";
}

export function limpiarDinero(val) {
    return Math.max(0, Math.floor(Number(val) || 0));
}

export function guardarDB Segura(db, dbFile) {
    try {
        const tempFile = dbFile + ".tmp";
        fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), "utf8");
        fs.renameSync(tempFile, dbFile);
    } catch (e) {
        console.error("❌ Error al guardar base de datos de forma segura:", e);
    }
}
