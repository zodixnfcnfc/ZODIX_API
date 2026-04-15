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

    // 1. AMPLIAMOS EL RANGO A "U" para leer las nuevas columnas
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:W" 
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

        // Blindaje para 21 columnas (hasta la U)
        const safeRow = rows[i].concat(Array(23).fill(""));

person = {
          name: safeRow[4] || "",
          birth_date: safeRow[5] || "",      // ESTO FALTABA
          birth_hour: safeRow[6] || "",      // ESTO FALTABA
          birth_place: safeRow[7] || "",     // ESTO FALTABA
          sun: safeRow[8] || "",
          moon: safeRow[9] || "",
          rising: safeRow[10] || "",
          message_daily: safeRow[12] || "",
          message_date: safeRow[13] || "",
          affinity_daily: safeRow[14] || "",
          affinity_date: safeRow[15] || "",
          pair_message: safeRow[17] || "",
          pair_date: safeRow[18] || "",
          code_message: safeRow[19] || "",
          code_day: safeRow[20] || "",
          message_daily_long: safeRow[21] || "",
          message_daily_long_day: safeRow[22] || "",
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

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

    const todayFormatted = new Date().toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    /* 🔢 NUEVA FUNCIÓN: CÓDIGO DEL DÍA */
    if (type === "daily_code") {
      
      // Si ya existe el código de hoy, lo devolvemos parseado
      if (person.code_day === today && person.code_message) {
        try {
            return res.status(200).json(JSON.parse(person.code_message));
        } catch (e) {
            // Si el JSON guardado diera error, forzamos generación nueva
        }
      }

      const promptCode = `
Genera el "Código del Día" místico para ${person.name} basado en su Sol: ${person.sun} y Ascendente: ${person.rising}.
FECHA: ${todayFormatted}

INSTRUCCIÓN CRÍTICA: Elige combinaciones de números, colores y momentos COMPLETAMENTE AL AZAR. No repitas patrones comunes.

RESPONDE ÚNICAMENTE EN FORMATO JSON PURO, sin textos extra, siguiendo esta estructura exacta:
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
      model: "gpt-4o-mini", // Corregido: gpt-4o-mini
      temperature: 1.0,      // Subimos a 1.0 para que sea mucho más creativo y no repita
      messages: [{ role: "user", content: promptCode }]
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
      return res.status(200).json({ choices: [{ message: { content: finalMessage } }] });
    }

    /* 🔗 PAIR — GENERAR Y GUARDAR */
    if (type === "pair") {
      if (!other) return res.status(400).json({ error: "Missing second UID" });
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

      if (!personB) return res.status(404).json({ error: "Second person not found" });

      const yaExisteConEste = person.pair_message && 
                             person.pair_date === today && 
                             person.pair_message.toUpperCase().includes(personB.name.toUpperCase());

      if (yaExisteConEste) {
        return res.status(200).json({ choices: [{ message: { content: person.pair_message } }] });
      }

      const idsOrdenados = [uid, other].sort().join("");
      const seed = idsOrdenados + today;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }
      const percentage = 30 + Math.abs(hash % 71);

      const prompt = `
Genera una afinidad entre dos personas.

FORMATO EXACTO:
✨ Afinidad Detectada
${person.name.toUpperCase()} (${person.sun.toUpperCase()})
+
${personB.name.toUpperCase()} (${personB.sun.toUpperCase()})

🔗 Conexión energética hoy: ${percentage}%

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

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `R${rowIndex}:S${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[message, today]] }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `R${rowIndexB}:S${rowIndexB}`,
        valueInputOption: "RAW",
        requestBody: { values: [[message, today]] }
      });

      return res.status(200).json({ choices: [{ message: { content: message } }] });
    }

    /* 💫 AFINIDAD */
if (type === "affinity") {
  if (person.affinity_date === today && person.affinity_daily) {
    return res.status(200).json({
      choices: [{ message: { content: person.affinity_daily } }]
    });
  }

  const promptAffinity = `
Genera una afinidad diaria basada en los DATOS ASTRALES:
Sol: ${person.sun}, Luna: ${person.moon}, Ascendente: ${person.rising}.

INSTRUCCIONES DE FORMATO (OBLIGATORIO):
Debes usar DOBLE SALTO DE LÍNEA entre cada sección para que el texto sea muy visual y espaciado.

ESTRUCTURA EXACTA:

Hoy, ${todayFormatted}, conectas especialmente con:

🔥 [SIGNO] → frase corta.

💫 [SIGNO] → frase corta.

⚡ [SIGNO] → frase corta.

⚠️ Evita hoy:

[EMOJI DEL SIGNO] [NOMBRE DEL SIGNO] → advertencia breve.

💡 Consejo:

[Frase final de consejo en su propia línea]

---
REGLAS CRÍTICAS:
1. Deja una línea totalmente vacía entre CADA signo.
2. Deja una línea vacía después de "Evita hoy:" y después de "Consejo:".
3. Varía los signos, no repitas siempre los mismos de fuego.
4. PROHIBICIÓN ABSOLUTA: El signo que aparece en "Evita hoy" NO PUEDE ser ninguno de los tres signos con los que se conecta especialmente. Deben ser signos diferentes.
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
        model: "gpt-4o-mini",
        max_tokens: 350, // Aumentado para permitir los saltos de línea extra
        temperature: 1.0, 
        messages: [
          { 
            role: "system", 
            content: "Eres un astrólogo experto. Tu prioridad absoluta es el FORMATO VISUAL. Debes separar cada párrafo y cada signo con una línea en blanco obligatoriamente." 
          }, 
          { role: "user", content: promptAffinity }
        ]
      })
    }
  );

  const data = await response.json();
  const message = data.choices[0].message.content;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `O${rowIndex}:P${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[message, today]] }
  });

  return res.status(200).json({ choices: [{ message: { content: message } }] });
}
  
/* 🌌 ENERGÍA LARGA (HORÓSCOPO COMPLETO) */
if (type === "energy_long") {
  // 1. Si el día en W es hoy, leemos de la hoja y no gastamos créditos
  if (person.message_daily_long_day === today && person.message_daily_long) {
    return res.status(200).json({ 
      choices: [{ message: { content: person.message_daily_long } }] 
    });
  }

  // 2. Si no existe, usamos tu prompt detallado
  const promptLong = `
