import { google } from "googleapis";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const { uid, type, other } = req.query;

    const sheetId =
      "1asctglNYLWEEWaFcGPoWFFs--wOz21f7LXLwLrLQa-0";

    const credentials =
      JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets =
      google.sheets({ version: "v4", auth });

    const sheetData =
      await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "A:S"
      });

    const rows = sheetData.data.values;

    let rowIndex = -1;
    let person = null;

    /* BUSCAR UID */

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

      return res.status(404).json({
        error: "Person not found"
      });

    }

    if (type === "profile") {

      return res.status(200).json(person);

    }

    const today =
      new Date().toISOString().split("T")[0];

    const todayFormatted =
      new Date().toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });

    /* 🔗 PAIR */

    if (type === "pair") {

      /* 🧠 SOLO LECTURA */

      if (!other) {

        if (
          person.pair_message &&
          person.pair_date === today
        ) {

          return res.status(200).json({
            choices: [{
              message: {
                content:
                  person.pair_message
              }
            }]
          });

        }

        return res.status(200).json({
          choices: [{
            message: {
              content:
                "No hay conexión activa aún."
            }
          }]
        });

      }

      /* 🔎 BUSCAR SEGUNDA */

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
            rising: rows[i][10] || ""

          };

          break;

        }

      }

      if (!personB) {

        return res.status(404).json({
          error: "Second person not found"
        });

      }

      /* 🎲 GENERAR */

      const idsOrdenados =
        [uid, other].sort().join("");

      const seed =
        idsOrdenados + today;

      let hash = 0;

      for (let i = 0; i < seed.length; i++) {

        hash =
          seed.charCodeAt(i) +
          ((hash << 5) - hash);

      }

      const percentage =
        30 + Math.abs(hash % 71);

      const prompt = `
Genera un mensaje corto y claro entre dos personas.

${person.name} (${person.sun})

+

${personB.name} (${personB.sun})

🔗 Conexión energética hoy: ${percentage}%

✨ Una frase clara.

🔥 Una recomendación.

💫 Frase positiva.

Fecha: ${todayFormatted}
`;

      const response =
        await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "Authorization":
                `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "user",
                  content: prompt
                }
              ]
            })
          }
        );

      const data =
        await response.json();

      const message =
        data.choices[0].message.content;

      /* 💾 GUARDAR */

      await sheets.spreadsheets.values.update({

        spreadsheetId: sheetId,

        range:
          `R${rowIndexB}:S${rowIndexB}`,

        valueInputOption: "RAW",

        requestBody: {
          values: [[message, today]]
        }

      });

      return res.status(200).json({

        choices: [{
          message: {
            content: message
          }
        }]

      });

    }

  } catch (error) {

    res.status(500).json({

      error: "server_error",
      message: error.toString()

    });

  }

}
