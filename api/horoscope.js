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

Empieza siempre con: "Hola ${person.name},"

Ten en cuenta la carta astral de esta persona:

Sun sign: ${person.sun}
Moon sign: ${person.moon}
Rising sign: ${person.rising}

Debe sonar como una interpretación astrológica real basada en su carta astral.

Reglas:
- máximo 4 frases
- tono místico pero moderno
- positivo e inspirador
- fácil de leer
- separa el mensaje en 2 o 3 párrafos
- deja una línea en blanco entre párrafos

Hoy es ${today}.
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
