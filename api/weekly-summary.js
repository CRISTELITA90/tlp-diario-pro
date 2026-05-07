module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { summary, count } = req.body || {};
  if (!summary) return res.status(400).json({ error: 'summary required' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'API not configured' });
  }

  const PROMPT = `Eres un psicólogo clínico especializado en TLP (Trastorno Límite de Personalidad)
con formación en DBT. Analiza este resumen de la semana emocional de tu paciente.

REGISTROS DE LA SEMANA (${count} entradas):
${summary}

Responde SOLO con JSON válido, sin texto adicional:
{
  "insight": "Observación principal compasiva y no-punitiva sobre la semana (2-3 frases)",
  "patron": "Patrón emocional o conductual identificado, o null si no hay patrón claro",
  "progreso": "Observación positiva o área de mejora observada, o null",
  "ejercicio": {
    "nombre": "Una habilidad DBT concreta para practicar esta semana",
    "pasos": ["paso 1", "paso 2", "paso 3"]
  }
}`;

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
        max_tokens: 500,
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });

    if (!response.ok) throw new Error('Anthropic ' + response.status);

    const data  = await response.json();
    const text  = data.content?.[0]?.text?.trim() || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');

    return res.json({ ...JSON.parse(match[0]), source: 'claude' });
  } catch (err) {
    console.error('weekly-summary error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
