// Vercel serverless function — proxies to Claude API
// Requires ANTHROPIC_API_KEY environment variable in Vercel project settings

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { transcript } = req.body || {};
  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ error: 'Transcript too short' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'API not configured' });
  }

  const PROMPT = `Eres un asistente clínico especializado en TLP (Trastorno Límite de Personalidad) entrenado en DBT.

Analiza este fragmento de diario emocional y responde SOLO con JSON válido, sin texto adicional:

"${transcript.slice(0, 800)}"

Responde exactamente con esta estructura JSON:
{
  "emociones": ["máximo 3 emociones dominantes en español, en minúsculas"],
  "keywords": ["máximo 5 palabras o frases clave del texto"],
  "intensidad": 7,
  "insight": "Una observación clínica breve, compasiva y sin juicio (1-2 frases)",
  "ejercicio": {
    "nombre": "nombre del ejercicio DBT más adecuado para esta situación",
    "descripcion": "descripción breve del beneficio (1 frase)",
    "pasos": ["paso 1", "paso 2", "paso 3"]
  },
  "audio_recomendado": "calma"
}

Para audio_recomendado usa SOLO uno de: calma, equilibrio, regulacion, respiracion`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Claude response');

    const result = JSON.parse(jsonMatch[0]);
    return res.json({ ...result, source: 'claude' });

  } catch (err) {
    console.error('analyze error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