Genera un horóscopo profundo y extendido.
INSTRUCCIÓN DE FORMATO: No utilices asteriscos (**), ni almohadillas (#), ni ningún tipo de formato Markdown. Escribe los títulos en mayúsculas limpias.

Hola ${person.name},
Hoy, ${todayFormatted}, las estrellas revelan una vibración especial para ti.

✨ FRASE POTENTE DE HOY
(Escribe una frase inspiradora basada en Sol: ${person.sun} y Luna: ${person.moon})

❤️ EN EL AMOR
(Desarrollo detallado de 3-4 líneas sobre sentimientos y conexiones)

💼 EN EL TRABAJO Y DINERO
(Desarrollo detallado de 3-4 líneas sobre proyectos y abundancia)

🌿 EN TU BIENESTAR
(Desarrollo detallado de 3-4 líneas sobre salud y energía mental)

🔥 ACCIÓN CONCRETA PARA EL ÉXITO
(Un consejo práctico y místico para ejecutar hoy)

💫 MENSAJE FINAL DEL COSMOS:
(Una frase de cierre que resuene con su Ascendente: ${person.rising})
`;

  const responseLong = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        temperature: 0.8,
        messages: [{ role: "user", content: promptLong }]
      })
    }
  );

  const dataLong = await responseLong.json();
  const messageLong = dataLong.choices[0].message.content;

  // 3. GUARDAMOS EL RESULTADO: Mensaje en V y Fecha en W
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `V${rowIndex}:W${rowIndex}`, 
    valueInputOption: "RAW",
    requestBody: {
      values: [[messageLong, today]]
    }
  });

  return res.status(200).json({ choices: [{ message: { content: messageLong } }] });
}
    
/* ⚡ ENERGÍA (Por defecto) */
if (type !== "affinity") {
  if (person.message_date === today && person.message_daily) {
    return res.status(200).json({
      choices: [{ message: { content: person.message_daily } }]
    });
  }

  // CALCULO ALEATORIO REAL DESDE EL CÓDIGO (Para evitar el sesgo del 70%)
  const randomPercentage = Math.floor(Math.random() * (100 - 19 + 1)) + 19;
  
  const prompt = `
Eres un guía astrológico moderno para ZODIX. 
DATOS: ${person.name}, Sol en ${person.sun}, Luna en ${person.moon}, Ascendente en ${person.rising}.

INSTRUCCIÓN DE DISEÑO (CRÍTICA):
- Debes dejar una LÍNEA EN BLANCO (doble salto de línea) entre cada sección.
- El porcentaje de hoy es exactamente: ${randomPercentage}%.
- La frase de 4 palabras debe ser coherente con ese ${randomPercentage}%.

ESTRUCTURA EXACTA CON ESPACIOS:

Hola, ${person.name},
Hoy, ${todayFormatted}

Tu energía astral de hoy: ${randomPercentage}% - [Frase de 4 palabras]

✨ [Una verdad corta que combine Sol en ${person.sun} con Luna en ${person.moon}].

🔥 [Acción concreta de menos de 20 palabras para el Ascendente ${person.rising}].

📍 [Conexión mágica con su origen ${person.birth_place} o su hora ${person.birth_hour}].

💫 [Cierre de 3 palabras].
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
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "Eres un mentor astrológico que escribe de forma muy visual. SIEMPRE dejas una línea vacía entre párrafos. No usas negritas." 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        temperature: 1.0 
      })
    }
  );

  const data = await response.json();
  const message = data.choices[0].message.content;

  // GUARDAR EN GOOGLE SHEETS
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `M${rowIndex}:N${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[message, today]] }
  });

  return res.status(200).json({ choices: [{ message: { content: message } }] });
}

  } catch (error) {
    res.status(500).json({
      error: "server_error",
      message: error.toString()
    });
  }
}
