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
Escribe un horóscopo diario PREMIUM en español, diseñado para leerse en móvil.

FORMATO OBLIGATORIO:

Hola ${person.name},

Hoy, ${today}

✨ [Frase corta de impacto que enganche fuerte]

[Frase breve sobre su energía principal]

[Frase breve conectando Sol, Luna y Ascendente]

[Frase breve emocional o de identidad]

🔥 [Frase final potente tipo consejo o cierre memorable]

REGLAS CLAVE:
- Máximo 6 frases (sin contar saludo)
- Cada frase en una línea (IMPORTANTE)
- Nada de párrafos largos
- Lenguaje simple pero elegante
- Que se pueda escanear rápido
- Que parezca exclusivo y personal

ESTILO:
- Místico pero moderno
- Directo (sin relleno)
- Emocional pero no cursi
- Que haga sentir especial al usuario
- Evitar frases genéricas tipo "hoy será un buen día"

HOOK (MUY IMPORTANTE):
- La primera frase debe crear sensación de “hoy es importante”
- Ej: ventaja, claridad, oportunidad, cambio

CIERRE (MUY IMPORTANTE):
- Frase corta, potente y memorable
- Debe sentirse como una verdad fuerte o decisión
- Ej: "Hoy decides quién quieres ser"

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
