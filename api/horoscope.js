export default async function handler(req, res) {

  const { uid } = req.query;

  const sheetUrl = "https://docs.google.com/spreadsheets/d/1asctglNYLWEEWaFcGPoWFFs--wOz21f7LXLwLrLQa-0/gviz/tq?tqx=out:json";

  const sheet = await fetch(sheetUrl);
  const text = await sheet.text();

  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  let person = null;

  for (let r of rows) {
    if (r.c[0] && r.c[0].v && r.c[0].v.includes(uid)) {
      person = {
        name: r.c[4]?.v,
        sun: r.c[8]?.v,
        moon: r.c[9]?.v,
        rising: r.c[10]?.v
      };
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

  const prompt = `
Escribe un horóscopo diario personalizado en español.

Empieza siempre con: "Hola ${person.name},"

Ten en cuenta la carta astral de esta persona:
Name: ${person.name}
Sun sign: ${person.sun}
Moon sign: ${person.moon}
Rising sign: ${person.rising}

El mensaje debe sonar como una interpretación astrológica real basada en la carta astral de la persona.

Debe mencionar de forma natural la energía del cielo del día actual (energía lunar, influencia de los astros o movimientos del cielo).

Debe indicar el día actual dentro del texto.

Reglas:
- máximo 4 frases
- tono místico pero moderno
- positivo e inspirador
- fácil de leer
- separa el mensaje en 2 o 3 párrafos cortos
- deja una línea en blanco entre cada párrafo

Hoy es ${today}.

Debe parecer un mensaje personal del universo para esta persona.

Evita frases genéricas de horóscopo y evita repetir siempre la misma estructura.
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

  res.status(200).json(data);
}
