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

    // Ampliado a U para leer las nuevas columnas
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:U"
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

        // Blindaje para evitar errores si la fila es corta (ajustado a 21 columnas)
        const safeRow = rows[i].concat(Array(21).fill(""));

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
          pair_date: safeRow[18] || "",
          code_message: safeRow[19] || "", // Columna T
          code_day: safeRow[20] || ""      // Columna U
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

    /* 🔮 READPAIR — SOLO LECTURA */

    if (type === "readpair") {

      let finalMessage = "No hay conexión guardada.";

      if (person.pair_date === today && person.pair_message) {
        finalMessage = person.pair_message;
      } 
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

    /* 🔗 PAIR — GENERAR Y GUARDAR */

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
      const seedString = idsOrdenados + today;
      
      let h = 0;
      for (let i = 0; i < seedString.length; i++) {
          h = Math.imul(31, h) + seedString.charCodeAt(i) | 0;
      }

      const t = h + 0x6D2B79F5;
      const a = Math.imul(t ^ (t >>> 15), t | 1);
      const b = a ^ (a + Math.imul(a ^ (a >>> 7), a | 61));
      const finalRandom = ((b ^ (b >>> 14)) >>> 0) / 4294967296;

      const percentage = Math.floor(30 + (finalRandom * 71));

      const prompt = `
Genera una afinidad entre dos personas.

FORMATO EXACTO:
✨ Afinidad Detectada
${person.name.toUpperCase()} (${person.sun.toUpperCase()})
+
${personB.name.toUpperCase()} (${personB.sun.toUpperCase()})

🔗 Conexión energética hoy: ${percentage}%

✨ Frase corta coherente con el porcentaje.
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

    /* 🔢 CÓDIGO DEL DÍA — NUEVA FUNCIÓN */

    if (type === "daily_code") {
      
      if (person.code_day === today && person.code_message) {
        return res.status(200).json(JSON.parse(person.code_message));
      }

      const prompt = `
Genera el "Código del Día" místico para ${person.name} basado en su Sol: ${person.sun} y Ascendente: ${person.rising}.
FECHA: ${todayFormatted}

RESPONDE ÚNICAMENTE EN FORMATO JSON PURO, sin textos extra, siguiendo esta estructura:
{
  "numero": "Un número del 1 al 22",
  "numero_desc": "Breve frase mística sobre este número",
  "color": "Un color evocador",
  "color_desc": "Qué energía aporta este color hoy",
  "momento": "Un rango de 2 horas (ej: 14:00 - 16:00)",
  "momento_desc": "Por qué es tu momento ideal hoy",
  "elemento": "Agua, Fuego, Tierra o Aire",
  "elemento_desc": "Cómo fluir con este elemento"
}
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
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }]
          })
        }
      );

      const data = await response.json();
      const codeDataText = data.choices[0].message.content;
      
      // Guardar el JSON como string en Columna T y la fecha en U
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `T${rowIndex}:U${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[codeDataText, today]]
        }
      });

      return res.status(200).json(JSON.parse(codeDataText));
    }

    /* 💫 AFINIDAD */

    if (type === "affinity") {

      if (person.affinity_date === today && person.affinity_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.affinity_daily } }]
        });
      }

      const prompt = `
Genera una afinidad diaria basada en los DATOS ASTRALES.
REGLA DE ORO: El mensaje DEBE empezar con: "Hoy, ${todayFormatted}, conectas especialmente con:" 

DATOS ASTRALES:
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

    /* ⚡ ENERGÍA (Default) */

    if (person.message_date === today && person.message_daily) {
      return res.status(200).json({
        choices: [{ message: { content: person.message_daily } }]
      });
    }

    const promptEnergia = `
Genera un mensaje diario de energía para ${person.name}.
Hoy, ${todayFormatted}
Sol: ${person.sun} | Luna: ${person.moon}
`;

    const responseEnergia = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: promptEnergia }]
        })
      }
    );

    const dataEnergia = await responseEnergia.json();
    const messageEnergia = dataEnergia.choices[0].message.content;

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `M${rowIndex}:N${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[messageEnergia, today]]
      }
    });

    return res.status(200).json({
      choices: [{ message: { content: messageEnergia } }]
    });

  } catch (error) {
    res.status(500).json({
      error: "server_error",
      message: error.toString()
    });
  }
}
