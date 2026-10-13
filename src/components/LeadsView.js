import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const ROL_LABEL = { dueno: 'Dueño', broker: 'Broker', agente: 'Agente', otro: 'Otro' }
const COM_LABEL = { menos_2k: '< $2K', '2k_5k': '$2K–5K', '5k_15k': '$5K–15K', mas_15k: '> $15K' }
const INV_LABEL = { si: 'Sí', no: 'No', tal_vez: 'Tal vez' }
const OBST_LABEL = { tiempo: 'Tiempo', dinero: 'Dinero', confianza: 'Confianza', tecnologia: 'Tecnología', otro: 'Otro' }
const ESTADO_LABEL = { pendiente: 'Pendiente', contactado: 'Contactado', agendado: 'Agendado', presento: 'Se presentó', no_show: 'No se presentó', seguimiento: 'En seguimiento', cerrado: 'Cerrado', perdido: 'Perdido', descartado: 'Descartado', descalificado: 'Descalificado' }
const ESTADO_CLS = {
  pendiente: 'estado-pendiente', contactado: 'estado-contactado', agendado: 'estado-agendado',
  presento: 'estado-presento', no_show: 'estado-noshow', seguimiento: 'estado-seguimiento',
  cerrado: 'estado-cerrado', perdido: 'estado-perdido', descartado: 'estado-descartado', descalificado: 'estado-descartado',
}
const CONCEPTO_LABEL = { fee: 'Fee de compromiso', primera_cuota: '1ra cuota', pif: 'PIF' }
const RESPONSABLES = ['Fran', 'Feli']
const CANAL_LABEL = { pauta: 'Pauta', referido: 'Referido', organico: 'Orgánico', prospeccion: 'Prospección' }
const CANAL_COLOR = { pauta: '#4CAF50', referido: '#5B9BD5', organico: '#F5C842', prospeccion: '#9B7FE8' }

