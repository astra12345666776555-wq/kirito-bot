import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import https from 'https';

const HF_TOKEN = "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";

export default {
    name: "transcribir",
    run: async (comando, sock, chatId, msg, args, senderJid, prefijoUsado) => {
        if (comando === "to-text" || comando === "transcribir") {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const quotedMessage = contextInfo?.quotedMessage;

            if (!quotedMessage || !quotedMessage.audioMessage) {
                await sock.sendMessage(chatId, { text: "⚠️ Por favor, responde a una nota de voz con el comando .to-text" }, { quoted: msg });
                return;
            }

            await sock.sendMessage(chatId, { text: "⏳ Transcribiendo audio, un momento..." }, { quoted: msg });

            try {
                const quotedMsg = {
                    key: {
                        remoteJid: chatId,
                        id: contextInfo.stanzaId,
                        participant: contextInfo.participant
                    },
                    message: quotedMessage
                };

                const buffer = await downloadMediaMessage(
                    quotedMsg,
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );

                const tempFilePath = path.join(process.cwd(), `tmp_${Date.now()}.ogg`);
                fs.writeFileSync(tempFilePath, buffer);
                const audioBuffer = fs.readFileSync(tempFilePath);

                // Hacemos la petición usando https con el hostname explícito en los headers (evita el bloqueo DNS)
                const options = {
                    hostname: 'api-inference.huggingface.co',
                    port: 443,
                    path: '/models/openai/whisper-large-v3-turbo',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${HF_TOKEN}`,
                        'Content-Type': 'audio/ogg',
                        'Content-Length': audioBuffer.length
                    }
                };

                const apiResponseText = await new Promise((resolve, reject) => {
                    const req = https.request(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => resolve(data));
                    });
                    req.on('error', (e) => reject(e));
                    req.write(audioBuffer);
                    req.end();
                });

                const result = JSON.parse(apiResponseText);

                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

                if (result && result.text) {
                    await sock.sendMessage(chatId, { text: `🎙️ **Transcripción:**\n\n${result.text.trim()}` }, { quoted: msg });
                } else {
                    let errDetail = result.error || JSON.stringify(result);
                    await sock.sendMessage(chatId, { text: `❌ Error al transcribir: ${errDetail}` }, { quoted: msg });
                }

            } catch (error) {
                console.error("Error al transcribir audio:", error);
                await sock.sendMessage(chatId, { text: `❌ Error técnico: ${error.message}` }, { quoted: msg });
            }
        }
    }
};
