import { google } from "googleapis";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const { uid, type, other } = req.query;

    const sheetId = "1asctglNYLWEEWaFcGPoWFFs--wOz21f7LXLwLrLQa-0";

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:S"
    });

    const rows = sheetData.data.values;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No data found" });
    }

    let rowIndex = -1;
    let person = null;

    /* BUSCAR PERSONA PRINCIPAL (UID) */
    for (let i = 1; i < rows.length; i++) {

      const orderId = (rows[i][0] || "").toString().trim();

      if (orderId === uid?.toString().trim()) {

        rowIndex = i + 1;

        // Blindaje para evitar errores si la fila es corta
        const safeRow = rows[i].concat(Array(20).fill(""));

        person = {
          name: safeRow[4] || "",
          birth_date: safeRow[5] || "",
          birth_hour: safeRow[6] || "",
          birth_place: safeRow[7] || "",
          sun: safeRow[8] || "",
          moon: safeRow[9] || "",
          rising: safeRow[10] || "",
          message_daily: safeRow[12] || "",
          message_date: safeRow[13] || "",
          affinity_daily: safeRow[14] || "",
          affinity_date: safeRow[15] || "",
          pair_message: safeRow[17] || "",
          pair_date: safeRow[18] || ""
        };

        break;
      }
    }

    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    if (type === "profile") {
      return res.status(200).json(person);
    }

    const today = new Date().toISOString().split("T")[0];

    const todayFormatted = new Date().toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    /* 🔮 READPAIR — SOLO LECTURA (MODIFICADO PARA CADUCAR AL DÍA SIGUIENTE) */

    if (type === "readpair") {

      let finalMessage = "No hay conexión guardada.";

      // 1. Miramos si la persona principal tiene una conexión DE HOY
      if (person.pair_date === today && person.pair_message) {
        finalMessage = person.pair_message;
      } 
      // 2. Si no, miramos si hay un "other" y si su mensaje es DE HOY
      else if (other) {
        for (let i = 1; i < rows.length; i++) {
          const orderIdB = (rows[i][0] || "").toString().trim();
          if (orderIdB === other.toString().trim()) {
            const dateB = rows[i][18] || "";
            const msgB = rows[i][17] || "";
            if (dateB === today) {
              finalMessage = msgB;
            }
            break;
          }
        }
      }

      return res.status(200).json({
        choices: [{
          message: {
            content: finalMessage
          }
        }]
      });

    }

    /* 🔗 PAIR — GENERAR Y GUARDAR (MODIFICADO PARA MULTI-PERSONA) */

    if (type === "pair") {

      if (!other) {
        return res.status(400).json({ error: "Missing second UID" });
      }

      let personB = null;
      let rowIndexB = -1;

      for (let i = 1; i < rows.length; i++) {

        const orderIdB = (rows[i][0] || "").toString().trim();

        if (orderIdB === other.toString().trim()) {

          rowIndexB = i + 1;
          const safeRowB = rows[i].concat(Array(20).fill(""));

          personB = {
            name: safeRowB[4] || "",
            sun: safeRowB[8] || "",
            moon: safeRowB[9] || "",
            rising: safeRowB[10] || "",
            pair_message: safeRowB[17] || "",
            pair_date: safeRowB[18] || ""
          };

          break;
        }
      }

      if (!personB) {
        return res.status(404).json({ error: "Second person not found" });
      }

      /* SI YA EXISTE CON ESTA PERSONA CONCRETA */
      const yaExisteConEste = person.pair_message && 
                             person.pair_date === today && 
                             person.pair_message.toUpperCase().includes(personB.name.toUpperCase());

      if (yaExisteConEste) {
        return res.status(200).json({
          choices: [{
            message: {
              content: person.pair_message
            }
          }]
        });
      }

      const idsOrdenados = [uid, other].sort().join("");
      const seed = idsOrdenados + today;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }
      const percentage = 30 + Math.abs(hash % 71);

      // He ajustado este bloque para que no haya saltos de línea dobles entre nombres
      const prompt = `
Genera una afinidad entre dos personas.

FORMATO EXACTO:
✨ Afinidad Detectada
${person.name.toUpperCase()} (${person.sun.toUpperCase()})
+
${personB.name.toUpperCase()} (${personB.sun.toUpperCase()})

🔗 Conexión energética hoy: ${percentage}%

✨ Frase corta positiva.

🔥 Consejo breve.

💫 Mensaje final corto.

Fecha: ${todayFormatted}
`;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            max_tokens: 140,
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }]
          })
        }
      );

      const data = await response.json();
      const message = data.choices[0].message.content;

      /* GUARDAR EN AMBOS */

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `R${rowIndex}:S${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[message, today]]
        }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `R${rowIndexB}:S${rowIndexB}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[message, today]]
        }
      });

      return res.status(200).json({
        choices: [{
          message: { content: message }
        }]
      });

    }

    /* ⚡ ENERGÍA — intacto */

    if (type !== "affinity") {

      if (person.message_date === today && person.message_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.message_daily } }]
        });
      }

      const prompt = `
Genera un mensaje diario de energía emocional.

Hola ${person.name},

Hoy, ${todayFormatted}

✨ Frase potente.

🔥 Acción concreta.

💫 Frase final.

DATOS:
Sol: ${person.sun}
Luna: ${person.moon}
Ascendente: ${person.rising}
`;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: prompt }]
          })
        }
      );

      const data = await response.json();
      const message = data.choices[0].message.content;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `M${rowIndex}:N${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[message, today]]
        }
      });

      return res.status(200).json({
        choices: [{ message: { content: message } }]
      });
    }

    /* 💫 AFINIDAD — intacto */

    if (type === "affinity") {

      if (person.affinity_date === today && person.affinity_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.affinity_daily } }]
        });
      }

      const prompt = `
Genera una afinidad diaria basada en los DATOS ASTRALES del final.

REGLA DE ORO: El mensaje DEBE empezar obligatoriamente con la frase: "Hoy, ${todayFormatted}, conectas especialmente con:" 
IMPORTANTE: No incluyas los "DATOS ASTRALES" en tu respuesta, úsalos solo como referencia.

FORMATO DE RESPUESTA:
Hoy, ${todayFormatted}, conectas especialmente con:

🔥 [SIGNO] → frase corta positiva.

💫 [SIGNO] → frase corta práctica.

⚡ [SIGNO] → frase corta creativa.

⚠️ Evita hoy:

♐ [SIGNO] → advertencia breve.

💡 Consejo:

Frase final clara y directa.

---
DATOS ASTRALES (NO ESCRIBIR ESTO EN LA RESPUESTA):
Sol: ${person.sun}
Luna: ${person.moon}
Ascendente: ${person.rising}
`;

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            max_tokens: 180,
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }]
          })
        }
      );

      const data = await response.json();
      const message = data.choices[0].message.content;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `O${rowIndex}:P${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[message, today]]
        }
      });

      return res.status(200).json({
        choices: [{ message: { content: message } }]
      });
    }

  } catch (error) {

    res.status(500).json({
      error: "server_error",
      message: error.toString()
    });

  }

}
