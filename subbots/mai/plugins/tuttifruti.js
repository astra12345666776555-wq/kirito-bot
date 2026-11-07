import fs from "fs";

export default {
    name: "tuttifruti",
    run: async (comando, sock, chatId, msg, args, usuarioActual, prefijoUsado, formatoMoneda, CONFIG, guardarDB, db) => {
        let cmdLimpio = (comando || "").toLowerCase().trim();
        
        if (["tuttifruti", "basta", "ttfruti", "tuttifrutti"].includes(cmdLimpio)) {
            const ahora = Date.now();
            
            if (usuarioActual && usuarioActual.trabajoActivoHasta && usuarioActual.trabajoActivoHasta > ahora) {
                let jefe = usuarioActual.jefeTrabajo || "tu jefe";
                return sock.sendMessage(chatId, { text: "❌ *¡ESTÁS EN HORARIO DE TRABAJO!* 👔\nTu jefe *" + jefe + "* te descubrió intentando jugar Basta." }, { quoted: msg });
            }

            if (global.partidasBasta && global.partidasBasta[chatId] && global.partidasBasta[chatId].activo) {
                return sock.sendMessage(chatId, { text: "⚠️ ¡Ya hay una partida de Tutti Frutti en curso en este grupo!" }, { quoted: msg });
            }

            const categorias = [
                { nombre: "Frutas o Verduras 🍎", archivo: "frutas.json" },
                { nombre: "Animales 🦁", archivo: "animales.json" },
                { nombre: "Colores 🎨", archivo: "colores.json" },
                { nombre: "Nombres 👤", archivo: "nombres.json" },
                { nombre: "País o Ciudad 🌍", archivo: "pais.json" },
                { nombre: "Plantas 🌿", archivo: "plantas.json" },
                { nombre: "Apellidos 🏷️", archivo: "apellidos.json" },
                { nombre: "Trabajos 💼", archivo: "trabajos.json" }
            ];

            const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            let letraElegida = letras[Math.floor(Math.random() * letras.length)];

            if (!global.partidasBasta) global.partidasBasta = {};
            global.partidasBasta[chatId] = {
                activo: true,
                categoriaIndex: 0,
                categorias: categorias,
                letra: letraElegida,
                respuestasActuales: {},
                puntuaciones: {}
            };

            iniciarRonda(sock, chatId, guardarDB, db);
        }

        if (cmdLimpio === "t") {
            let partida = global.partidasBasta && global.partidasBasta[chatId];
            if (!partida || !partida.activo) {
                return sock.sendMessage(chatId, { text: "❌ No hay ninguna partida de Tutti Frutti activa en este chat." }, { quoted: msg });
            }

            let palabraDicha = args.join(" ").trim();
            if (!palabraDicha) {
                return sock.sendMessage(chatId, { text: "⚠️ Debes escribir tu palabra después del comando.\nEjemplo: `.t manzana`" }, { quoted: msg });
            }

            let senderId = msg.key.participant || msg.key.remoteJid;
            partida.respuestasActuales[senderId] = palabraDicha;

            try {
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (e) {}
        }

        if (cmdLimpio === "addbasta") {
            let catArg = (args[0] || "").toLowerCase();
            let palabraArg = args.slice(1).join(" ").trim();

            let mapaArchivos = {
                "frutas": "frutas.json", "fruta": "frutas.json", "verdura": "frutas.json",
                "animales": "animales.json", "animal": "animales.json",
                "colores": "colores.json", "color": "colores.json",
                "nombres": "nombres.json", "nombre": "nombres.json",
                "pais": "pais.json", "ciudades": "pais.json", "ciudad": "pais.json",
                "plantas": "plantas.json", "planta": "plantas.json",
                "apellidos": "apellidos.json", "apellido": "apellidos.json",
                "trabajos": "trabajos.json", "trabajo": "trabajos.json"
            };

            let archivoDestino = mapaArchivos[catArg];
            if (!archivoDestino || !palabraArg) {
                return sock.sendMessage(chatId, { text: "⚠️ Uso correcto: *!addbasta [categoria] [palabra]*" }, { quoted: msg });
            }

            try {
                let lista = [];
                if (fs.existsSync(archivoDestino)) {
                    let contenido = JSON.parse(fs.readFileSync(archivoDestino, "utf8"));
                    if (Array.isArray(contenido)) lista = contenido;
                }
                lista.push(palabraArg);
                fs.writeFileSync(archivoDestino, JSON.stringify(lista, null, 2), "utf8");
                return sock.sendMessage(chatId, { text: "✅ Palabra \"" + palabraArg + "\" agregada a *" + archivoDestino + "*" }, { quoted: msg });
            } catch (e) {
                return sock.sendMessage(chatId, { text: "❌ Error al guardar en el archivo JSON." }, { quoted: msg });
            }
        }
    }
};

function formatearMencion(jid) {
    if (!jid) return "Usuario";
    return String(jid).split("@")[0].replace(/[^0-9]/g, "") || "Usuario";
}

function iniciarRonda(sock, chatId, guardarDB, db) {
    let juego = global.partidasBasta && global.partidasBasta[chatId];
    if (!juego || !juego.activo) return;

    let catActual = juego.categorias[juego.categoriaIndex];
    juego.respuestasActuales = {};

    let txt = "🍉 *TUTTI FRUTTI / BASTA* 🍎\n\n";
    txt += "📌 Ronda " + (juego.categoriaIndex + 1) + " / " + juego.categorias.length + "\n";
    txt += "📂 Categoría: *" + catActual.nombre + "*\n";
    txt += "🔤 Letra obligatoria: *[" + juego.letra + "]*\n\n";
    txt += "⏱️ ¡Envía tu palabra con `.t <palabra>`! Tienes *10 segundos*.";

    sock.sendMessage(chatId, { text: txt });

    setTimeout(() => {
        procesarRonda(sock, chatId, guardarDB, db);
    }, 10000);
}

function procesarRonda(sock, chatId, guardarDB, db) {
    let juego = global.partidasBasta && global.partidasBasta[chatId];
    if (!juego || !juego.activo) return;

    let catActual = juego.categorias[juego.categoriaIndex];
    let respuestas = juego.respuestasActuales || {};
    let listaValidas = [];

    // Carga obligatoria del JSON
    try {
        if (fs.existsSync(catActual.archivo)) {
            let rawData = JSON.parse(fs.readFileSync(catActual.archivo, "utf8"));
            if (Array.isArray(rawData)) {
                listaValidas = rawData.map(p => (typeof p === "string" ? p.toLowerCase().trim() : "")).filter(p => p.length > 0);
            }
        }
    } catch (e) {
        console.log("[VERIFICADOR BASTA] ❌ Error leyendo " + catActual.archivo, e);
    }

    let resultadosTxt = "📊 *RESULTADOS DE LA RONDA* 📊\n";
    resultadosTxt += "📂 Categoría: " + catActual.nombre + " (Letra: " + juego.letra + ")\n\n";

    let conteoPalabras = {};
    for (let [userId, palabra] of Object.entries(respuestas)) {
        let pLimpia = (palabra || "").toLowerCase().trim();
        let esCorrectaLetra = pLimpia.startsWith(juego.letra.toLowerCase());
        let existeEnJson = listaValidas.includes(pLimpia);

        // VALIDACIÓN ESTRICTA: Debe empezar con la letra Y estar registrado en el JSON obligatoriamente
        if (esCorrectaLetra && existeEnJson) {
            conteoPalabras[pLimpia] = (conteoPalabras[pLimpia] || 0) + 1;
        }
    }

    let raciones = Object.entries(respuestas);
    if (raciones.length === 0) {
        resultadosTxt += "❌ Nadie respondió a tiempo o con una palabra válida.";
    } else {
        for (let [userId, palabra] of raciones) {
            let pLimpia = (palabra || "").toLowerCase().trim();
            let nombreUser = formatearMencion(userId);
            let esCorrectaLetra = pLimpia.startsWith(juego.letra.toLowerCase());
            let existeEnJson = listaValidas.includes(pLimpia);

            if (esCorrectaLetra && existeEnJson) {
                let repetida = conteoPalabras[pLimpia] > 1;
                let puntosGanados = repetida ? 0.5 : 1.0;
                juego.puntuaciones[userId] = (juego.puntuaciones[userId] || 0) + puntosGanados;

                resultadosTxt += "👤 @" + nombreUser + ": *" + palabra + "* ➔ +" + puntosGanados + " pts" + (repetida ? " (Repetida)" : "") + "\n";
            } else {
                let motivo = !esCorrectaLetra ? "No empieza con " + juego.letra : "No existe en la base de datos (JSON)";
                resultadosTxt += "👤 @" + nombreUser + ": *" + palabra + "* ❌ (" + motivo + ")\n";
            }
        }
    }

    sock.sendMessage(chatId, { text: resultadosTxt, mentions: Object.keys(respuestas) });

    juego.categoriaIndex++;
    if (juego.categoriaIndex < juego.categorias.length) {
        setTimeout(() => {
            iniciarRonda(sock, chatId, guardarDB, db);
        }, 4000);
    } else {
        let finalTxt = "🏆 *¡FIN DEL TUTTI FRUTTI!* 🏆\n\n";
        let coleccionUsuarios = db && (db.usuarios || db.users) ? (db.usuarios || db.users) : {};

        let ranking = Object.entries(juego.puntuaciones).sort((a, b) => b[1] - a[1]);
        if (ranking.length === 0) {
            finalTxt += "Nadie acumuló puntos.";
        } else {
            ranking.forEach(([userId, pts], index) => {
                let colsGanados = Math.floor(pts * 200);
                let nombreUser = formatearMencion(userId);
                
                if (coleccionUsuarios[userId]) {
                    coleccionUsuarios[userId].cartera = (coleccionUsuarios[userId].cartera || 0) + colsGanados;
                }
                finalTxt += (index + 1) + ". @" + nombreUser + " ➔ *" + pts + " pts* (🪙 +" + colsGanados.toLocaleString() + " Cols)\n";
            });
            if (typeof guardarDB === "function") guardarDB();
        }

        delete global.partidasBasta[chatId];
        sock.sendMessage(chatId, { text: finalTxt, mentions: ranking.map(r => r[0]) });
    }
}
