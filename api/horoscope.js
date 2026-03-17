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

ESTRUCTURA OBLIGATORIA:

1. Primera línea:
Hola ${person.name},

2. Segunda línea (HOOK potente, 1 frase corta que enganche):
Ejemplo: "Hoy no es un día cualquiera: algo se está moviendo dentro de ti."

3. Tercera línea (fecha, muy breve):
Hoy, ${today}

4. Después escribe el horóscopo en formato corto, visual y fácil de leer.

REGLAS MUY IMPORTANTES:
- Máximo 5 frases en total (sin contar el saludo)
- Frases cortas (máx 12 palabras)
- Usa saltos de línea frecuentes (cada 1-2 frases)
- Nada de párrafos largos
- Tono místico pero moderno
- Que suene personal, no genérico
- Nada de texto denso

5. Termina SIEMPRE con una acción o consejo claro:
Ejemplo:
"Consejo: enfócate en una sola cosa y termina lo que empiezas."

DATOS DE LA PERSONA:
Sol: ${person.sun}
Luna: ${person.moon}
Ascendente: ${person.rising}

IMPORTANTE:
- No escribas párrafos largos
- No expliques astrología
- No uses lenguaje complicado
- Debe leerse rápido en móvil
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`
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
      range: \`M\${rowIndex}:N\${rowIndex}\`,
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
