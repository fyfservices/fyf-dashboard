import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const ROL_LABEL = { dueno: 'Dueño', broker: 'Broker', agente: 'Agente', otro: 'Otro' }
const COM_LABEL = { menos_2k: '< $2K', '2k_5k': '$2K–5K', '5k_15k': '$5K–15K', mas_15k: '> $15K' }
const INV_LABEL = { si: 'Sí', no: 'No', tal_vez: 'Tal vez' }
const OBST_LABEL = { tiempo: 'Tiempo', dinero: 'Dinero', confianza: 'Confianza', tecnologia: 'Tecnología', otro: 'Otro' }
const ESTADO_LABEL = { pendiente: 'Pendiente', contactado: 'Contactado', agendado: 'Agendado', presento: 'Se presentó', no_show: 'No se presentó', seguimiento: 'En seguimiento', cerrado: 'Cerrado', perdido: 'Perdido', descartado: 'Descartado' }
const ESTADO_CLS = {
  pendiente: 'estado-pendiente', contactado: 'estado-contactado', agendado: 'estado-agendado',
  presento: 'estado-presento', no_show: 'estado-noshow', seguimiento: 'estado-seguimiento',
  cerrado: 'estado-cerrado', perdido: 'estado-perdido', descartado: 'estado-descartado',
}
const CONCEPTO_LABEL = { fee: 'Fee de compromiso', primera_cuota: '1ra cuota', pif: 'PIF' }
const RESPONSABLES = ['Fran', 'Feli']

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
function ModalCierre({ lead, onClose, onSaved }) {
  const [ticket, setTicket] = useState(lead.ticket_total || '')
  const [modalidad, setModalidad] = useState(lead.modalidad_pago || 'pif')
  const [cuotas, setCuotas] = useState(lead.cantidad_cuotas || '')
  const [pagoLlamada, setPagoLlamada] = useState(lead.pago_llamada || '')
  const [concepto, setConcepto] = useState(lead.concepto_pago || 'fee')
  const [saving, setSaving] = useState(false)

  const montoCuota = modalidad === 'cuotas' && cuotas > 0 ? (Number(ticket) / Number(cuotas)) : null
  const saldo = ticket ? Number(ticket) - Number(pagoLlamada || 0) : null

  async function guardar() {
    if (!ticket) { alert('Ingresá el ticket total'); return }
    setSaving(true)
    const updates = {
      estado: 'cerrado',
      cerrado: true,
      cerrado_at: new Date().toISOString(),
      ticket_total: Number(ticket),
      modalidad_pago: modalidad,
      cantidad_cuotas: modalidad === 'cuotas' ? Number(cuotas) : null,
      monto_cuota: montoCuota ? Math.round(montoCuota * 100) / 100 : null,
      pago_llamada: Number(pagoLlamada || 0),
      concepto_pago: concepto,
      saldo_pendiente: saldo,
    }
    await supabase.from('leads').update(updates).eq('id', lead.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3>Cerrar venta — {lead.nombre}</h3>
        <div className="form-field" style={{ marginBottom: 10 }}>
          <label>Ticket total (USD)</label>
          <input type="number" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="3000" />
        </div>
        <div className="form-field" style={{ marginBottom: 10 }}>
          <label>Modalidad de pago</label>
          <select value={modalidad} onChange={e => setModalidad(e.target.value)}>
            <option value="pif">PIF (pago completo)</option>
            <option value="cuotas">En cuotas</option>
          </select>
        </div>
        {modalidad === 'cuotas' && (
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <div className="form-field">
              <label>Cantidad de cuotas</label>
              <input type="number" value={cuotas} onChange={e => setCuotas(e.target.value)} placeholder="3" />
            </div>
            <div className="form-field">
              <label>Monto por cuota</label>
              <input value={montoCuota ? money(montoCuota) : '—'} disabled style={{ opacity: 0.7 }} />
            </div>
          </div>
        )}
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-field">
            <label>Pagó en la llamada</label>
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
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          Saldo pendiente: <strong style={{ color: 'var(--text)' }}>{saldo !== null ? money(saldo) : '—'}</strong>
        </div>
        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-save" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Registrar cierre'}</button>
        </div>
      </div>
    </div>
  )
}

// Botones de acción según estado
function AccionesFila({ lead, onUpdate, onCerrar }) {
  const [saving, setSaving] = useState(false)
  async function set(updates) {
    setSaving(true)
    await supabase.from('leads').update(updates).eq('id', lead.id)
    setSaving(false)
    onUpdate()
  }
  if (saving) return <span style={{ fontSize: 11, color: 'var(--muted)' }}>…</span>

  const e = lead.estado || 'pendiente'
  if (e === 'pendiente') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-contactar" onClick={() => set({ estado: 'contactado', contactado_at: new Date().toISOString() })}>Contactado</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'descartado' })}>Descartar</button>
    </div>
  )
  if (e === 'contactado') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-agendar" onClick={() => set({ estado: 'agendado', agendado_at: new Date().toISOString() })}>Agendado</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'descartado' })}>Descartar</button>
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
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'perdido' })}>Perdido</button>
    </div>
  )
  if (e === 'seguimiento') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-cerrar" onClick={onCerrar}>Cerrar venta</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'perdido' })}>Perdido</button>
    </div>
  )
  if (e === 'no_show') return (
    <div className="lead-acciones">
      <button className="btn-accion btn-agendar" onClick={() => set({ estado: 'agendado' })}>Reagendar</button>
      <button className="btn-accion btn-descartar" onClick={() => set({ estado: 'perdido' })}>Perdido</button>
    </div>
  )
  if (e === 'cerrado') return <span style={{ fontSize: 11, color: '#4caf50' }}>✓ Cliente</span>
  if (e === 'perdido' || e === 'descartado') return (
    <button className="btn-accion btn-contactar" onClick={() => set({ estado: 'pendiente' })}>Reabrir</button>
  )
  return null
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

  const fetchLeads = useCallback(async () => {
    const [{ data: ld }, { data: cfg }] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('config').select('*').eq('key', 'gasto_captacion').single(),
    ])
    if (ld) {
      setLeads(ld)
      setUrgentes(ld.filter(l => l.calificado && !l.contactado_at && l.estado !== 'descartado' && l.estado !== 'cerrado' && l.estado !== 'perdido' && minutosDesde(l.created_at) >= 10))
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
  const base = filtroAsignado === 'all' ? leads : leads.filter(l => l.asignado_a === filtroAsignado)

  // Conteos del embudo
  const total = base.length
  const calificados = base.filter(l => l.calificado).length
  const contactados = base.filter(l => l.contactado_at).length
  const agendados = base.filter(l => l.agendado_at).length
  const presentados = base.filter(l => l.se_presento === true).length
  const cerrados = base.filter(l => l.estado === 'cerrado')
  const nCerrados = cerrados.length
  const pendientes = base.filter(l => l.calificado && !l.contactado_at && l.estado !== 'descartado' && l.estado !== 'perdido').length

  // Gasto de la campaña de captación (manual desde config)
  const gastoTotal = gastoCaptacion

  // Métricas de dinero
  const ticketTotalSum = cerrados.reduce((s, l) => s + Number(l.ticket_total || 0), 0)
  const cashCollected = cerrados.reduce((s, l) => s + Number(l.pago_llamada || 0), 0)
  const aov = nCerrados > 0 ? ticketTotalSum / nCerrados : 0
  const cpl = total > 0 && gastoTotal > 0 ? gastoTotal / total : 0
  const costoPorAgenda = agendados > 0 && gastoTotal > 0 ? gastoTotal / agendados : 0
  const cac = nCerrados > 0 && gastoTotal > 0 ? gastoTotal / nCerrados : 0
  const roas = gastoTotal > 0 ? ticketTotalSum / gastoTotal : 0

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
  const filtered = base.filter(l => {
    const q = busqueda.toLowerCase()
    const matchQ = !q || l.nombre?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.pais?.toLowerCase().includes(q)
    const matchEstado = filtroEstado === 'all' || l.estado === filtroEstado
    return matchQ && matchEstado
  })

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
      <div className="leads-persona-filter">
        {['all', ...RESPONSABLES].map(r => (
          <button key={r} className={`persona-btn ${filtroAsignado === r ? 'active' : ''}`} onClick={() => setFiltroAsignado(r)}>
            {r === 'all' ? 'Todos' : r}
          </button>
        ))}
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
                <th>Rol</th>
                <th>Estado</th>
                <th>Acción</th>
                <th>Cierre</th>
                <th>Campaña</th>
                <th>Recibido</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Sin resultados</td></tr>
              )}
              {filtered.map(l => (
                <tr key={l.id}>
                  <td>
                    <div className="lead-nombre">{l.nombre}</div>
                    <div className="lead-email">{l.email}</div>
                    {l.whatsapp && <div className="lead-email">{l.whatsapp}</div>}
                  </td>
                  <td><AsignarBtn lead={l} onUpdate={fetchLeads} /></td>
                  <td>{ROL_LABEL[l.rol] || l.rol || '—'}</td>
                  <td>
                    <span className={`estado-badge ${ESTADO_CLS[l.estado] || 'estado-pendiente'}`}>{ESTADO_LABEL[l.estado] || 'Pendiente'}</span>
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
    </div>
  )
}
