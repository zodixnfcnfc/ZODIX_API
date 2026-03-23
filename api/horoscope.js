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
          affinity_date: rows[i][15] || "",
          pair_message: rows[i][17] || "",
          pair_date: rows[i][18] || ""
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

      if (!other) {
        return res.status(400).json({ error: "Missing second UID" });
      }

      let personB = null;

      for (let i = 1; i < rows.length; i++) {

        const orderId = rows[i][0] || "";

        if (orderId.includes(other)) {

          personB = {
            pair_message: rows[i][17] || ""
          };

          break;
        }
      }

      const mensaje =
        person.pair_message ||
        personB?.pair_message ||
        "No hay conexión guardada.";

      return res.status(200).json({
        choices: [{
          message: {
            content: mensaje
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

        const orderId = rows[i][0] || "";

        if (orderId.includes(other)) {

          rowIndexB = i + 1;

          personB = {
            name: rows[i][4] || "",
            sun: rows[i][8] || "",
            moon: rows[i][9] || "",
            rising: rows[i][10] || "",
            pair_message: rows[i][17] || "",
            pair_date: rows[i][18] || ""
          };

          break;
        }
      }

      if (!personB) {
        return res.status(404).json({ error: "Second person not found" });
      }

      /* SI YA EXISTE */

      if (
        (person.pair_date === today && person.pair_message) ||
        (personB.pair_date === today && personB.pair_message)
      ) {

        const mensaje =
          person.pair_message ||
          personB.pair_message;

        return res.status(200).json({
          choices: [{
            message: {
              content: mensaje
            }
          }]
        });

      }

      const idsOrdenados =
        [uid, other].sort().join("");

      const seed =
        idsOrdenados +
        today;

      let hash = 0;

      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }

      const percentage =
        30 + Math.abs(hash % 71);

      const prompt = `
Genera una afinidad entre dos personas.

FORMATO EXACTO:

✨ Afinidad Detectada

${person.name.toUpperCase()} (${person.sun.toUpperCase()})

+

${personB.name.toUpperCase()} (${personB.sun.toUpperCase()})

🔗 Conexión energética hoy:
${percentage}%

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
Genera una afinidad diaria EXACTAMENTE con este formato.

Hoy conectas especialmente con:

🔥 [SIGNO] → frase corta positiva.

💫 [SIGNO] → frase corta práctica.

⚡ [SIGNO] → frase corta creativa.

⚠️ Evita hoy:

♐ [SIGNO] → advertencia breve.

💡 Consejo:

Frase final clara y directa.

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

  } catch (error) {

    res.status(500).json({
      error: "server_error",
      message: error.toString()
    });

  }

}
