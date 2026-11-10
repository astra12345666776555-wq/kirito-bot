import fs from "fs";

export default {
    name: "trabajar",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db, obtenerTagUsuario, senderJid) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();

        if (["work", "trabajar", "chamba", "empleo", "trabajos"].includes(cmdLimpio)) {
            // 🛡️ REGLA DE GRUPO: Validar que sea en un grupo
            if (!chatId.endsWith('@g.us')) {
                return sock.sendMessage(chatId, { text: '⚠️ El sistema de trabajo y empleo solo está disponible dentro de los grupos.' }, { quoted: msg });
            }

            // 🛡️ Inicialización segura y blindada de la base de datos
            db.global = db.global || {};
            db.grupos = db.grupos || {};
            db.grupos[chatId] = db.grupos[chatId] || {};
            db.grupos[chatId].usuarios = db.grupos[chatId].usuarios || {};
            
            if (!db.grupos[chatId].usuarios[senderJid]) {
                db.grupos[chatId].usuarios[senderJid] = { cartera: 0, banco: 0, nivel: 1, xp: 0 };
            }

            let uGrupo = db.grupos[chatId].usuarios[senderJid];
            const ahora = Date.now();

            if (uGrupo.trabajoActivoHasta && uGrupo.trabajoActivoHasta > ahora) {
                let jefe = uGrupo.jefeTrabajo || "tu jefe";
                let minutosRestantes = Math.ceil((uGrupo.trabajoActivoHasta - ahora) / 60000);
                return sock.sendMessage(chatId, { text: "❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *" + jefe + "* te vigila. Te quedan *" + minutosRestantes + " minutos* de turno en este grupo." }, { quoted: msg });
            }

            let listaTrabajos = [];
            try {
                if (fs.existsSync("trabajos.json")) {
                    let contenido = JSON.parse(fs.readFileSync("trabajos.json", "utf8"));
                    if (Array.isArray(contenido)) {
                        listaTrabajos = contenido.filter(t => typeof t === "object" && t !== null && t.minGain);
                    }
                }
            } catch (e) {}

            let userNivel = uGrupo.nivel || 1;
            let seleccion = parseInt(args[0]);
            let catalogoTxt = "🏢 *CATÁLOGO DE EMPLEOS OFICIALES (LOCAL)* 🏢\n";
            catalogoTxt += "📈 *Tu Nivel en este Grupo:* " + userNivel + "\n\n";
            catalogoTxt += "Selecciona un trabajo usando: \x60" + (prefijoUsado || ".") + "trabajar [ID]\x60\n\n";

            listaTrabajos.forEach((tr) => {
                let id = tr.id;
                let nombre = tr.nombre;
                let min = tr.minGain.toLocaleString();
                let max = tr.maxGain.toLocaleString();
                let nivelReq = tr.nivelReq || 1;
                let tiempo = tr.tiempoMin || 5;

                let tieneNivel = userNivel >= nivelReq;
                let estado = tieneNivel ? "🟢 *Disponible*" : "🔒 *Nivel Insuficiente* (Req: Nivel " + nivelReq + ")";

                catalogoTxt += "🔹 *[" + id + "]* " + nombre + "\n";
                catalogoTxt += "   💰 Paga: " + min + " - " + max + " Cols | ⏱️ " + tiempo + " min\n";
                catalogoTxt += "   " + estado + "\n\n";
            });

            if (!seleccion || isNaN(seleccion)) {
                return sock.sendMessage(chatId, { text: catalogoTxt }, { quoted: msg });
            }

            let trabajoElegido = listaTrabajos.find(t => t.id === seleccion);
            if (!trabajoElegido) {
                return sock.sendMessage(chatId, { text: "❌ ID de trabajo no válido. Revisa el catálogo con `.trabajar`" }, { quoted: msg });
            }

            let nivelReq = trabajoElegido.nivelReq || 1;
            if (userNivel < nivelReq) {
                return sock.sendMessage(chatId, { text: "❌ *¡Candado de seguridad!* No puedes postularte a *" + trabajoElegido.nombre + "* porque eres Nivel *" + userNivel + "* en este grupo y se requiere Nivel *" + nivelReq + "*" }, { quoted: msg });
            }

            let minG = trabajoElegido.minGain;
            let maxG = trabajoElegido.maxGain;
            let pagaGanada = Math.floor(Math.random() * (maxG - minG + 1)) + minG;
            let duracionMins = trabajoElegido.tiempoMin || 5;
            let xpGanada = trabajoElegido.xp || 20;

            let jefesDisponibles = ["Gerente Victor", "Supervisor Carlos", "Director General", "Jefe Rodolfo", "Encargado Mario"];
            let jefeAsignado = jefesDisponibles[Math.floor(Math.random() * jefesDisponibles.length)];

            // Guardar estrictamente en el perfil local del grupo
            uGrupo.trabajoActivoHasta = ahora + (duracionMins * 60 * 1000);
            uGrupo.jefeTrabajo = jefeAsignado;
            uGrupo.pagaTrabajo = pagaGanada;
            uGrupo.xpTrabajo = xpGanada;
            uGrupo.trabajoNombre = trabajoElegido.nombre;

            if (typeof guardarDB === "function") guardarDB();

            let respuestaTurno = "👔 *¡HAS COMENZADO A TRABAJAR COMO " + trabajoElegido.nombre.toUpperCase() + "!* 🏢\n\n";
            respuestaTurno += "👤 Tu jefe asignado es: *" + jefeAsignado + "*\n";
            respuestaTurno += "⏱️ Tu turno dura *" + duracionMins + " minutos* en este grupo. Al terminar recibirás tu paga local.\n⚠️ Tu progreso aquí es totalmente independiente de otros chats.";

            return sock.sendMessage(chatId, { text: respuestaTurno }, { quoted: msg });
        }
    }
};
