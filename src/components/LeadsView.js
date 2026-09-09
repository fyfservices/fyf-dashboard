import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const ROL_LABEL = { dueno: 'Dueño', broker: 'Broker', agente: 'Agente', otro: 'Otro' }
const COM_LABEL = { menos_2k: '< $2K', '2k_5k': '$2K–5K', '5k_15k': '$5K–15K', mas_15k: '> $15K' }
const INV_LABEL = { si: 'Sí', no: 'No', tal_vez: 'Tal vez' }
const OBST_LABEL = {
  tiempo: 'Tiempo',
  dinero: 'Dinero',
  confianza: 'Confianza',
  tecnologia: 'Tecnología',
  otro: 'Otro',
}
const ESTADO_LABEL = { pendiente: 'Pendiente', contactado: 'Contactado', agendado: 'Agendado', cerrado: 'Cerrado', descartado: 'Descartado' }
const ESTADO_CLS = {
  pendiente: 'estado-pendiente',
  contactado: 'estado-contactado',
  agendado: 'estado-agendado',
  cerrado: 'estado-cerrado',
  descartado: 'estado-descartado',
}

function minutosDesde(fechaStr) {
  if (!fechaStr) return null
  return Math.floor((Date.now() - new Date(fechaStr).getTime()) / 60000)
}

function KpiCard({ label, value, sub, alert }) {
  return (
    <div className={`kpi-card${alert ? ' kpi-alert' : ''}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function MiniBar({ data, labelFn, colorFn }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="mini-bar-list">
      {data.map(d => (
        <div key={d.key} className="mini-bar-row">
          <span className="mini-bar-label">{labelFn(d.key)}</span>
          <div className="mini-bar-track">
            <div
              className="mini-bar-fill"
              style={{ width: `${(d.count / max) * 100}%`, background: colorFn ? colorFn(d.key) : 'var(--accent)' }}
            />
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
    { key: 'cerrado', label: 'Cerrados', count: leads.filter(l => l.cerrado).length },
  ]
  const max = etapas[0].count || 1
  return (
    <div className="embudo">
      {etapas.map((e, i) => {
        const pct = Math.round((e.count / max) * 100)
        const conv = i > 0 && etapas[i - 1].count > 0
          ? Math.round((e.count / etapas[i - 1].count) * 100)
          : null
        return (
          <div key={e.key} className="embudo-step">
            <div className="embudo-bar-wrap">
              <div className="embudo-bar" style={{ width: `${pct}%` }} />
            </div>
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

export default function LeadsView() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('all')
  const [filtroCalif, setFiltroCalif] = useState('all')
  const [urgentes, setUrgentes] = useState([])

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setLeads(data)
      setUrgentes(data.filter(l => l.calificado && !l.contactado_at && minutosDesde(l.created_at) >= 10))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
    const interval = setInterval(fetchLeads, 60000)
    return () => clearInterval(interval)
  }, [fetchLeads])

  // KPIs
  const total = leads.length
  const pendientes = leads.filter(l => l.calificado && !l.contactado_at).length
  const contactados = leads.filter(l => l.contactado_at).length
  const tasaContacto = total > 0 ? Math.round((contactados / total) * 100) : 0

  // Breakdowns
  function breakdown(field, labelMap) {
    const counts = {}
    leads.forEach(l => {
      const k = l[field] || 'otro'
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .filter(d => labelMap[d.key] || d.count > 0)
  }

  const porRol = breakdown('rol', ROL_LABEL)
  const porCom = breakdown('comisiones_mes', COM_LABEL)
  const porInv = breakdown('invierte', INV_LABEL)
  const porObst = breakdown('obstaculo', OBST_LABEL)

  // Tabla filtrada
  const filtered = leads.filter(l => {
    const q = busqueda.toLowerCase()
    const matchQ = !q || l.nombre?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.pais?.toLowerCase().includes(q)
    const matchEstado = filtroEstado === 'all' || l.estado === filtroEstado
    const matchCalif = filtroCalif === 'all' || (filtroCalif === 'si' ? l.calificado : !l.calificado)
    return matchQ && matchEstado && matchCalif
  })

  if (loading) return <div className="loading-state">Cargando leads…</div>

  return (
    <div className="leads-view">
      {/* ALERTA */}
      {urgentes.length > 0 && (
        <div className="alerta-urgente">
          <span className="alerta-icon">⚡</span>
          <span>
            <strong>{urgentes.length} lead{urgentes.length > 1 ? 's' : ''} calificado{urgentes.length > 1 ? 's' : ''}</strong>
            {' '}sin contactar hace más de 10 minutos
          </span>
          <div className="alerta-names">
            {urgentes.map(u => (
              <span key={u.id} className="alerta-chip">
                {u.nombre} · {minutosDesde(u.created_at)}min
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-row">
        <KpiCard label="Total leads" value={total} />
        <KpiCard label="Pendientes" value={pendientes} alert={pendientes > 0} sub={pendientes > 0 ? 'Sin contactar' : null} />
        <KpiCard label="Contactados" value={contactados} />
        <KpiCard label="Tasa de contacto" value={`${tasaContacto}%`} />
      </div>

      {/* EMBUDO + BREAKDOWNS */}
      <div className="leads-mid">
        <div className="leads-card">
          <div className="leads-card-title">Embudo</div>
          <Embudo leads={leads} />
        </div>

        <div className="leads-card">
          <div className="leads-card-title">Por rol</div>
          <MiniBar data={porRol} labelFn={k => ROL_LABEL[k] || k} />
        </div>

        <div className="leads-card">
          <div className="leads-card-title">Por comisiones</div>
          <MiniBar data={porCom} labelFn={k => COM_LABEL[k] || k} />
        </div>

        <div className="leads-card">
          <div className="leads-card-title">Inversión / Obstáculo</div>
          <MiniBar data={porInv} labelFn={k => INV_LABEL[k] || k} />
          <div style={{ marginTop: 12 }}>
            <MiniBar data={porObst} labelFn={k => OBST_LABEL[k] || k} />
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="leads-card" style={{ marginTop: 16 }}>
        <div className="leads-table-header">
          <input
            className="leads-search"
            placeholder="Buscar por nombre, email o país…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <div className="leads-filters">
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="all">Todos los estados</option>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filtroCalif} onChange={e => setFiltroCalif(e.target.value)}>
              <option value="all">Todos</option>
              <option value="si">Calificados</option>
              <option value="no">Descalificados</option>
            </select>
          </div>
        </div>

        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>País</th>
                <th>Rol</th>
                <th>Comisiones</th>
                <th>Invierte</th>
                <th>Calificado</th>
                <th>Estado</th>
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
                  </td>
                  <td>{l.pais || '—'}</td>
                  <td>{ROL_LABEL[l.rol] || l.rol || '—'}</td>
                  <td>{COM_LABEL[l.comisiones_mes] || l.comisiones_mes || '—'}</td>
                  <td>{INV_LABEL[l.invierte] || l.invierte || '—'}</td>
                  <td>
                    <span className={`calif-badge ${l.calificado ? 'calif-si' : 'calif-no'}`}>
                      {l.calificado ? '✓ Sí' : '✗ No'}
                    </span>
                    {!l.calificado && l.motivo_descalifica && (
                      <div className="lead-motivo">{l.motivo_descalifica}</div>
                    )}
                  </td>
                  <td>
                    <span className={`estado-badge ${ESTADO_CLS[l.estado] || ''}`}>
                      {ESTADO_LABEL[l.estado] || l.estado || 'pendiente'}
                    </span>
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
    </div>
  )
}
