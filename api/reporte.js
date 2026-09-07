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

function partirPorCliente(semana) {
  const lineas = semana.split('\n');
  const re = /^\s*(.{2,40}?)\s+(\d{1,2}\/\d{1,2})\s*$/;
  const cortes = [];
  lineas.forEach((l, i) => {
    const m = l.match(re);
    if (m) cortes.push({ i, cliente: m[1].trim() });
  });
  if (cortes.length === 0) return [{ cliente: 'TODO', texto: semana }];

  const bloques = [];
  const encabezado = lineas.slice(0, cortes[0].i).join('\n').trim();
  if (encabezado) bloques.push({ cliente: 'LISTAS', texto: encabezado });
  cortes.forEach((c, k) => {
    const fin = k + 1 < cortes.length ? cortes[k + 1].i : lineas.length;
    const t = lineas.slice(c.i, fin).join('\n').trim();
    if (t) bloques.push({ cliente: c.cliente, texto: t });
  });
  return bloques;
}

const BASE = `Devolves SOLO un array JSON, sin texto alrededor y sin bloques de codigo.

Un objeto por campana, con estos campos exactos:
cliente, campana, estado, leads, spend, cpl, moneda, ctr, cpc, hook_rate, hold_rate, conv_link_to_lead, evaluacion, recomendacion, accionables, nota_importante

Reglas:
- "cliente" DEBE ser uno de esta lista exacta: ${CLIENTES.join(' | ')}. Si el nombre del reporte es una version corta (ej "Ventora"), usa el de la lista que corresponda. Si es un cliente nuevo que no esta en la lista, usalo tal cual viene.
- "estado": "activa" o "desactivada".
- "moneda": "USD" o "PYG". Montos con Gs. son PYG. Montos con $ y coma decimal (ej 1,67) son USD. Montos con $ y punto de miles (ej 47.897) son PYG.
- Numeros como numeros, sin simbolos ni separadores de miles. Porcentajes como numero (39.25, no "39,25%").
- Si un dato no aparece, poné null. No inventes ni calcules nada que no este escrito.
- "evaluacion" y "recomendacion": el texto tal como esta, resumido si es muy largo.
- "accionables": array de objetos {texto, urgencia}. urgencia "alta" si es error de pago, fatiga de creativos (frases tipo "solo funciona uno"), o CPL disparado; "media" si pide optimizar o testear; "baja" si solo dice mantener o dejar correr.
- "nota_importante": el texto que sigue a "Nota importante:", o null.`;

const INSTRUCCIONES = `Sos un extractor de datos. Recibis la seccion de UN cliente del reporte semanal de campanas de una agencia.

${BASE}`;

const INSTRUCCIONES_LISTAS = `Sos un extractor de datos. Recibis el indice de campanas activas y desactivadas de un reporte semanal.

Extrae UNICAMENTE las campanas que figuran bajo "Campanas Desactivadas". Ignora por completo las que estan bajo "Campanas Activas".

Cada una va con estado "desactivada", todas las metricas en null, y el motivo entre parentesis en nota_importante.

${BASE}`;

async function llamarClaude(sistema, contenido) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: sistema,
      messages: [{ role: 'user', content: contenido }],
    }),
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY' });

  const texto = typeof req.body === 'string' ? req.body : (req.body?.texto || '');
  if (!texto.trim()) return res.status(400).json({ error: 'Body vacio' });

  try {
    const modo = req.query?.modo || 'partir';

    if (modo === 'partir') {
      const { fecha, bloque } = recortarSemana(texto);
      const bloques = partirPorCliente(bloque);
      return res.status(200).json({ fecha, cantidad: bloques.length, bloques });
    }

    const fecha = req.query?.fecha || null;
    const cliente = req.query?.cliente || '';
    const sistema = cliente === 'LISTAS' ? INSTRUCCIONES_LISTAS : INSTRUCCIONES;

    const { ok, status, data } = await llamarClaude(sistema, texto);
    if (!ok) return res.status(status).json({ error: 'Error de la API', detalle: data });

    const txt = data.content?.find(b => b.type === 'text')?.text || '';
    const limpio = txt.replace(/```json/g, '').replace(/```/g, '').trim();

    let filas;
    try {
      filas = JSON.parse(limpio);
    } catch (e) {
      return res.status(500).json({ error: 'La respuesta no es JSON valido', crudo: limpio.slice(0, 800) });
    }

    if (!Array.isArray(filas)) {
      if (filas && typeof filas === 'object') {
        const arr = Object.values(filas).find(v => Array.isArray(v));
        filas = arr ? arr : [filas];
      } else {
        filas = [];
      }
    }
    filas = filas.filter(f => f && typeof f === 'object' && (f.campana || f.cliente));

    filas.forEach(f => {
      const L = Number(f.leads), S = Number(f.spend), C = Number(f.cpl)
      if (f.spend == null && L > 0 && C > 0) f.spend = Math.round(L * C * 100) / 100
      if (f.cpl == null && L > 0 && S > 0) f.cpl = Math.round(S / L * 100) / 100
    });

    const salida = filas.map(f => ({
      ...f,
      accionables_json: JSON.stringify(f.accionables || []),
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