function minutosDesde(fechaStr) {
  if (!fechaStr) return null
  return Math.floor((Date.now() - new Date(fechaStr).getTime()) / 60000)
}
function money(n) {
  if (n === null || n === undefined || n === '') return '—'
  return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function KpiCard({ label, value, sub, alert, accent }) {
  return (
    <div className={`kpi-card${alert ? ' kpi-alert' : ''}`}>
      <div className="kpi-value" style={accent ? { color: 'var(--green)' } : {}}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function MiniBar({ data, labelFn }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="mini-bar-list">
      {data.map(d => (
        <div key={d.key} className="mini-bar-row">
          <span className="mini-bar-label">{labelFn(d.key)}</span>
          <div className="mini-bar-track">
            <div className="mini-bar-fill" style={{ width: `${(d.count / max) * 100}%`, background: 'var(--accent)' }} />
          </div>
          <span className="mini-bar-count">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

function Embudo({ leads }) {
  const etapas = [
    { key: 'total', label: 'Recibidos', count: leads.length },
    { key: 'calificado', label: 'Calificados', count: leads.filter(l => l.calificado).length },
    { key: 'contactado', label: 'Contactados', count: leads.filter(l => l.contactado_at).length },
    { key: 'agendado', label: 'Agendados', count: leads.filter(l => l.agendado_at).length },
    { key: 'presento', label: 'Se presentaron', count: leads.filter(l => l.se_presento === true).length },
    { key: 'cerrado', label: 'Cerrados', count: leads.filter(l => l.estado === 'cerrado').length },
  ]
  const max = etapas[0].count || 1
  return (
    <div className="embudo">
      {etapas.map((e, i) => {
        const pct = Math.round((e.count / max) * 100)
        const conv = i > 0 && etapas[i - 1].count > 0 ? Math.round((e.count / etapas[i - 1].count) * 100) : null
        return (
          <div key={e.key} className="embudo-step">
            <div className="embudo-bar-wrap"><div className="embudo-bar" style={{ width: `${pct}%` }} /></div>
            <div className="embudo-meta">
              <span className="embudo-label">{e.label}</span>
              <span className="embudo-count">{e.count}</span>
              {conv !== null && <span className="embudo-conv">{conv}%</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Modal de cierre
const COMISION_MEDIO = { Stripe: 4.4, Transferencia: 0, Crypto: 0, Pesos: 0, Efectivo: 0, Otro: 0 }

function ModalCierre({ lead, onClose, onSaved }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [ticket, setTicket] = useState(lead.ticket_total || '')
  const [modalidad, setModalidad] = useState(lead.modalidad_pago || 'pif')
  const [pagoLlamada, setPagoLlamada] = useState(lead.pago_llamada || '')
  const [concepto, setConcepto] = useState(lead.concepto_pago || 'fee')
  const [medioPago, setMedioPago] = useState('Stripe')
  const [comisionPct, setComisionPct] = useState(COMISION_MEDIO.Stripe)
  const [fechaPago, setFechaPago] = useState(lead.cerrado_at ? lead.cerrado_at.slice(0, 10) : hoy)
  const [cuotasList, setCuotasList] = useState([]) // [{monto, fecha}]
  const [saving, setSaving] = useState(false)

  const saldo = ticket ? Number(ticket) - Number(pagoLlamada || 0) : null
  const sumaCuotas = cuotasList.reduce((s, c) => s + Number(c.monto || 0), 0)

  // Generar N cuotas mensuales automáticas desde una fecha
  function generarCuotas(n) {
    if (!saldo || saldo <= 0 || n <= 0) { setCuotasList([]); return }
    const montoC = Math.round((saldo / n) * 100) / 100
    const base = new Date(fechaPago)
    const arr = []
    for (let i = 1; i <= n; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate())
      arr.push({ monto: montoC, fecha: d.toISOString().slice(0, 10) })
    }
    setCuotasList(arr)
  }

  function updateCuota(idx, campo, val) {
    setCuotasList(cuotasList.map((c, i) => i === idx ? { ...c, [campo]: val } : c))
  }

  async function guardar() {
    if (!ticket) { alert('Ingresá el ticket total'); return }
    if (modalidad === 'cuotas' && cuotasList.length === 0) { alert('Generá las cuotas o cambiá a PIF'); return }
    setSaving(true)
    const updates = {
      estado: 'cerrado', cerrado: true, cerrado_at: new Date(fechaPago).toISOString(),
      ticket_total: Number(ticket), modalidad_pago: modalidad,
      cantidad_cuotas: modalidad === 'cuotas' ? cuotasList.length : null,
      monto_cuota: modalidad === 'cuotas' && cuotasList.length ? cuotasList[0].monto : null,
      pago_llamada: Number(pagoLlamada || 0), concepto_pago: concepto, saldo_pendiente: saldo,
    }
    await supabase.from('leads').update(updates).eq('id', lead.id)

    // Sincronizar con Contabilidad: borrar ingresos previos de este lead y recrear
    await supabase.from('ingresos').delete().eq('lead_id', lead.id)
    const aCrear = []
    const conceptoLabel = { fee: 'Fee de compromiso', primera_cuota: '1ra cuota', pif: 'PIF' }[concepto] || 'Pago'
    // El pago en llamada (fee) como ingreso COBRADO
    if (Number(pagoLlamada) > 0) {
      aCrear.push({
        fecha: fechaPago, concepto: `${conceptoLabel} — ${lead.nombre}`, cliente: lead.nombre,
        monto_bruto: Number(pagoLlamada), monto_neto: Math.round(Number(pagoLlamada) * (1 - comisionPct / 100) * 100) / 100, medio_pago: medioPago,
        comision_pct: comisionPct, cobrado: true, origen: 'crm', lead_id: lead.id,
      })
    }
    // Las cuotas como ingresos PREVISTOS
    if (modalidad === 'cuotas') {
      cuotasList.forEach((c, i) => {
        aCrear.push({
          fecha: c.fecha, concepto: `Cuota ${i + 1}/${cuotasList.length} — ${lead.nombre}`, cliente: lead.nombre,
          monto_bruto: Number(c.monto), monto_neto: Math.round(Number(c.monto) * (1 - comisionPct / 100) * 100) / 100, medio_pago: medioPago,
          comision_pct: comisionPct, cobrado: false, origen: 'crm', lead_id: lead.id,
        })
      })
    } else if (modalidad === 'pif' && saldo > 0) {
      // Si es PIF pero quedó saldo (pagó parte en llamada), el resto previsto para la fecha de pago
      aCrear.push({
        fecha: fechaPago, concepto: `Saldo PIF — ${lead.nombre}`, cliente: lead.nombre,
        monto_bruto: saldo, monto_neto: Math.round(saldo * (1 - comisionPct / 100) * 100) / 100, medio_pago: medioPago,
        comision_pct: comisionPct, cobrado: false, origen: 'crm', lead_id: lead.id,
      })
    }
    if (aCrear.length) await supabase.from('ingresos').insert(aCrear)

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h3>{lead.estado === 'cerrado' ? 'Editar cierre' : 'Cerrar venta'} — {lead.nombre}</h3>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field">
            <label>Ticket total (USD)</label>
            <input type="number" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="3000" />
          </div>
          <div className="form-field">
            <label>Modalidad</label>
            <select value={modalidad} onChange={e => { setModalidad(e.target.value); setCuotasList([]) }}>
              <option value="pif">PIF (pago completo)</option>
              <option value="cuotas">En cuotas</option>
            </select>
          </div>
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field">
            <label>Pagó ahora</label>
            <input type="number" value={pagoLlamada} onChange={e => setPagoLlamada(e.target.value)} placeholder="500" />
          </div>
          <div className="form-field">
            <label>Concepto</label>
            <select value={concepto} onChange={e => setConcepto(e.target.value)}>
              <option value="fee">Fee de compromiso</option>
              <option value="primera_cuota">1ra cuota</option>
              <option value="pif">PIF</option>
            </select>
          </div>
        </div>
        <div className="form-field" style={{ marginBottom: 10 }}>
          <label>Fecha del pago</label>
          <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field">
            <label>Medio de pago</label>
            <select value={medioPago} onChange={e => { setMedioPago(e.target.value); setComisionPct(COMISION_MEDIO[e.target.value] ?? 0) }}>
              {Object.keys(COMISION_MEDIO).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>% comisión pasarela</label>
            <input type="number" value={comisionPct} onChange={e => setComisionPct(Number(e.target.value))} />
          </div>
        </div>

        {modalidad === 'cuotas' && (
          <div className="cierre-cuotas">
            <div className="cierre-cuotas-head">
              <span>Saldo a financiar: <strong>{saldo !== null ? money(saldo) : '—'}</strong></span>
              <select onChange={e => generarCuotas(Number(e.target.value))} value={cuotasList.length || ''}>
                <option value="">Generar cuotas…</option>
                {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} cuotas mensuales</option>)}
              </select>
            </div>
            {cuotasList.map((c, i) => (
              <div key={i} className="cierre-cuota-row">
                <span className="cierre-cuota-n">#{i + 1}</span>
                <input type="number" value={c.monto} onChange={e => updateCuota(i, 'monto', e.target.value)} />
                <input type="date" value={c.fecha} onChange={e => updateCuota(i, 'fecha', e.target.value)} />
              </div>
            ))}
            {cuotasList.length > 0 && (
              <div className="cierre-cuotas-check" style={{ color: Math.abs(sumaCuotas - saldo) < 1 ? 'var(--green)' : '#ffa000' }}>
                Suma cuotas: {money(sumaCuotas)} {Math.abs(sumaCuotas - saldo) >= 1 ? `(saldo: ${money(saldo)})` : '✓'}
              </div>
            )}
          </div>
        )}

        {modalidad === 'pif' && saldo > 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
            Saldo pendiente: <strong style={{ color: 'var(--text)' }}>{money(saldo)}</strong> (queda como previsto para el {fechaPago})
          </div>
        )}

        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : (lead.estado === 'cerrado' ? 'Guardar cambios' : 'Registrar cierre')}</button>
        </div>
      </div>
    </div>
  )
}

// Botones de acción según estado
function AccionesFila({ lead, onUpdate, onCerrar }) {
  const [saving, setSaving] = useState(false)
  const [menuDescarte, setMenuDescarte] = useState(false)
  async function set(updates) {
    setSaving(true)
    await supabase.from('leads').update(updates).eq('id', lead.id)
    setSaving(false)
    setMenuDescarte(false)
    onUpdate()
  }
  // Descartar pidiendo motivo: troll (no cuenta) o perdido (mantiene historia)
  function BotonDescartar() {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button className="btn-accion btn-descartar" onClick={() => setMenuDescarte(!menuDescarte)}>Descartar</button>
        {menuDescarte && (
          <div className="descarte-menu" onClick={e => e.stopPropagation()}>
            <div className="descarte-opt" onClick={() => set({ estado: 'descartado', motivo_descarte: 'perdido' })}>
              <strong>No respondió</strong><span>Cuenta en el embudo</span>
            </div>
            <div className="descarte-opt" onClick={() => set({ estado: 'descartado', motivo_descarte: 'troll' })}>
              <strong>Troll / inválido</strong><span>No cuenta en métricas</span>
            </div>
          </div>
        )}
      </div>
    )
  }
  if (saving) return <span style={{ fontSize: 11, color: 'var(--muted)' }}>…</span>

  const e = lead.estado || 'pendiente'
  if (e === 'pendiente') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-contactar" onClick={() => set({ estado: 'contactado', contactado_at: new Date().toISOString() })}>Contactado</button>
      <BotonDescartar />
    </div>
  )
  if (e === 'contactado') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-agendar" onClick={() => set({ estado: 'agendado', agendado_at: new Date().toISOString() })}>Agendado</button>
      <BotonDescartar />
    </div>
  )
  if (e === 'agendado') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-cerrar" onClick={() => set({ estado: 'presento', se_presento: true, show_up_at: new Date().toISOString() })}>Se presentó</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'no_show', se_presento: false })}>No se presentó</button>
    </div>
  )
  if (e === 'presento') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-cerrar" onClick={onCerrar}>Cerrar venta</button>
      <button className="btn-accion btn-agendar" onClick={() => set({ estado: 'seguimiento' })}>Seguimiento</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'perdido', motivo_descarte: 'perdido' })}>Perdido</button>
    </div>
  )
  if (e === 'seguimiento') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-cerrar" onClick={onCerrar}>Cerrar venta</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'perdido', motivo_descarte: 'perdido' })}>Perdido</button>
    </div>
  )
  if (e === 'no_show') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-agendar" onClick={() => set({ estado: 'agendado' })}>Reagendar</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'perdido', motivo_descarte: 'perdido' })}>Perdido</button>
    </div>
  )
  if (e === 'cerrado') return (
    <div className="lead-acciones">
      <span style={{ fontSize: 11, color: '#4caf50', marginRight: 4 }}>✓ Cliente</span>
      <button className="btn-accion btn-agendar" onClick={onCerrar}>Editar cierre</button>
      <button className="btn-accion btn-descartar" onClick={() => { if (window.confirm('¿Deshacer el cierre? El lead vuelve a "Se presentó" y se borran los datos de venta.')) set({ estado: 'presento', cerrado: false, cerrado_at: null, ticket_total: null, modalidad_pago: null, cantidad_cuotas: null, monto_cuota: null, pago_llamada: null, concepto_pago: null, saldo_pendiente: null }) }}>Deshacer</button>
    </div>
  )
  if (e === 'descalificado') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-contactar" onClick={() => set({ estado: 'contactado', contactado_at: new Date().toISOString() })}>Contactar igual</button>
      <BotonDescartar />
    </div>
  )
  if (e === 'perdido' || e === 'descartado') return (
    <button className="btn-accion btn-contactar" onClick={() => set({ estado: 'pendiente' })}>Reabrir</button>
  )
  return null
}

