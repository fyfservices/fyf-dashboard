// Webhook de Calendly — marca leads como "agendado" cuando reservan una reunión
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

    // Calendly manda el evento en b.event y los datos en b.payload
    const evento = b.event;
    const payload = b.payload || {};

    // Solo nos interesa cuando alguien AGENDA (invitee.created)
    if (evento !== 'invitee.created') {
      return res.status(200).json({ ok: true, ignorado: evento });
    }

    // El email del que agendó viene en payload.email
    const email = payload.email ? String(payload.email).trim().toLowerCase() : null;
    if (!email) {
      return res.status(200).json({ ok: true, sin_email: true });
    }

    const base = process.env.REACT_APP_SUPABASE_URL;
    const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (!base || !key) return res.status(500).json({ error: 'Faltan variables de Supabase' });

    // Actualizar el lead: marcarlo como agendado
    const updates = {
      estado: 'agendado',
      agendado_at: new Date().toISOString(),
      agendo: true,
    };

    const r = await fetch(base + '/rest/v1/leads?email=eq.' + encodeURIComponent(email), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(updates),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: 'No pude actualizar', detalle: data });

    // Si no encontró ningún lead con ese email, avisamos pero no es error
    const encontrado = Array.isArray(data) && data.length > 0;
    return res.status(200).json({ ok: true, encontrado, email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
