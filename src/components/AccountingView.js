import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CAT_LABEL = { staff: 'Staff', softwares: 'Softwares', others: 'Others' }
const CAT_COLOR = { staff: '#5B9BD5', softwares: '#F5C842', others: '#9B7FE8' }
const MEDIOS = ['Stripe', 'Transferencia', 'Pesos', 'Efectivo', 'Otro']

function money(n) {
  if (n === null || n === undefined || n === '') return '$0'
  return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}
function ym(fecha) { return fecha ? fecha.slice(0, 7) : '' }

export default function AccountingView() {
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth()) // 0-11
  const [showIng, setShowIng] = useState(false)
  const [showGas, setShowGas] = useState(false)
  const [formIng, setFormIng] = useState({ fecha: '', concepto: '', cliente: '', monto_bruto: '', medio_pago: 'Stripe', comision_pct: '4.4', nota: '' })
  const [formGas, setFormGas] = useState({ fecha: '', categoria: 'staff', concepto: '', monto: '', recurrente: false, nota: '' })

  const fetchAll = useCallback(async () => {
    const [{ data: ing }, { data: gas }] = await Promise.all([
      supabase.from('ingresos').select('*').order('fecha', { ascending: false }),
      supabase.from('gastos').select('*').order('fecha', { ascending: false }),
    ])
    setIngresos(ing || [])
    setGastos(gas || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const mesStr = `${anio}-${String(mes + 1).padStart(2, '0')}`

  // Filtrar por mes seleccionado
  const ingMes = ingresos.filter(i => ym(i.fecha) === mesStr)
  const gasMes = gastos.filter(g => ym(g.fecha) === mesStr)

  // Totales del mes
  const revenue = ingMes.reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0)
  const revenueBruto = ingMes.reduce((s, i) => s + Number(i.monto_bruto ?? 0), 0)
  const expenses = gasMes.reduce((s, g) => s + Number(g.monto ?? 0), 0)
  const netCashFlow = revenue - expenses
  const margen = revenue > 0 ? Math.round((netCashFlow / revenue) * 100) : 0

  // Opening balance = suma de net cash flow de todos los meses anteriores
  function netFlowHasta(targetYm) {
    const revAll = ingresos.filter(i => ym(i.fecha) < targetYm).reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0)
    const gasAll = gastos.filter(g => ym(g.fecha) < targetYm).reduce((s, g) => s + Number(g.monto ?? 0), 0)
    return revAll - gasAll
  }
  const openingBalance = netFlowHasta(mesStr)
  const closingBalance = openingBalance + netCashFlow

  // Gastos por categoría
  const gastosPorCat = ['staff', 'softwares', 'others'].map(cat => ({
    cat,
    total: gasMes.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto || 0), 0),
    items: gasMes.filter(g => g.categoria === cat),
  }))

  // Serie para gráfico: últimos 6 meses
  const serie = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date(anio, mes - k, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rev = ingresos.filter(i => ym(i.fecha) === key).reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0)
    const gas = gastos.filter(g => ym(g.fecha) === key).reduce((s, g) => s + Number(g.monto || 0), 0)
    serie.push({ label: MESES[d.getMonth()].slice(0, 3), rev, gas })
  }
  const maxSerie = Math.max(...serie.map(s => Math.max(s.rev, s.gas)), 1)

  // Guardar ingreso
  async function saveIngreso() {
    if (!formIng.concepto || !formIng.monto_bruto || !formIng.fecha) { alert('Completá fecha, concepto y monto'); return }
    const bruto = Number(formIng.monto_bruto)
    const com = Number(formIng.comision_pct || 0)
    const neto = bruto - (bruto * com / 100)
    await supabase.from('ingresos').insert({
      fecha: formIng.fecha, concepto: formIng.concepto, cliente: formIng.cliente || null,
      monto_bruto: bruto, medio_pago: formIng.medio_pago, comision_pct: com,
      monto_neto: Math.round(neto * 100) / 100, nota: formIng.nota || null, origen: 'manual',
    })
    setFormIng({ fecha: '', concepto: '', cliente: '', monto_bruto: '', medio_pago: 'Stripe', comision_pct: '4.4', nota: '' })
    setShowIng(false)
    fetchAll()
  }

  // Guardar gasto
  async function saveGasto() {
    if (!formGas.concepto || !formGas.monto || !formGas.fecha) { alert('Completá fecha, concepto y monto'); return }
    await supabase.from('gastos').insert({
      fecha: formGas.fecha, categoria: formGas.categoria, concepto: formGas.concepto,
      monto: Number(formGas.monto), recurrente: formGas.recurrente, nota: formGas.nota || null,
    })
    setFormGas({ fecha: '', categoria: 'staff', concepto: '', monto: '', recurrente: false, nota: '' })
    setShowGas(false)
    fetchAll()
  }

  async function delIngreso(id) { await supabase.from('ingresos').delete().eq('id', id); fetchAll() }
  async function delGasto(id) { await supabase.from('gastos').delete().eq('id', id); fetchAll() }

  if (loading) return <div className="loading-state">Cargando contabilidad…</div>

  return (
    <div className="acc-view">
      {/* Header con selector de mes */}
      <div className="acc-header">
        <div>
          <h2 className="acc-title">Contabilidad</h2>
          <div className="acc-sub">Balance del negocio · {MESES[mes]} {anio}</div>
        </div>
        <div className="acc-month-nav">
          <button onClick={() => { if (mes === 0) { setMes(11); setAnio(anio - 1) } else setMes(mes - 1) }}>‹</button>
          <span>{MESES[mes]} {anio}</span>
          <button onClick={() => { if (mes === 11) { setMes(0); setAnio(anio + 1) } else setMes(mes + 1) }}>›</button>
        </div>
      </div>

      {/* Tarjetas de balance */}
      <div className="acc-kpis">
        <div className="acc-kpi"><div className="acc-kpi-lbl">Opening Balance</div><div className="acc-kpi-val">{money(openingBalance)}</div></div>
        <div className="acc-kpi"><div className="acc-kpi-lbl">Revenue</div><div className="acc-kpi-val" style={{ color: 'var(--green)' }}>{money(revenue)}</div></div>
        <div className="acc-kpi"><div className="acc-kpi-lbl">Expenses</div><div className="acc-kpi-val" style={{ color: '#ef5350' }}>{money(expenses)}</div></div>
        <div className="acc-kpi"><div className="acc-kpi-lbl">Net Cash Flow</div><div className="acc-kpi-val" style={{ color: netCashFlow >= 0 ? 'var(--green)' : '#ef5350' }}>{money(netCashFlow)}</div><div className="acc-kpi-sub">{margen}% margen</div></div>
        <div className="acc-kpi acc-kpi-hl"><div className="acc-kpi-lbl">Closing Balance</div><div className="acc-kpi-val">{money(closingBalance)}</div></div>
      </div>

      {/* Gráfico evolución */}
      <div className="acc-card" style={{ marginBottom: 16 }}>
        <div className="acc-card-title">Evolución (últimos 6 meses)</div>
        <div className="acc-chart">
          {serie.map((s, i) => (
            <div key={i} className="acc-bar-group">
              <div className="acc-bars">
                <div className="acc-bar" style={{ height: `${(s.rev / maxSerie) * 100}%`, background: 'var(--green)' }} title={`Revenue: ${money(s.rev)}`} />
                <div className="acc-bar" style={{ height: `${(s.gas / maxSerie) * 100}%`, background: '#ef5350' }} title={`Expenses: ${money(s.gas)}`} />
              </div>
              <div className="acc-bar-lbl">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="acc-legend">
          <span><span className="acc-dot" style={{ background: 'var(--green)' }} />Revenue</span>
          <span><span className="acc-dot" style={{ background: '#ef5350' }} />Expenses</span>
        </div>
      </div>

      {/* Ingresos y Gastos lado a lado */}
      <div className="acc-cols">
        {/* INGRESOS */}
        <div className="acc-card">
          <div className="acc-card-head">
            <div className="acc-card-title">Ingresos · {money(revenue)}</div>
            <button className="acc-add" onClick={() => { setFormIng({ ...formIng, fecha: `${mesStr}-01` }); setShowIng(!showIng) }}>+ Ingreso</button>
          </div>
          {showIng && (
            <div className="acc-form">
              <div className="acc-form-row">
                <input type="date" value={formIng.fecha} onChange={e => setFormIng({ ...formIng, fecha: e.target.value })} />
                <input placeholder="Concepto" value={formIng.concepto} onChange={e => setFormIng({ ...formIng, concepto: e.target.value })} />
              </div>
              <div className="acc-form-row">
                <input placeholder="Cliente" value={formIng.cliente} onChange={e => setFormIng({ ...formIng, cliente: e.target.value })} />
                <input type="number" placeholder="Monto bruto USD" value={formIng.monto_bruto} onChange={e => setFormIng({ ...formIng, monto_bruto: e.target.value })} />
              </div>
              <div className="acc-form-row">
                <select value={formIng.medio_pago} onChange={e => setFormIng({ ...formIng, medio_pago: e.target.value })}>
                  {MEDIOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="number" placeholder="% comisión" value={formIng.comision_pct} onChange={e => setFormIng({ ...formIng, comision_pct: e.target.value })} />
              </div>
              <input placeholder="Nota (ej: pagó en pesos, TC 1450)" value={formIng.nota} onChange={e => setFormIng({ ...formIng, nota: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
              {formIng.monto_bruto && (
                <div className="acc-neto-preview">Neto: {money(Number(formIng.monto_bruto) - Number(formIng.monto_bruto) * Number(formIng.comision_pct || 0) / 100)}</div>
              )}
              <div className="acc-form-actions">
                <button className="btn-cancel" onClick={() => setShowIng(false)}>Cancelar</button>
                <button className="btn-save" onClick={saveIngreso}>Guardar</button>
              </div>
            </div>
          )}
          <div className="acc-list">
            {ingMes.length === 0 && <div className="acc-empty">Sin ingresos este mes</div>}
            {ingMes.map(i => (
              <div key={i.id} className="acc-item">
                <div className="acc-item-main">
                  <div className="acc-item-concepto">{i.concepto}{i.origen === 'crm' && <span className="acc-tag-crm">CRM</span>}</div>
                  <div className="acc-item-sub">
                    {i.cliente ? i.cliente + ' · ' : ''}{i.fecha?.slice(8, 10)}/{i.fecha?.slice(5, 7)}
                    {i.medio_pago ? ' · ' + i.medio_pago : ''}
                    {i.comision_pct > 0 ? ` · ${i.comision_pct}% com` : ''}
                  </div>
                  {i.nota && <div className="acc-item-nota">{i.nota}</div>}
                </div>
                <div className="acc-item-monto">
                  <div style={{ color: 'var(--green)' }}>{money(i.monto_neto ?? i.monto_bruto)}</div>
                  {i.comision_pct > 0 && <div className="acc-item-bruto">bruto {money(i.monto_bruto)}</div>}
                </div>
                <button className="acc-del" onClick={() => delIngreso(i.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* GASTOS */}
        <div className="acc-card">
          <div className="acc-card-head">
            <div className="acc-card-title">Gastos · {money(expenses)}</div>
            <button className="acc-add" onClick={() => { setFormGas({ ...formGas, fecha: `${mesStr}-01` }); setShowGas(!showGas) }}>+ Gasto</button>
          </div>
          {showGas && (
            <div className="acc-form">
              <div className="acc-form-row">
                <input type="date" value={formGas.fecha} onChange={e => setFormGas({ ...formGas, fecha: e.target.value })} />
                <select value={formGas.categoria} onChange={e => setFormGas({ ...formGas, categoria: e.target.value })}>
                  {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="acc-form-row">
                <input placeholder="Concepto" value={formGas.concepto} onChange={e => setFormGas({ ...formGas, concepto: e.target.value })} />
                <input type="number" placeholder="Monto USD" value={formGas.monto} onChange={e => setFormGas({ ...formGas, monto: e.target.value })} />
              </div>
              <label className="acc-check"><input type="checkbox" checked={formGas.recurrente} onChange={e => setFormGas({ ...formGas, recurrente: e.target.checked })} /> Gasto recurrente (se repite cada mes)</label>
              <div className="acc-form-actions">
                <button className="btn-cancel" onClick={() => setShowGas(false)}>Cancelar</button>
                <button className="btn-save" onClick={saveGasto}>Guardar</button>
              </div>
            </div>
          )}
          <div className="acc-list">
            {gasMes.length === 0 && <div className="acc-empty">Sin gastos este mes</div>}
            {gastosPorCat.map(({ cat, total, items }) => items.length > 0 && (
              <div key={cat} className="acc-cat-group">
                <div className="acc-cat-head"><span style={{ color: CAT_COLOR[cat] }}>● {CAT_LABEL[cat]}</span><span>{money(total)}</span></div>
                {items.map(g => (
                  <div key={g.id} className="acc-item">
                    <div className="acc-item-main">
                      <div className="acc-item-concepto">{g.concepto}{g.recurrente && <span className="acc-tag-rec">rec</span>}</div>
                      <div className="acc-item-sub">{g.fecha?.slice(8, 10)}/{g.fecha?.slice(5, 7)}</div>
                    </div>
                    <div className="acc-item-monto"><div style={{ color: '#ef5350' }}>{money(g.monto)}</div></div>
                    <button className="acc-del" onClick={() => delGasto(g.id)}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
