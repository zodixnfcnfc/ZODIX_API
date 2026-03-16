export default async function handler(req, res) {

  const { sign } = req.query;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a horoscope writer."
        },
        {
          role: "user",
          content: `Write today's horoscope for ${sign}`
        }
      ]
    })
  });

  const data = await response.json();

  res.status(200).json(data);
}
