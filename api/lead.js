const OK_ROL = ['dueno', 'broker', 'agente'];
const NO_COM = ['menos_2k'];
const NO_INV = ['no'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let b = req.body || {};
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    if (Buffer.isBuffer(b)) { try { b = JSON.parse(b.toString()); } catch (e) { b = {}; } }
    if (!b.nombre || !b.email) {
      return res.status(400).json({ error: 'Faltan nombre o email', recibido: b, tipo: typeof req.body });
    }

    const motivos = [];
    if (b.rol && !OK_ROL.includes(String(b.rol).toLowerCase())) motivos.push('rol');
    if (b.comisiones_mes && NO_COM.includes(String(b.comisiones_mes))) motivos.push('comisiones bajas');
    if (b.invierte && NO_INV.includes(String(b.invierte).toLowerCase())) motivos.push('no invierte');

    const calificado = motivos.length === 0;

    const fila = {
      nombre: b.nombre,
      email: String(b.email).trim().toLowerCase(),
      whatsapp: b.whatsapp || null,
      pais: b.pais || null,
      rol: b.rol || null,
      comisiones_mes: b.comisiones_mes || null,
      invierte: b.invierte || null,
      calificado,
      motivo_descalifica: motivos.length ? motivos.join(', ') : null,
      estado: calificado ? 'pendiente' : 'descalificado',
      origen: b.origen || 'landing',
    };

    const base = process.env.REACT_APP_SUPABASE_URL;
    const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (!base || !key) return res.status(500).json({ error: 'Faltan variables de Supabase' });

    const r = await fetch(base + '/rest/v1/leads?on_conflict=email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(fila),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'No pude guardar', detalle: data });

    return res.status(200).json({ ok: true, calificado, motivos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
