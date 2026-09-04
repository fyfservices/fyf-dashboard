const PYG = 6100;

const CLIENTES = [
  "Adriana Roa","Ailin Sidney","Alejandro Nardini","Alejandro Ventora",
  "Ariel","Claudia Doria","Dayana","Diego Gonzalez","F&F Services",
  "Juan Carlos","Juan y Nacho","Judy","Laura y Nathalia",
  "Maria Courel","Mariano","Rocio","Soledad"
];

function recortarSemana(texto) {
  const re = /\d{2}\/\d{2}\/\d{4}/g;
  const pos = [];
  let m;
  while ((m = re.exec(texto)) !== null) pos.push(m.index);
  if (pos.length < 2) return { fecha: null, bloque: texto };
  const bloque = texto.slice(pos[0], pos[1]);
  const f = texto.slice(pos[0], pos[0] + 10).split('/');
  return { fecha: `${f[2]}-${f[1]}-${f[0]}`, bloque };
}

const INSTRUCCIONES = `Sos un extractor de datos. Recibis el reporte semanal de campanas de una agencia y devolves SOLO un array JSON, sin texto alrededor y sin bloques de codigo.

Un objeto por campana mencionada, con estos campos exactos:
cliente, campana, estado, leads, spend, cpl, moneda, ctr, cpc, hook_rate, hold_rate, conv_link_to_lead, evaluacion, recomendacion, accionables, nota_importante

Reglas:
- "cliente" DEBE ser uno de esta lista exacta: ${CLIENTES.join(' | ')}. Si aparece un nombre nuevo que no esta en la lista, usalo tal cual viene.
- "estado": "activa" o "desactivada".
- "moneda": "USD" o "PYG". Los montos escritos con Gs. son PYG. Los montos con $ y coma decimal (ej 1,67) son USD. Los montos con $ y punto de miles (ej 47.897) son PYG.
- Numeros como numeros, sin simbolos ni separadores de miles. Porcentajes como numero (39.25 y no "39,25%").
- Si un dato no aparece en el texto, poné null. No inventes ni calcules nada que no este escrito.
- "evaluacion" y "recomendacion": el texto tal como esta, resumido si es muy largo.
- "accionables": array de objetos {texto, urgencia}. urgencia es "alta" si es un error de pago, fatiga de creativos (frases tipo "solo funciona uno"), o un CPL disparado; "media" si pide optimizar o testear algo; "baja" si solo dice mantener o dejar correr.
- "nota_importante": el texto que sigue a "Nota importante:" para ese cliente, o null.
- Las campanas listadas bajo "Campanas Desactivadas" van con estado "desactivada", metricas en null, y el motivo en nota_importante.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY' });

  try {
    const texto = req.body?.texto;
    if (!texto) return res.status(400).json({ error: 'Falta el campo texto' });

    const { fecha, bloque } = recortarSemana(texto);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 16000,
        system: INSTRUCCIONES,
        messages: [{ role: 'user', content: bloque }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'Error de la API', detalle: data });

    const bloqueTexto = data.content?.find(b => b.type === 'text')?.text || '';
    const limpio = bloqueTexto.replace(/```json/g, '').replace(/```/g, '').trim();

    let filas;
    try {
      filas = JSON.parse(limpio);
    } catch (e) {
      return res.status(500).json({ error: 'La respuesta no es JSON valido', crudo: limpio.slice(0, 1000) });
    }

    const salida = filas.map(f => ({
      ...f,
      fecha,
      spend_usd: f.spend == null ? null : (f.moneda === 'PYG' ? Math.round(f.spend / PYG * 100) / 100 : f.spend),
      cpl_usd: f.cpl == null ? null : (f.moneda === 'PYG' ? Math.round(f.cpl / PYG * 100) / 100 : f.cpl),
    }));

    return res.status(200).json({ fecha, cantidad: salida.length, filas: salida });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
