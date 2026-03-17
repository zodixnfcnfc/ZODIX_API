import { google } from "googleapis";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const { uid, type } = req.query;

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
      range: "A:P"
    });

    const rows = sheetData.data.values;

    let rowIndex = -1;
    let person = null;

    for (let i = 1; i < rows.length; i++) {

      const orderId = rows[i][0] || "";

      if (orderId.includes(uid)) {

        rowIndex = i + 1;

        person = {
          name: rows[i][4] || "",
          birth_date: rows[i][5] || "",
          birth_hour: rows[i][6] || "",
          birth_place: rows[i][7] || "",
          sun: rows[i][8] || "",
          moon: rows[i][9] || "",
          rising: rows[i][10] || "",
          message_daily: rows[i][12] || "",
          message_date: rows[i][13] || "",
          affinity_daily: rows[i][14] || "",
          affinity_date: rows[i][15] || ""
        };

        break;
      }
    }

    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    /* 🔮 PERFIL */
    if (type === "profile") {
      return res.status(200).json(person);
    }

    const today = new Date().toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const todayKey = new Date().toISOString().split("T")[0];

    /* ⚡ ENERGÍA */
    if (type !== "affinity") {

      if (person.message_date === todayKey && person.message_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.message_daily } }]
        });
      }

      const prompt = `
Hola ${person.name},

Hoy, ${today}

✨ Frase potente

Frases cortas conectando energía, emoción y acción

🔥 Cierre impactante

Datos:
Sol: ${person.sun}
Luna: ${person.moon}
Ascendente: ${person.rising}
`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      const message = data.choices[0].message.content;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `M${rowIndex}:N${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[message, todayKey]]
        }
      });

      return res.status(200).json({
        choices: [{ message: { content: message } }]
      });
    }

    /* 💫 AFINIDAD PRO */

    if (type === "affinity") {

      if (person.affinity_date === todayKey && person.affinity_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.affinity_daily } }]
        });
      }

      const prompt = `
Escribe una afinidad astral diaria PREMIUM.

FORMATO:
- Frases cortas
- Máx 6 líneas
- Cada línea separada
- Fácil de leer en móvil

CONTENIDO:
- 2-3 signos con alta conexión
- 1 signo a evitar
- Explicar por qué (emocional, energía, atracción)
- Añadir un consejo final potente

ESTILO:
- Místico moderno
- Seductor
- Directo

DATOS:
Sol: ${person.sun}
Luna: ${person.moon}
Ascendente: ${person.rising}
`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      const message = data.choices[0].message.content;

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `O${rowIndex}:P${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[message, todayKey]]
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
