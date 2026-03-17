import { google } from "googleapis";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const { uid } = req.query;

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
      range: "A:N"
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
          sun: rows[i][8] || "",
          moon: rows[i][9] || "",
          rising: rows[i][10] || "",
          message_daily: rows[i][12] || "",
          message_date: rows[i][13] || ""
        };

        break;
      }
    }

    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    const today = new Date().toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const todayKey = new Date().toISOString().split("T")[0];

    if (person.message_date === todayKey && person.message_daily) {

      return res.status(200).json({
        choices: [
          { message: { content: person.message_daily } }
        ]
      });

    }

    const prompt = `
Escribe un horóscopo diario personalizado en español.

Debe empezar EXACTAMENTE así:

Hola ${person.name},

Hoy, ${today}

Después escribe el mensaje.

IMPORTANTE:
- Máximo 5 frases en total
- Frases cortas
- Usa saltos de línea (cada 1-2 frases)
- Nada de párrafos largos
- Fácil de leer en móvil

ESTILO:
- Primera frase debe enganchar (hook)
- Tono místico pero moderno
- Que se sienta personal
- Nada genérico

FINAL:
- Termina con un consejo claro

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
      range: `M${rowIndex}:N${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[message, todayKey]]
      }
    });

    res.status(200).json({
      choices: [
        { message: { content: message } }
      ]
    });

  } catch (error) {

    res.status(500).json({
      error: "server_error",
      message: error.toString()
    });

  }

}
