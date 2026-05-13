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
      range: "A:Y" 
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

  // Creamos una semilla basada en el nombre y la fecha para que sea única pero estable hoy
  const randomSeed = Math.floor(Math.random() * 1000000);

  const promptCode = `
Genera el "Código del Día" místico para ${person.name} (Sol: ${person.sun}, Asc: ${person.rising}).
FECHA ACTUAL: ${todayFormatted}
SEMILLA DE VARIACIÓN: ${randomSeed}

INSTRUCCIONES CRÍTICAS DE ALEATORIEDAD:
- El "numero" DEBE ser elegido al azar entre 1 y 22. Evita tendencias al centro (10-14).
- El "momento" DEBE variar en todo el rango (ej. 08:15, 14:40, 22:10). No uses siempre las mismas horas.
- "fase_lunar": Identifica la fase exacta para hoy basándote en la fecha: ${todayFormatted}. El valor de "fase_lunar" DEBE ser exclusivamente uno de estos 8 términos: "Luna Nueva", "Creciente", "Cuarto Creciente", "Gibosa Creciente", "Luna Llena", "Gibosa Menguante", "Cuarto Menguante" o "Menguante". No uses otros términos.
- "mision" y "alerta": Usa verbos y objetos diferentes cada día.

INSTRUCCIONES DE DISEÑO:
1. "mision": Tarea rápida accionable. MÁXIMO 6-10 palabras.
2. "alerta": Advertencia corta. MÁXIMO 5-7 palabras.

RESPONDE ÚNICAMENTE EN FORMATO JSON PURO:
{
  "numero": "número aleatorio entre 1 y 22",
  "numero_desc": "frase mística corta",
  "color": "color",
  "color_desc": "energía del color",
  "momento": "HH:mm (rango 08:00 a 23:00)",
  "momento_desc": "explicación breve",
  "fase_lunar": "Elegir uno de los 8 términos exactos",
  "luna_desc": "Breve explicación de la influencia de esta fase específica",
  "suerte": "X%",
  "mision": "máximo 10 palabras",
  "alerta": "máximo 7 palabras",
  "palabra": "una sola palabra"
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
        model: "gpt-4o-mini",
        temperature: 1.0, 
        presence_penalty: 0.6, // Penaliza la repetición de temas
        frequency_penalty: 0.3, // Penaliza la repetición de palabras exactas
        messages: [
          { 
            role: "system", 
            content: "Eres un oráculo místico que nunca se repite. Tu misión es ofrecer una lectura única y sorprendente cada día, variando los números, las horas y los consejos. El JSON debe ser estricto." 
          },
          { role: "user", content: promptCode }
        ]
      })
    }
  );

  const data = await response.json();
  let codeDataText = data.choices[0].message.content;

  // 1. LIMPIEZA
  codeDataText = codeDataText.replace(/```json/g, "").replace(/```/g, "").trim();
  
  // 2. PARSEO
  const finalJson = JSON.parse(codeDataText);

  // 3. GUARDAR
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `T${rowIndex}:U${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[JSON.stringify(finalJson), today]]
    }
  });

  // 4. RESPONDER
  return res.status(200).json(finalJson);
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

  // --- SOLUCIÓN AQUÍ: CAMBIAMOS EL HASH POR UN RANDOM REAL ---
  // Genera un número entero entre 40 y 99 (puedes ajustar el rango)
  const percentage = Math.floor(Math.random() * (99 - 40 + 1)) + 40;

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
        model: "gpt-4o-mini", // He corregido a gpt-4o-mini porque tenías 4.1-mini (que no existe)
        max_tokens: 200,
        temperature: 1.0, // Subimos temperatura para más variedad
        messages: [{ role: "user", content: prompt }]
      })
    }
  );

  const data = await response.json();
  const message = data.choices[0].message.content;

  // GUARDAR EN AMBOS (User A y User B)
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

INSTRUCCIONES DE FORMATO:
- Usa un UNICO salto de línea entre cada sección.
- El texto debe ser limpio y visual.

ESTRUCTURA EXACTA:
Hoy, ${todayFormatted}, conectas especialmente con:

🔥 [SIGNO] → frase corta.
💫 [SIGNO] → frase corta.
⚡ [SIGNO] → frase corta.

⚠️ Evita hoy:

[EMOJI] [SIGNO] → advertencia breve.

💡 Consejo:

[Frase de consejo]

---
REGLAS:
1. No uses negritas ni Markdown.
2. Varía los signos.
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
            content: "Eres un astrólogo experto en formato limpio. Escribe de forma directa, usando solo un salto de línea para separar bloques de texto. No uses negritas." 
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
    
/* 🃏 MEME DEL DÍA - SISTEMA GITHUB */
    if (type === "meme_gen") {
      const signo = person.sun.toLowerCase(); 
      const diaHoy = new Date().getDate();    

      const usuario = "zodixnfcnfc";
      const repo = "ZODIX_API";
      
      // He puesto .JPG en mayúsculas porque así sale en tu foto de GitHub
      const urlMeme = `https://raw.githubusercontent.com/${usuario}/${repo}/main/api/memes/${signo}_${diaHoy}.JPG`;

      return res.status(200).json({ 
        url: urlMeme,
        caption: `Cosas de ${person.sun} hoy...` 
      });
    }
    
/* ⚡ ENERGÍA (Por defecto) */
if (type !== "affinity") {
  if (person.message_date === today && person.message_daily) {
    return res.status(200).json({
      choices: [{ message: { content: person.message_daily } }]
    });
  }

  // CALCULO ALEATORIO REAL DESDE EL CÓDIGO (Para evitar el sesgo del 70%)
  const randomPercentage = Math.floor(Math.random() * (100 - 35 + 1)) + 35;
  
const prompt = `
Eres un guía astrológico de élite. Crea una lectura diaria para ${person.name}.
DATOS: Sol en ${person.sun}, Luna en ${person.moon}, Ascendente en ${person.rising}.
CONTEXTO: Nació en ${person.birth_place} a las ${person.birth_hour}.

INSTRUCCIONES DE DISEÑO:
- Usa el emoji del signo solar del usuario (${person.sun}) para la primera frase.
- La "señal del destino" (🎯) debe ser una SINCRONICIDAD (ej: un número repetido, un color, un aroma, un pensamiento recurrente), NO un evento físico arriesgado que deba ocurrir fuera.
- No uses negritas. Deja siempre una línea en blanco entre párrafos.

ESTRUCTURA:

Hola, ${person.name},
Hoy, ${todayFormatted}

Tu energía astral de hoy: ${randomPercentage}% - [Frase de 4 palabras]

[Emoji del signo ${person.sun}] [Revelación mística: cómo la esencia de ${person.sun} debe equilibrar la emoción de la Luna en ${person.moon} hoy. Máximo 12 palabras].

🚀 [Acción concreta: algo que su Ascendente ${person.rising} le impulsa a ejecutar o cambiar en su entorno hoy. Máximo 12 palabras].

🎯 [Sincronicidad: una señal sutil (un reflejo, un número, un patrón) inspirada en la mística de su hora de nacimiento (${person.birth_hour}) que le dará una respuesta. Máximo 12 palabras].

💫 [Mantra final de 3 palabras].
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
            content: "Eres un mentor astrológico visual. Tu estilo es minimalista y profundo. Solo usas estos símbolos para los signos: Aries ♈, Tauro ♉, Géminis ♊, Cáncer ♋, Leo ♌, Virgo ♍, Libra ♎, Escorpio ♏, Sagitario ♐, Capricornio ♑, Acuario ♒, Piscis ♓." 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        temperature: 0.8
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