// Notas por lead
function NotaBtn({ lead, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState(lead.notas || '')
  const [saving, setSaving] = useState(false)
  async function guardar() {
    setSaving(true)
    await supabase.from('leads').update({ notas: texto }).eq('id', lead.id)
    setSaving(false)
    setOpen(false)
    onUpdate()
  }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn-nota" onClick={() => { setTexto(lead.notas || ''); setOpen(!open) }} title={lead.notas || 'Agregar nota'}>
        {lead.notas ? '📝' : '✎'}
      </button>
      {open && (
        <div className="nota-pop" onClick={e => e.stopPropagation()}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribí una nota…" autoFocus />
          <div className="nota-pop-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-save" onClick={guardar} disabled={saving}>{saving ? '…' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Selector de responsable
function AsignarBtn({ lead, onUpdate }) {
  const [open, setOpen] = useState(false)
  async function asignar(r) {
    await supabase.from('leads').update({ asignado_a: r }).eq('id', lead.id)
    setOpen(false)
    onUpdate()
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-asignar" onClick={() => setOpen(!open)}>
        {lead.asignado_a || '+ Asignar'}
      </button>
      {open && (
        <div className="asignar-menu">
          {RESPONSABLES.map(r => (
            <div key={r} className="asignar-opt" onClick={() => asignar(r)}>{r}</div>
          ))}
          {lead.asignado_a && <div className="asignar-opt" onClick={() => asignar(null)} style={{ color: 'var(--muted)' }}>Quitar</div>}
        </div>
      )}
    </div>
  )
}

// Modal para cargar un lead manualmente (otros canales)
function ModalNuevoLead({ onClose, onSaved }) {
  const [f, setF] = useState({ nombre: '', email: '', whatsapp: '', pais: '', rol: 'dueno', comisiones_mes: '2k_5k', invierte: 'si', canal: 'referido', asignado_a: '' })
  const [saving, setSaving] = useState(false)
  async function guardar() {
    if (!f.nombre) { alert('Ingresá al menos el nombre'); return }
    setSaving(true)
    await supabase.from('leads').insert({
      nombre: f.nombre, email: f.email || null, whatsapp: f.whatsapp || null, pais: f.pais || null,
      rol: f.rol, comisiones_mes: f.comisiones_mes, invierte: f.invierte,
      canal: f.canal, asignado_a: f.asignado_a || null,
      calificado: true, estado: 'contactado', contactado_at: new Date().toISOString(),
      origen: 'manual',
    })
    setSaving(false)
    onSaved(); onClose()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h3>Nuevo lead (carga manual)</h3>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field"><label>Nombre *</label><input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></div>
          <div className="form-field"><label>Canal</label><select value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })}>{Object.entries(CANAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field"><label>Email</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          <div className="form-field"><label>WhatsApp</label><input value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} /></div>
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field"><label>País</label><input value={f.pais} onChange={e => setF({ ...f, pais: e.target.value })} /></div>
          <div className="form-field"><label>Asignar a</label><select value={f.asignado_a} onChange={e => setF({ ...f, asignado_a: e.target.value })}><option value="">Sin asignar</option>{RESPONSABLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        </div>
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="form-field"><label>Rol</label><select value={f.rol} onChange={e => setF({ ...f, rol: e.target.value })}>{Object.entries(ROL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="form-field"><label>Comisiones</label><select value={f.comisiones_mes} onChange={e => setF({ ...f, comisiones_mes: e.target.value })}>{Object.entries(COM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Agregar lead'}</button>
        </div>
      </div>
    </div>
  )
}

export default function LeadsView() {
  const [leads, setLeads] = useState([])
  const [gastoCaptacion, setGastoCaptacion] = useState(0)
  const [editandoGasto, setEditandoGasto] = useState(false)
  const [gastoInput, setGastoInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('all')
  const [filtroAsignado, setFiltroAsignado] = useState('all')
  const [urgentes, setUrgentes] = useState([])
  const [cerrarLead, setCerrarLead] = useState(null)
  const [nuevoLead, setNuevoLead] = useState(false)

  const fetchLeads = useCallback(async () => {
    const [{ data: ld }, { data: cfg }] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('config').select('*').eq('key', 'gasto_captacion').single(),
    ])
    if (ld) {
      setLeads(ld)
      setUrgentes(ld.filter(l => l.calificado && (l.estado === 'pendiente' || !l.estado) && minutosDesde(l.created_at) >= 10))
    }
    if (cfg) setGastoCaptacion(Number(cfg.value || 0))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
    const interval = setInterval(fetchLeads, 60000)
    return () => clearInterval(interval)
  }, [fetchLeads])

  // Filtro por asignado para métricas
  const baseConTrolls = filtroAsignado === 'all' ? leads : leads.filter(l => l.asignado_a === filtroAsignado)
  // Los trolls no cuentan en NINGUNA métrica (como si no existieran)
  const base = baseConTrolls.filter(l => l.motivo_descarte !== 'troll')

  // Conteos del embudo
  const total = base.length
  const calificados = base.filter(l => l.calificado).length
  const contactados = base.filter(l => l.contactado_at).length
  const agendados = base.filter(l => l.agendado_at).length
  const presentados = base.filter(l => l.se_presento === true).length
  const cerrados = base.filter(l => l.estado === 'cerrado')
  const nCerrados = cerrados.length
  const pendientes = base.filter(l => l.calificado && (l.estado === 'pendiente' || !l.estado)).length

  // Gasto de la campaña de captación (manual desde config)
  const gastoTotal = gastoCaptacion

  // SOLO leads de PAUTA para métricas de ads (CPL, CAC, ROAS)
  const esPauta = l => (l.canal || 'pauta') === 'pauta'
  const totalPauta = base.filter(esPauta).length
  const agendadosPauta = base.filter(l => esPauta(l) && l.agendado_at).length
  const cerradosPauta = cerrados.filter(esPauta)
  const nCerradosPauta = cerradosPauta.length
  const ticketPauta = cerradosPauta.reduce((s, l) => s + Number(l.ticket_total || 0), 0)

  // Métricas de dinero — facturación de TODOS los canales
  const ticketTotalSum = cerrados.reduce((s, l) => s + Number(l.ticket_total || 0), 0)
  const cashCollected = cerrados.reduce((s, l) => s + Number(l.pago_llamada || 0), 0)
  const aov = nCerrados > 0 ? ticketTotalSum / nCerrados : 0
  // CPL, costo x agenda, CAC y ROAS: SOLO pauta (el gasto es solo de pauta)
  const cpl = totalPauta > 0 && gastoTotal > 0 ? gastoTotal / totalPauta : 0
  const costoPorAgenda = agendadosPauta > 0 && gastoTotal > 0 ? gastoTotal / agendadosPauta : 0
  const cac = nCerradosPauta > 0 && gastoTotal > 0 ? gastoTotal / nCerradosPauta : 0
  const roas = gastoTotal > 0 ? ticketPauta / gastoTotal : 0

  // Desglose de facturación por canal
  const factPorCanal = Object.keys(CANAL_LABEL).map(canal => ({
    canal,
    monto: cerrados.filter(l => (l.canal || 'pauta') === canal).reduce((s, l) => s + Number(l.ticket_total || 0), 0),
    n: cerrados.filter(l => (l.canal || 'pauta') === canal).length,
  })).filter(c => c.monto > 0)

  // Tasas
  const tasaContacto = total > 0 ? Math.round((contactados / total) * 100) : 0
  const showUpRate = agendados > 0 ? Math.round((presentados / agendados) * 100) : 0
  const tasaCierre = presentados > 0 ? Math.round((nCerrados / presentados) * 100) : 0

  function breakdown(field, labelMap) {
    const counts = {}
    base.forEach(l => { const k = l[field] || 'otro'; counts[k] = (counts[k] || 0) + 1 })
    return Object.entries(counts).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).filter(d => labelMap[d.key] || d.count > 0)
  }
  const porRol = breakdown('rol', ROL_LABEL)
  const porCom = breakdown('comisiones_mes', COM_LABEL)

  // Tabla filtrada
  const alFondo = e => e === 'descartado' || e === 'perdido'
  const filtered = baseConTrolls.filter(l => {
    const q = busqueda.toLowerCase()
    const matchQ = !q || l.nombre?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.pais?.toLowerCase().includes(q)
    const matchEstado = filtroEstado === 'all' || l.estado === filtroEstado
    return matchQ && matchEstado
  }).sort((a, b) => (alFondo(a.estado) ? 1 : 0) - (alFondo(b.estado) ? 1 : 0))

  async function guardarGasto() {
    const v = Number(gastoInput || 0)
    await supabase.from('config').update({ value: v, updated_at: new Date().toISOString() }).eq('key', 'gasto_captacion')
    setGastoCaptacion(v)
    setEditandoGasto(false)
  }

  if (loading) return <div className="loading-state">Cargando leads…</div>

  return (
    <div className="leads-view">
      {urgentes.length > 0 && (
        <div className="alerta-urgente">
          <span className="alerta-icon">⚡</span>
          <span><strong>{urgentes.length} lead{urgentes.length > 1 ? 's' : ''} calificado{urgentes.length > 1 ? 's' : ''}</strong> sin contactar hace más de 10 minutos</span>
          <div className="alerta-names">
            {urgentes.map(u => <span key={u.id} className="alerta-chip">{u.nombre} · {minutosDesde(u.created_at)}min</span>)}
          </div>
        </div>
      )}

      {/* Filtro por responsable */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="leads-persona-filter">
          {['all', ...RESPONSABLES].map(r => (
            <button key={r} className={`persona-btn ${filtroAsignado === r ? 'active' : ''}`} onClick={() => setFiltroAsignado(r)}>
              {r === 'all' ? 'Todos' : r}
            </button>
          ))}
        </div>
        <button className="btn-nuevo-lead" onClick={() => setNuevoLead(true)}>+ Nuevo lead</button>
      </div>

      {/* KPIs embudo */}
      <div className="kpi-row">
        <KpiCard label="Total leads" value={total} />
        <KpiCard label="Pendientes" value={pendientes} alert={pendientes > 0} sub={pendientes > 0 ? 'Sin contactar' : null} />
        <KpiCard label="Agendados" value={agendados} />
        <KpiCard label="Show up rate" value={`${showUpRate}%`} sub={`${presentados} de ${agendados}`} />
        <KpiCard label="Tasa de cierre" value={`${tasaCierre}%`} sub={`${nCerrados} de ${presentados}`} />
      </div>

      {/* KPIs dinero */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => { setGastoInput(String(gastoCaptacion)); setEditandoGasto(true) }}>
          {editandoGasto ? (
            <div onClick={e => e.stopPropagation()}>
              <input type="number" value={gastoInput} onChange={e => setGastoInput(e.target.value)} autoFocus
                style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', fontSize: 18, fontWeight: 700, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={guardarGasto} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', background: 'var(--green)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Guardar</button>
                <button onClick={() => setEditandoGasto(false)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="kpi-value">{money(gastoTotal)}</div>
              <div className="kpi-label">Gasto en ads ✎</div>
            </>
          )}
        </div>
        <KpiCard label="CPL" value={cpl ? money(cpl) : '—'} />
        <KpiCard label="Costo x agenda" value={costoPorAgenda ? money(costoPorAgenda) : '—'} />
        <KpiCard label="CAC" value={cac ? money(cac) : '—'} sub="por cliente" />
        <KpiCard label="AOV" value={aov ? money(aov) : '—'} sub="ticket promedio" />
        <KpiCard label="Cash collected" value={money(cashCollected)} accent />
      </div>

      <div className="leads-mid">
        <div className="leads-card">
          <div className="leads-card-title">Embudo</div>
          <Embudo leads={base} />
        </div>
        <div className="leads-card">
          <div className="leads-card-title">ROAS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>{roas ? roas.toFixed(1) + 'x' : '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Ticket cerrado / gasto en ads</div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Facturado (tickets)</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(ticketTotalSum)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cobrado (en llamada)</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(cashCollected)}</span></div>
            {factPorCanal.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Facturación por canal</div>
                {factPorCanal.map(c => (
                  <div key={c.canal} style={{ marginBottom: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: CANAL_COLOR[c.canal] }}>● {CANAL_LABEL[c.canal]} <span style={{ color: 'var(--muted)' }}>({c.n})</span></span>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(c.monto)}</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ticketTotalSum > 0 ? (c.monto / ticketTotalSum * 100) : 0}%`, background: CANAL_COLOR[c.canal], borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="leads-card">
          <div className="leads-card-title">Por rol</div>
          <MiniBar data={porRol} labelFn={k => ROL_LABEL[k] || k} />
        </div>
        <div className="leads-card">
          <div className="leads-card-title">Por comisiones</div>
          <MiniBar data={porCom} labelFn={k => COM_LABEL[k] || k} />
        </div>
      </div>

      {/* Tabla */}
      <div className="leads-card" style={{ marginTop: 16 }}>
        <div className="leads-table-header">
          <input className="leads-search" placeholder="Buscar por nombre, email o país…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div className="leads-filters">
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="all">Todos los estados</option>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Asignado</th>
                <th>País</th>
                <th>Rol</th>
                <th>Respuestas</th>
                <th>Estado</th>
                <th>Acción</th>
                <th>Cierre</th>
                <th>Canal</th>
                <th>Campaña</th>
                <th>Recibido</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Sin resultados</td></tr>
              )}
              {filtered.map(l => (
                <tr key={l.id} className={l.estado === 'descartado' || l.estado === 'perdido' ? 'lead-tachado' : ''}>
                  <td>
                    <div className="lead-nombre">{l.nombre} <NotaBtn lead={l} onUpdate={fetchLeads} /></div>
                    <div className="lead-email">{l.email}</div>
                    {l.notas && <div className="lead-nota-preview">{l.notas}</div>}
                    {l.whatsapp && <div className="lead-email">{l.whatsapp}</div>}
                  </td>
                  <td><AsignarBtn lead={l} onUpdate={fetchLeads} /></td>
                  <td style={{ fontSize: 12 }}>{l.pais || '—'}</td>
                  <td>{ROL_LABEL[l.rol] || l.rol || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    <div className="lead-resp">
                      <span title="Comisiones">{COM_LABEL[l.comisiones_mes] || l.comisiones_mes || '—'}</span>
                      <span title="Invierte" style={{ color: l.invierte === 'si' ? 'var(--green)' : l.invierte === 'no' ? '#ef5350' : 'var(--muted)' }}>{INV_LABEL[l.invierte] || l.invierte || '—'}</span>
                      {l.obstaculo && <span title="Obstáculo" style={{ color: 'var(--muted)' }}>{OBST_LABEL[l.obstaculo] || l.obstaculo}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`estado-badge ${ESTADO_CLS[l.estado] || 'estado-pendiente'}`}>{ESTADO_LABEL[l.estado] || 'Pendiente'}</span>
                    {l.motivo_descarte === 'troll' && <span className="tag-troll">troll</span>}
                    {!l.calificado && <div className="lead-motivo">{l.motivo_descalifica}</div>}
                  </td>
                  <td><AccionesFila lead={l} onUpdate={fetchLeads} onCerrar={() => setCerrarLead(l)} /></td>
                  <td>
                    {l.estado === 'cerrado' ? (
                      <div style={{ fontSize: 12 }}>
                        <div className="lead-nombre">{money(l.ticket_total)}</div>
                        <div className="lead-email">
                          {l.modalidad_pago === 'cuotas' ? `${l.cantidad_cuotas}x ${money(l.monto_cuota)}` : 'PIF'}
                          {l.pago_llamada ? ` · pagó ${money(l.pago_llamada)}` : ''}
                        </div>
                      </div>
                    ) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <span className="canal-badge" style={{ background: (CANAL_COLOR[l.canal || 'pauta'] || '#888') + '22', color: CANAL_COLOR[l.canal || 'pauta'] || '#888' }}>{CANAL_LABEL[l.canal || 'pauta'] || l.canal}</span>
                  </td>
                  <td>
                    {l.utm_campaign || l.utm_content ? (
                      <div>
                        {l.utm_campaign && <div className="lead-nombre">{l.utm_campaign}</div>}
                        {l.utm_content && <div className="lead-email">{l.utm_content}</div>}
                      </div>
                    ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l.origen || '—'}</span>}
                  </td>
                  <td className="lead-time">
                    {l.created_at ? new Date(l.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cerrarLead && <ModalCierre lead={cerrarLead} onClose={() => setCerrarLead(null)} onSaved={fetchLeads} />}
      {nuevoLead && <ModalNuevoLead onClose={() => setNuevoLead(false)} onSaved={fetchLeads} />}
    </div>
  )
}
