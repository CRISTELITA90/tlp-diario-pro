// Lectura narrativa opcional del informe de 40 dias.
// Recibe el informe YA CALCULADO en el movil y solo lo interpreta.
// No recibe datos crudos ni puede inventar cifras: si no esta en el informe,
// no esta en la lectura.
// Requiere ANTHROPIC_API_KEY en las variables de entorno de Vercel.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { informe } = req.body || {};
  if (!informe || informe.trim().length < 50) {
    return res.status(400).json({ error: 'informe required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'API not configured' });
  }

  const PROMPT = `Eres un psicologo clinico con formacion en DBT. Vas a leer el informe de
progreso de 40 dias de una persona con TLP, generado automaticamente a partir de sus
propios registros.

REGLAS INNEGOCIABLES:
- Usa UNICAMENTE lo que aparece en el informe. No inventes cifras, fechas, hechos
  ni citas. Si un dato no esta, no existe.
- No diagnostiques. No interpretes psicopatologia que no este escrita.
- NUNCA emitas un veredicto de fracaso ni de que no ha habido progreso. Si los
  datos no muestran mejora, habla de sostener, de observar o de un periodo de
  meseta, y di con claridad que registrar durante 40 dias ya es trabajo hecho.
- No des instrucciones medicas ni hables de medicacion.
- Tono: calido, adulto, directo. Nada de felicitaciones vacias ni de lenguaje
  motivacional hueco. Trata a quien lee como a una persona capaz.
- Maximo 150 palabras. Espanol de Espana. Tutea.
- Si el informe menciona malestar intenso, cierra recordando en una frase que
  esto no sustituye a su terapeuta.

INFORME:
${String(informe).slice(0, 6000)}

Responde SOLO con JSON valido, sin texto adicional:
{
  "lectura": "Tu lectura del periodo, en 2 o 3 parrafos cortos separados por saltos de linea"
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
        max_tokens: 700,
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });

    if (!response.ok) {
      const detalle = await response.text();
      return res.status(502).json({ error: 'upstream error', detalle: detalle.slice(0, 300) });
    }

    const data = await response.json();
    const texto = (data.content && data.content[0] && data.content[0].text) || '';

    let salida;
    try {
      salida = JSON.parse(texto);
    } catch (e) {
      const m = texto.match(/\{[\s\S]*\}/);
      salida = m ? JSON.parse(m[0]) : { lectura: texto.trim() };
    }

    return res.status(200).json({ lectura: salida.lectura || '' });

  } catch (e) {
    return res.status(500).json({ error: 'fallo al generar la lectura' });
  }
};
