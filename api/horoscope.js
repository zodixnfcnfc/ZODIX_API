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

    // Leemos hasta la columna S para asegurar que incluimos Pair Message (R) y Pair Date (S)
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:S" 
    });

    const rows = sheetData.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No data found in sheet" });
    }

    let rowIndex = -1;
    let person = null;

    // Buscamos a la persona principal (UID)
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
          message_date: rows[i][13] || "",
          affinity_daily: rows[i][14] || "",
          affinity_date: rows[i][15] || "",
          pair_message: rows[i][17] || "", // Columna R
          pair_date: rows[i][18] || ""    // Columna S
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

    /* 🔮 READPAIR — LECTURA DE CONEXIÓN ACTIVA */
    if (type === "readpair") {
      if (!other) return res.status(400).json({ error: "Missing second UID" });

      let personB = null;
      for (let i = 1; i < rows.length; i++) {
        const orderId = rows[i][0] || "";
        if (orderId.includes(other)) {
          personB = {
            pair_message: rows[i][17] || "", // Columna R
            pair_date: rows[i][18] || ""    // Columna S
          };
          break;
        }
      }

      // Buscamos el mensaje en cualquiera de los dos perfiles
      const mensaje = person.pair_message || personB?.pair_message || "No hay conexión guardada.";

      return res.status(200).json({
        choices: [{ message: { content: mensaje } }]
      });
    }

    /* 🔗 PAIR — GENERAR Y GUARDAR */
    if (type === "pair") {
      if (!other) return res.status(400).json({ error: "Missing second UID" });

      let personB = null;
      let rowIndexB = -1;

      for (let i = 1; i < rows.length; i++) {
        const orderId = rows[i][0] || "";
        if (orderId.includes(other)) {
          rowIndexB = i + 1;
          personB = {
            name: rows[i][4] || "",
            sun: rows[i][8] || "",
            pair_message: rows[i][17] || "",
            pair_date: rows[i][18] || ""
          };
          break;
        }
      }

      if (!personB) return res.status(404).json({ error: "Second person not found" });

      // Si ya existe mensaje de hoy, lo devolvemos
      if ((person.pair_date === today && person.pair_message) || (personB.pair_date === today && personB.pair_message)) {
        return res.status(200).json({
          choices: [{ message: { content: person.pair_message || personB.pair_message } }]
        });
      }

      // Lógica de generación de mensaje (OpenAI)
      const idsOrdenados = [uid, other].sort().join("");
      const seed = idsOrdenados + today;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }
      const percentage = 30 + Math.abs(hash % 71);

      const prompt = `Genera una afinidad entre dos personas...\n${person.name} (${person.sun}) + ${personB.name} (${personB.sun})\nConexión: ${percentage}%\nFecha: ${todayFormatted}`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4", // Asegúrate de usar un modelo válido (gpt-4o o gpt-3.5-turbo)
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      const message = data.choices[0].message.content;

      // GUARDAR EN AMBOS (Columna R y S)
      const updateValue = [[message, today]];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `R${rowIndex}:S${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: updateValue }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `R${rowIndexB}:S${rowIndexB}`,
        valueInputOption: "RAW",
        requestBody: { values: updateValue }
      });

      return res.status(200).json({
        choices: [{ message: { content: message } }]
      });
    }

    // ... Resto de lógica (Energy/Affinity) se mantiene igual ...
    // Asegúrate de que los bloques Energy y Affinity usen los rowIndex correctos.
    
    return res.status(400).json({ error: "Invalid type" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "server_error", message: error.toString() });
  }
}
