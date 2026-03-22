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

    const today = new Date().toISOString().split("T")[0];

    const todayFormatted = new Date().toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    /* 🔗 COMPATIBILIDAD ENTRE DOS PERSONAS */

    if (type === "pair") {

      if (!other) {
        return res.status(400).json({ error: "Missing second UID" });
      }

      let personB = null;

      for (let i = 1; i < rows.length; i++) {

        const orderId = rows[i][0] || "";

        if (orderId.includes(other)) {

          personB = {
            name: rows[i][4] || "",
            sun: rows[i][8] || "",
            moon: rows[i][9] || "",
            rising: rows[i][10] || ""
          };

          break;
        }
      }

      if (!personB) {
        return res.status(404).json({ error: "Second person not found" });
      }

      /* 🎯 PORCENTAJE VARIABLE DIARIO */

      const seed =
        uid +
        other +
        today;

      let hash = 0;

      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }

      const percentage =
        65 + Math.abs(hash % 31); // 65% a 95%

      const prompt = `
Genera una compatibilidad astral entre dos personas.

Formato obligatorio:

${person.name} (${person.sun})
+
${personB.name} (${personB.sun})

Afinidad hoy: ${percentage}%

💬 [mensaje emocional breve]

Fecha: ${todayFormatted}

DATOS PERSONA A:
Sol: ${person.sun}
Luna: ${person.moon}
Ascendente: ${person.rising}

DATOS PERSONA B:
Sol: ${personB.sun}
Luna: ${personB.moon}
Ascendente: ${personB.rising}
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

      return res.status(200).json({
        choices: [{ message: { content: message } }]
      });

    }

    /* ⚡ ENERGÍA (SIN CAMBIOS) */

    if (type !== "affinity") {

      if (person.message_date === today && person.message_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.message_daily } }]
        });
      }

      const prompt = `
Genera un mensaje diario de energía/horóscopo altamente emocional, personalizado y adictivo.

IMPORTANTE:
- El texto debe estar en español.
- Debe incluir el nombre de la persona.
- Debe incluir la fecha actual.
- Tono premium, místico, intenso y poderoso.
- NO debe sonar genérico.
- Debe enganchar desde la primera línea (HOOK FUERTE).
- Usa frases cortas.
- SIEMPRE deja una línea en blanco entre frases.

ESTRUCTURA OBLIGATORIA:

Hola ${person.name},

Hoy, ${todayFormatted}

✨ [HOOK muy potente, máximo 10 palabras]

[Frase que genere intriga o tensión]

[Frase emocional conectada con su energía]

[Frase que conecte Sol, Luna y Ascendente de forma natural]

[Frase con recomendación práctica o acción concreta para hoy]

[Otra frase opcional de acción o enfoque mental]

🔥 [Frase final contundente tipo destino/poder]

REGLAS:
- Cada frase separada por UNA línea en blanco
- Máximo 6-7 frases (sin contar saludo)
- Máximo 10-12 frases por línea
- Nada de párrafos largos
- Nada genérico

CLAVE:
- Debe hacer sentir QUÉ HACER HOY
- Mezclar emoción + acción (muy importante)

ESTILO:
- Lenguaje emocional (energía, destino, poder, intuición, fuego)
- Sensación de mensaje exclusivo
- Directo y potente

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

    /* 💫 AFINIDAD (SIN CAMBIOS) */

    if (type === "affinity") {

      if (person.affinity_date === today && person.affinity_daily) {
        return res.status(200).json({
          choices: [{ message: { content: person.affinity_daily } }]
        });
      }

      const prompt = `
Escribe una afinidad astral diaria PREMIUM.

FORMATO OBLIGATORIO:

Hoy conectas especialmente con:

🔥 [Signo] → [conexión emocional breve]

💫 [Signo] → [tipo de conexión]

⚡ [Signo] → [sensación o energía]

⚠️ Evita hoy:

[Signo] → [por qué evitarlo]

💡 Consejo:
[frase final potente]

REGLAS:
- Cada frase en una línea
- Máx 10 palabras por línea
- No párrafos

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
