import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const CAT_LABEL = { staff: 'Staff', softwares: 'Softwares', others: 'Others', inversiones: 'Inversiones' }
const CAT_COLOR = { staff: '#5B9BD5', softwares: '#F5C842', others: '#9B7FE8', inversiones: '#26C6DA' }
const MEDIOS = ['Stripe', 'Transferencia', 'Crypto', 'Pesos', 'Efectivo', 'Otro']

function money(n) {
  if (n === null || n === undefined || n === '') return '$0'
  return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}
function ym(fecha) { return fecha ? fecha.slice(0, 7) : '' }
function netoIngreso(i) {
  // neto = bruto - comisión pasarela (el monto_neto ya viene calculado, pero recalculamos por si acaso)
  return Number(i.monto_neto ?? i.monto_bruto ?? 0)
}

export default function AccountingView() {
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth())
  const [vista, setVista] = useState('mensual')
  const [showIng, setShowIng] = useState(false)
  const [showGas, setShowGas] = useState(false)
  const [editIngId, setEditIngId] = useState(null)
  const [editGasId, setEditGasId] = useState(null)
  const emptyIng = { fecha: '', concepto: '', cliente: '', monto_bruto: '', medio_pago: 'Stripe', comision_pct: '4.4', nota: '', cobrado: true, pago_inicial: '' }
  const emptyGas = { fecha: '', categoria: 'staff', concepto: '', monto: '', recurrente: false, nota: '', cobrado: true }
  const [formIng, setFormIng] = useState(emptyIng)
  const [ingModo, setIngModo] = useState('unico') // 'unico' | 'cuotas'
  const [ingCuotas, setIngCuotas] = useState([]) // [{monto, fecha}]
  const [formGas, setFormGas] = useState(emptyGas)

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
  const ingMes = ingresos.filter(i => ym(i.fecha) === mesStr).sort((a,b) => (b.cobrado?1:0) - (a.cobrado?1:0))
  const gasMes = gastos.filter(g => ym(g.fecha) === mesStr)

  // Totales — separando cobrado (real) de previsto
  const revenueReal = ingMes.filter(i => i.cobrado).reduce((s, i) => s + netoIngreso(i), 0)
  const revenuePrev = ingMes.filter(i => !i.cobrado).reduce((s, i) => s + netoIngreso(i), 0)
  const expensesReal = gasMes.filter(g => g.cobrado).reduce((s, g) => s + Number(g.monto || 0), 0)
  const expensesPrev = gasMes.filter(g => !g.cobrado).reduce((s, g) => s + Number(g.monto || 0), 0)
  const inversionesReal = gasMes.filter(g => g.categoria === 'inversiones' && g.cobrado).reduce((s, g) => s + Number(g.monto || 0), 0)
  const netCashFlow = revenueReal - expensesReal
  const margen = revenueReal > 0 ? Math.round((netCashFlow / revenueReal) * 100) : 0

  // Opening balance = net flow real acumulado de meses anteriores
  function netFlowHasta(targetYm) {
    const rev = ingresos.filter(i => i.cobrado && ym(i.fecha) < targetYm).reduce((s, i) => s + netoIngreso(i), 0)
    const gas = gastos.filter(g => g.cobrado && ym(g.fecha) < targetYm).reduce((s, g) => s + Number(g.monto || 0), 0)
    return rev - gas
  }
  const openingBalance = netFlowHasta(mesStr)
  const closingBalance = openingBalance + netCashFlow

  const gastosPorCat = ['staff', 'softwares', 'others'].map(cat => ({
    cat,
    total: gasMes.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto || 0), 0),
    items: gasMes.filter(g => g.categoria === cat).sort((a,b) => (b.cobrado?1:0) - (a.cobrado?1:0)),
  }))
  const inversionesMes = gasMes.filter(g => g.categoria === 'inversiones').sort((a,b) => (b.cobrado?1:0) - (a.cobrado?1:0))

  // Serie gráfico últimos 6 meses (solo cobrado)
  const serie = []
  for (let k = 5; k >= 0; k--) {
    const d = new Date(anio, mes - k, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rev = ingresos.filter(i => i.cobrado && ym(i.fecha) === key).reduce((s, i) => s + netoIngreso(i), 0)
    const gas = gastos.filter(g => g.cobrado && ym(g.fecha) === key).reduce((s, g) => s + Number(g.monto || 0), 0)
    serie.push({ label: MESES[d.getMonth()].slice(0, 3), rev, gas })
  }
  const maxSerie = Math.max(...serie.map(s => Math.max(s.rev, s.gas)), 1)

  // Guardar ingreso (nuevo o edición)
  // Generar N cuotas mensuales desde la fecha del form
  function generarIngCuotas(n) {
    const total = Number(formIng.monto_bruto || 0)
    const pagoInicial = Number(formIng.pago_inicial || 0)
    const saldo = total - pagoInicial
    if (saldo <= 0 || n <= 0) { setIngCuotas([]); return }
    const montoC = Math.round((saldo / n) * 100) / 100
    const base = new Date(formIng.fecha || `${mesStr}-01`)
    const arr = []
    for (let i = 1; i <= n; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate())
      arr.push({ monto: montoC, fecha: d.toISOString().slice(0, 10) })
    }
    setIngCuotas(arr)
  }
  function updateIngCuota(idx, campo, val) {
    setIngCuotas(ingCuotas.map((c, i) => i === idx ? { ...c, [campo]: val } : c))
  }

  async function saveIngreso() {
    if (!formIng.concepto || !formIng.monto_bruto || !formIng.fecha) { alert('Completá fecha, concepto y monto'); return }
    const com = Number(formIng.comision_pct || 0)
    const neto = v => Math.round((v - v * com / 100) * 100) / 100

    // MODO ÚNICO (o edición): un solo ingreso, como siempre
    if (ingModo === 'unico' || editIngId) {
      const bruto = Number(formIng.monto_bruto)
      const payload = {
        fecha: formIng.fecha, concepto: formIng.concepto, cliente: formIng.cliente || null,
        monto_bruto: bruto, medio_pago: formIng.medio_pago, comision_pct: com,
        monto_neto: neto(bruto), nota: formIng.nota || null, cobrado: formIng.cobrado,
      }
      if (editIngId) await supabase.from('ingresos').update(payload).eq('id', editIngId)
      else await supabase.from('ingresos').insert({ ...payload, origen: 'manual' })
    } else {
      // MODO CUOTAS: pago inicial (cobrado) + cuotas previstas
      if (ingCuotas.length === 0) { alert('Generá las cuotas primero'); return }
      const pagoInicial = Number(formIng.pago_inicial || 0)
      const aCrear = []
      if (pagoInicial > 0) {
        aCrear.push({
          fecha: formIng.fecha, concepto: `${formIng.concepto} — pago inicial`, cliente: formIng.cliente || null,
          monto_bruto: pagoInicial, monto_neto: neto(pagoInicial), medio_pago: formIng.medio_pago,
          comision_pct: com, nota: formIng.nota || null, cobrado: true, origen: 'manual',
        })
      }
      ingCuotas.forEach((c, i) => {
        aCrear.push({
          fecha: c.fecha, concepto: `${formIng.concepto} — cuota ${i + 1}/${ingCuotas.length}`, cliente: formIng.cliente || null,
          monto_bruto: Number(c.monto), monto_neto: neto(Number(c.monto)), medio_pago: formIng.medio_pago,
          comision_pct: com, cobrado: false, origen: 'manual',
        })
      })
      await supabase.from('ingresos').insert(aCrear)
    }
    setFormIng(emptyIng); setShowIng(false); setEditIngId(null); setIngModo('unico'); setIngCuotas([])
    fetchAll()
  }

  async function saveGasto() {
    if (!formGas.concepto || !formGas.monto || !formGas.fecha) { alert('Completá fecha, concepto y monto'); return }
    const payload = {
      fecha: formGas.fecha, categoria: formGas.categoria, concepto: formGas.concepto,
      monto: Number(formGas.monto), recurrente: formGas.recurrente, nota: formGas.nota || null, cobrado: formGas.cobrado,
    }
    if (editGasId) await supabase.from('gastos').update(payload).eq('id', editGasId)
    else await supabase.from('gastos').insert(payload)
    setFormGas(emptyGas); setShowGas(false); setEditGasId(null)
    fetchAll()
  }

  function editarIngreso(i) {
    setEditIngId(i.id)
    setFormIng({ fecha: i.fecha, concepto: i.concepto, cliente: i.cliente || '', monto_bruto: String(i.monto_bruto), medio_pago: i.medio_pago || 'Stripe', comision_pct: String(i.comision_pct || 0), nota: i.nota || '', cobrado: i.cobrado })
    setShowIng(true)
  }
  function editarGasto(g) {
    setEditGasId(g.id)
    setFormGas({ fecha: g.fecha, categoria: g.categoria, concepto: g.concepto, monto: String(g.monto), recurrente: g.recurrente, nota: g.nota || '', cobrado: g.cobrado })
    setShowGas(true)
  }

  async function toggleCobradoIng(i) { await supabase.from('ingresos').update({ cobrado: !i.cobrado }).eq('id', i.id); fetchAll() }
  async function toggleCobradoGas(g) { await supabase.from('gastos').update({ cobrado: !g.cobrado }).eq('id', g.id); fetchAll() }
  async function delIngreso(id) { await supabase.from('ingresos').delete().eq('id', id); fetchAll() }
  async function delGasto(id) { await supabase.from('gastos').delete().eq('id', id); fetchAll() }

  // Replicar recurrentes al mes actual
  async function replicarRecurrentes() {
    const recurrentes = gastos.filter(g => g.recurrente)
    // Tomar la última versión de cada concepto recurrente
    const porConcepto = {}
    recurrentes.forEach(g => {
      if (!porConcepto[g.concepto] || g.fecha > porConcepto[g.concepto].fecha) porConcepto[g.concepto] = g
    })
    // Filtrar los que NO existan ya este mes
    const yaEste = new Set(gasMes.map(g => g.concepto))
    const aInsertar = Object.values(porConcepto).filter(g => !yaEste.has(g.concepto)).map(g => ({
      fecha: `${mesStr}-01`, categoria: g.categoria, concepto: g.concepto, monto: g.monto, recurrente: true, nota: g.nota, cobrado: false,
    }))
    if (aInsertar.length === 0) { alert('No hay recurrentes nuevos para agregar este mes'); return }
    await supabase.from('gastos').insert(aInsertar)
    fetchAll()
  }

  // Datos anuales — totales de cada mes del año seleccionado
  function totalesMes(y, m) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const ing = ingresos.filter(i => ym(i.fecha) === key)
    const gas = gastos.filter(g => ym(g.fecha) === key)
    const rev = ing.filter(i => i.cobrado).reduce((a, i) => a + netoIngreso(i), 0)
    const revPrev = ing.filter(i => !i.cobrado).reduce((a, i) => a + netoIngreso(i), 0)
    const exp = gas.filter(g => g.cobrado).reduce((a, g) => a + Number(g.monto || 0), 0)
    const inv = gas.filter(g => g.categoria === 'inversiones' && g.cobrado).reduce((a, g) => a + Number(g.monto || 0), 0)
    return { rev, revPrev, exp, inv, ncf: rev - exp }
  }
  const anioData = MESES.map((_, m) => ({ mes: m, ...totalesMes(anio, m) }))
  let acumAnual = 0
  const anioConBalance = anioData.map(d => { acumAnual += d.ncf; return { ...d, closing: acumAnual } })
  const totalAnual = anioData.reduce((a, d) => ({ rev: a.rev + d.rev, exp: a.exp + d.exp, inv: a.inv + d.inv, ncf: a.ncf + d.ncf }), { rev: 0, exp: 0, inv: 0, ncf: 0 })
  const maxAnual = Math.max(...anioData.map(d => Math.max(d.rev, d.exp)), 1)

  // Cobranzas: todos los ingresos previstos (no cobrados), ordenados por fecha
  const hoyStr = new Date().toISOString().slice(0, 10)
  const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const cobranzas = ingresos.filter(i => !i.cobrado).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  const cobVencidas = cobranzas.filter(i => i.fecha < hoyStr)
  const cobEstaSemana = cobranzas.filter(i => i.fecha >= hoyStr && i.fecha <= en7dias)
  const totalPorCobrar = cobranzas.reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0)
  const totalVencido = cobVencidas.reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0)
  function estadoCobranza(fecha) {
    if (fecha < hoyStr) return 'vencida'
    if (fecha <= en7dias) return 'pronto'
    return 'futura'
  }

  if (loading) return <div className="loading-state">Cargando contabilidad…</div>

  return (
    <div className="acc-view">
      <div className="acc-header">
        <div>
          <h2 className="acc-title">Contabilidad</h2>
          <div className="acc-sub">Balance del negocio · {vista === 'mensual' ? `${MESES[mes]} ${anio}` : vista === 'anual' ? `Año ${anio}` : 'Cobranzas pendientes'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="acc-vista-toggle">
            <button className={vista === 'mensual' ? 'active' : ''} onClick={() => setVista('mensual')}>Mensual</button>
            <button className={vista === 'anual' ? 'active' : ''} onClick={() => setVista('anual')}>Anual</button>
            <button className={vista === 'cobranzas' ? 'active' : ''} onClick={() => setVista('cobranzas')}>Cobranzas</button>
          </div>
          {vista === 'cobranzas' ? null : vista === 'mensual' ? (
            <div className="acc-month-nav">
              <button onClick={() => { if (mes === 0) { setMes(11); setAnio(anio - 1) } else setMes(mes - 1) }}>‹</button>
              <span>{MESES[mes]} {anio}</span>
              <button onClick={() => { if (mes === 11) { setMes(0); setAnio(anio + 1) } else setMes(mes + 1) }}>›</button>
            </div>
          ) : (
            <div className="acc-month-nav">
              <button onClick={() => setAnio(anio - 1)}>‹</button>
              <span>{anio}</span>
              <button onClick={() => setAnio(anio + 1)}>›</button>
            </div>
          )}
        </div>
      </div>

      {vista === 'mensual' && <>
      <div className="acc-kpis">
        <div className="acc-kpi"><div className="acc-kpi-lbl">Opening Balance</div><div className="acc-kpi-val">{money(openingBalance)}</div></div>
        <div className="acc-kpi"><div className="acc-kpi-lbl">Revenue</div><div className="acc-kpi-val" style={{ color: 'var(--green)' }}>{money(revenueReal)}</div>{revenuePrev > 0 && <div className="acc-kpi-sub">+{money(revenuePrev)} previsto</div>}</div>
        <div className="acc-kpi"><div className="acc-kpi-lbl">Expenses</div><div className="acc-kpi-val" style={{ color: '#ef5350' }}>{money(expensesReal)}</div>{inversionesReal > 0 && <div className="acc-kpi-sub" style={{ color: '#26C6DA' }}>{money(inversionesReal)} en inversiones</div>}{expensesPrev > 0 && <div className="acc-kpi-sub">+{money(expensesPrev)} previsto</div>}</div>
        <div className="acc-kpi"><div className="acc-kpi-lbl">Net Cash Flow</div><div className="acc-kpi-val" style={{ color: netCashFlow >= 0 ? 'var(--green)' : '#ef5350' }}>{money(netCashFlow)}</div><div className="acc-kpi-sub">{margen}% margen</div></div>
        <div className="acc-kpi acc-kpi-hl"><div className="acc-kpi-lbl">Closing Balance</div><div className="acc-kpi-val">{money(closingBalance)}</div></div>
      </div>

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

      <div className="acc-cols">
        {/* INGRESOS */}
        <div className="acc-card">
          <div className="acc-card-head">
            <div className="acc-card-title">Ingresos · {money(revenueReal)}</div>
            <button className="acc-add" onClick={() => { setEditIngId(null); setFormIng({ ...emptyIng, fecha: `${mesStr}-01` }); setShowIng(!showIng) }}>+ Ingreso</button>
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
              {!editIngId && (
                <div className="acc-modo-toggle">
                  <button type="button" className={ingModo === 'unico' ? 'active' : ''} onClick={() => { setIngModo('unico'); setIngCuotas([]) }}>Pago único</button>
                  <button type="button" className={ingModo === 'cuotas' ? 'active' : ''} onClick={() => setIngModo('cuotas')}>En cuotas</button>
                </div>
              )}
              {ingModo === 'cuotas' && !editIngId && (
                <div className="cierre-cuotas">
                  <div className="acc-form-row">
                    <input type="number" placeholder="Pagó ahora (inicial)" value={formIng.pago_inicial} onChange={e => setFormIng({ ...formIng, pago_inicial: e.target.value })} />
                    <select onChange={e => generarIngCuotas(Number(e.target.value))} value={ingCuotas.length || ''}>
                      <option value="">Generar cuotas…</option>
                      {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} cuotas</option>)}
                    </select>
                  </div>
                  {ingCuotas.map((c, i) => (
                    <div key={i} className="cierre-cuota-row">
                      <span className="cierre-cuota-n">#{i + 1}</span>
                      <input type="number" value={c.monto} onChange={e => updateIngCuota(i, 'monto', e.target.value)} />
                      <input type="date" value={c.fecha} onChange={e => updateIngCuota(i, 'fecha', e.target.value)} />
                    </div>
                  ))}
                </div>
              )}
              <input placeholder="Nota (ej: pagó en pesos, TC 1450)" value={formIng.nota} onChange={e => setFormIng({ ...formIng, nota: e.target.value })} style={{ width: '100%', marginBottom: 8, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13 }} />
              {(ingModo === 'unico' || editIngId) && <label className="acc-check"><input type="checkbox" checked={formIng.cobrado} onChange={e => setFormIng({ ...formIng, cobrado: e.target.checked })} /> Ya cobrado (destildado = previsto)</label>}
              {(ingModo === 'unico' || editIngId) && formIng.monto_bruto && <div className="acc-neto-preview">Neto: {money(Number(formIng.monto_bruto) - Number(formIng.monto_bruto) * Number(formIng.comision_pct || 0) / 100)}</div>}
              <div className="acc-form-actions">
                <button className="btn-cancel" onClick={() => { setShowIng(false); setEditIngId(null) }}>Cancelar</button>
                <button className="btn-save" onClick={saveIngreso}>{editIngId ? 'Guardar cambios' : 'Guardar'}</button>
              </div>
            </div>
          )}
          <div className="acc-list">
            {ingMes.length === 0 && <div className="acc-empty">Sin ingresos este mes</div>}
            {ingMes.map(i => (
              <div key={i.id} className={`acc-item ${!i.cobrado ? 'acc-previsto' : ''}`}>
                <button className={`acc-dot-toggle ${i.cobrado ? 'on' : ''}`} onClick={() => toggleCobradoIng(i)} title={i.cobrado ? 'Cobrado' : 'Previsto — clic para marcar cobrado'} />
                <div className="acc-item-main">
                  <div className="acc-item-concepto">{i.concepto}{i.origen === 'crm' && <span className="acc-tag-crm">CRM</span>}{!i.cobrado && <span className="acc-tag-prev">previsto</span>}</div>
                  <div className="acc-item-sub">{i.cliente ? i.cliente + ' · ' : ''}{i.fecha?.slice(8, 10)}/{i.fecha?.slice(5, 7)}{i.medio_pago ? ' · ' + i.medio_pago : ''}{i.comision_pct > 0 ? ` · ${i.comision_pct}%` : ''}</div>
                  {i.nota && <div className="acc-item-nota">{i.nota}</div>}
                </div>
                <div className="acc-item-monto">
                  <div style={{ color: i.cobrado ? 'var(--green)' : 'var(--muted)' }}>{money(netoIngreso(i))}</div>
                  {i.comision_pct > 0 && <div className="acc-item-bruto">bruto {money(i.monto_bruto)}</div>}
                </div>
                <div className="acc-item-btns">
                  <button className="acc-edit" onClick={() => editarIngreso(i)}>✎</button>
                  <button className="acc-del" onClick={() => delIngreso(i.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GASTOS */}
        <div className="acc-card">
          <div className="acc-card-head">
            <div className="acc-card-title">Gastos · {money(expensesReal)}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="acc-add acc-add-alt" onClick={replicarRecurrentes} title="Traer gastos recurrentes a este mes">↻ Recurrentes</button>
              <button className="acc-add" onClick={() => { setEditGasId(null); setFormGas({ ...emptyGas, fecha: `${mesStr}-01` }); setShowGas(!showGas) }}>+ Gasto</button>
            </div>
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
              <label className="acc-check"><input type="checkbox" checked={formGas.recurrente} onChange={e => setFormGas({ ...formGas, recurrente: e.target.checked })} /> Gasto recurrente (se puede traer cada mes)</label>
              <label className="acc-check"><input type="checkbox" checked={formGas.cobrado} onChange={e => setFormGas({ ...formGas, cobrado: e.target.checked })} /> Ya pagado (destildado = previsto)</label>
              <div className="acc-form-actions">
                <button className="btn-cancel" onClick={() => { setShowGas(false); setEditGasId(null) }}>Cancelar</button>
                <button className="btn-save" onClick={saveGasto}>{editGasId ? 'Guardar cambios' : 'Guardar'}</button>
              </div>
            </div>
          )}
          <div className="acc-list">
            {gasMes.length === 0 && <div className="acc-empty">Sin gastos este mes</div>}
            {gastosPorCat.map(({ cat, total, items }) => items.length > 0 && (
              <div key={cat} className="acc-cat-group">
                <div className="acc-cat-head"><span style={{ color: CAT_COLOR[cat] }}>● {CAT_LABEL[cat]}</span><span>{money(total)}</span></div>
                {items.map(g => (
                  <div key={g.id} className={`acc-item ${!g.cobrado ? 'acc-previsto' : ''}`}>
                    <button className={`acc-dot-toggle ${g.cobrado ? 'on' : ''}`} onClick={() => toggleCobradoGas(g)} title={g.cobrado ? 'Pagado' : 'Previsto'} />
                    <div className="acc-item-main">
                      <div className="acc-item-concepto">{g.concepto}{g.recurrente && <span className="acc-tag-rec">rec</span>}{!g.cobrado && <span className="acc-tag-prev">previsto</span>}</div>
                      <div className="acc-item-sub">{g.fecha?.slice(8, 10)}/{g.fecha?.slice(5, 7)}</div>
                    </div>
                    <div className="acc-item-monto"><div style={{ color: g.cobrado ? '#ef5350' : 'var(--muted)' }}>{money(g.monto)}</div></div>
                    <div className="acc-item-btns">
                      <button className="acc-edit" onClick={() => editarGasto(g)}>✎</button>
                      <button className="acc-del" onClick={() => delGasto(g.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* INVERSIONES — sección aparte */}
          <div className="acc-inv-section">
            <div className="acc-card-head" style={{ marginTop: 8 }}>
              <div className="acc-card-title" style={{ color: '#26C6DA' }}>◆ Inversiones · {money(inversionesMes.reduce((s,g)=>s+Number(g.monto||0),0))}</div>
              <button className="acc-add" style={{ background: 'rgba(38,198,218,.12)', color: '#26C6DA' }} onClick={() => { setEditGasId(null); setFormGas({ ...emptyGas, categoria: 'inversiones', fecha: `${mesStr}-01` }); setShowGas(true) }}>+ Inversión</button>
            </div>
            <div className="acc-list">
              {inversionesMes.length === 0 && <div className="acc-empty">Sin inversiones este mes</div>}
              {inversionesMes.map(g => (
                <div key={g.id} className={`acc-item ${!g.cobrado ? 'acc-previsto' : ''}`}>
                  <button className={`acc-dot-toggle ${g.cobrado ? 'on' : ''}`} onClick={() => toggleCobradoGas(g)} title={g.cobrado ? 'Pagado' : 'Previsto'} />
                  <div className="acc-item-main">
                    <div className="acc-item-concepto">{g.concepto}{!g.cobrado && <span className="acc-tag-prev">previsto</span>}</div>
                    <div className="acc-item-sub">{g.fecha?.slice(8, 10)}/{g.fecha?.slice(5, 7)}</div>
                  </div>
                  <div className="acc-item-monto"><div style={{ color: g.cobrado ? '#26C6DA' : 'var(--muted)' }}>{money(g.monto)}</div></div>
                  <div className="acc-item-btns">
                    <button className="acc-edit" onClick={() => editarGasto(g)}>✎</button>
                    <button className="acc-del" onClick={() => delGasto(g.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </>}

      {vista === 'anual' && (
        <div className="acc-anual">
          {/* Tarjetas resumen del año */}
          <div className="acc-kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="acc-kpi"><div className="acc-kpi-lbl">Revenue {anio}</div><div className="acc-kpi-val" style={{ color: 'var(--green)' }}>{money(totalAnual.rev)}</div></div>
            <div className="acc-kpi"><div className="acc-kpi-lbl">Expenses {anio}</div><div className="acc-kpi-val" style={{ color: '#ef5350' }}>{money(totalAnual.exp)}</div><div className="acc-kpi-sub" style={{ color: '#26C6DA' }}>{money(totalAnual.inv)} en inversiones</div></div>
            <div className="acc-kpi"><div className="acc-kpi-lbl">Net Cash Flow {anio}</div><div className="acc-kpi-val" style={{ color: totalAnual.ncf >= 0 ? 'var(--green)' : '#ef5350' }}>{money(totalAnual.ncf)}</div></div>
            <div className="acc-kpi acc-kpi-hl"><div className="acc-kpi-lbl">Closing Balance</div><div className="acc-kpi-val">{money(anioConBalance[11].closing)}</div></div>
          </div>

          {/* Gráfico macro del año */}
          <div className="acc-card" style={{ marginBottom: 16 }}>
            <div className="acc-card-title">Evolución {anio}</div>
            <div className="acc-chart acc-chart-big">
              {anioConBalance.map((d, i) => (
                <div key={i} className="acc-bar-group">
                  <div className="acc-bars">
                    <div className="acc-bar" style={{ height: `${(d.rev / maxAnual) * 100}%`, background: 'var(--green)' }} title={`Revenue: ${money(d.rev)}`} />
                    <div className="acc-bar" style={{ height: `${(d.exp / maxAnual) * 100}%`, background: '#ef5350' }} title={`Expenses: ${money(d.exp)}`} />
                  </div>
                  <div className="acc-bar-lbl">{MESES[i].slice(0, 3)}</div>
                </div>
              ))}
            </div>
            <div className="acc-legend">
              <span><span className="acc-dot" style={{ background: 'var(--green)' }} />Revenue</span>
              <span><span className="acc-dot" style={{ background: '#ef5350' }} />Expenses</span>
            </div>
          </div>

          {/* Tabla anual tipo Sheet */}
          <div className="acc-card">
            <div className="acc-card-title">Resumen mensual {anio}</div>
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    {MESES.map((m, i) => <th key={i} className="acc-th-mes" onClick={() => { setMes(i); setVista('mensual') }}>{m.slice(0, 3)}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="acc-td-lbl">Revenue</td>
                    {anioData.map((d, i) => <td key={i} style={{ color: 'var(--green)' }}>{d.rev ? money(d.rev) : '—'}</td>)}
                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>{money(totalAnual.rev)}</td>
                  </tr>
                  <tr>
                    <td className="acc-td-lbl">Expenses</td>
                    {anioData.map((d, i) => <td key={i} style={{ color: '#ef5350' }}>{d.exp ? money(d.exp) : '—'}</td>)}
                    <td style={{ color: '#ef5350', fontWeight: 700 }}>{money(totalAnual.exp)}</td>
                  </tr>
                  <tr>
                    <td className="acc-td-lbl" style={{ color: '#26C6DA' }}>Inversiones</td>
                    {anioData.map((d, i) => <td key={i} style={{ color: '#26C6DA' }}>{d.inv ? money(d.inv) : '—'}</td>)}
                    <td style={{ color: '#26C6DA', fontWeight: 700 }}>{money(totalAnual.inv)}</td>
                  </tr>
                  <tr className="acc-tr-hl">
                    <td className="acc-td-lbl">Net Cash Flow</td>
                    {anioData.map((d, i) => <td key={i} style={{ color: d.ncf >= 0 ? 'var(--green)' : '#ef5350' }}>{d.ncf ? money(d.ncf) : '—'}</td>)}
                    <td style={{ fontWeight: 700, color: totalAnual.ncf >= 0 ? 'var(--green)' : '#ef5350' }}>{money(totalAnual.ncf)}</td>
                  </tr>
                  <tr>
                    <td className="acc-td-lbl">Closing Balance</td>
                    {anioConBalance.map((d, i) => <td key={i} style={{ fontWeight: 600 }}>{money(d.closing)}</td>)}
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {vista === 'cobranzas' && (() => {
        // Agrupar cobranzas por mes
        const porMes = {}
        cobranzas.forEach(i => {
          const k = ym(i.fecha)
          if (!porMes[k]) porMes[k] = []
          porMes[k].push(i)
        })
        const mesesOrdenados = Object.keys(porMes).sort()
        const nombreMes = k => {
          const [y, m] = k.split('-')
          return `${MESES[parseInt(m) - 1]} ${y.slice(2)}`
        }
        const totalMes = arr => arr.reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0)
        const esMesActual = k => k === new Date().toISOString().slice(0, 7)

        return (
          <div className="cob2">
            {/* Franja resumen */}
            <div className="cob2-hero">
              <div className="cob2-hero-main">
                <div className="cob2-hero-num">{money(totalPorCobrar)}</div>
                <div className="cob2-hero-lbl">por cobrar · {cobranzas.length} pago{cobranzas.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="cob2-hero-side">
                {totalVencido > 0 && (
                  <div className="cob2-hero-stat">
                    <span className="cob2-dot cob2-dot-venc" />
                    <div><div className="cob2-stat-num">{money(totalVencido)}</div><div className="cob2-stat-lbl">vencido · {cobVencidas.length}</div></div>
                  </div>
                )}
                {cobEstaSemana.length > 0 && (
                  <div className="cob2-hero-stat">
                    <span className="cob2-dot cob2-dot-pronto" />
                    <div><div className="cob2-stat-num">{money(cobEstaSemana.reduce((s, i) => s + Number(i.monto_neto ?? i.monto_bruto ?? 0), 0))}</div><div className="cob2-stat-lbl">esta semana · {cobEstaSemana.length}</div></div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline por meses */}
            {cobranzas.length === 0 ? (
              <div className="cob2-empty">
                <div className="cob2-empty-icon">✓</div>
                <div>No hay cobranzas pendientes.<br />Todo al día.</div>
              </div>
            ) : (
              <div className="cob2-timeline">
                {mesesOrdenados.map(k => {
                  const items = porMes[k].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
                  const venc = items.filter(i => estadoCobranza(i.fecha) === 'vencida')
                  return (
                    <div key={k} className={`cob2-col ${esMesActual(k) ? 'cob2-col-now' : ''}`}>
                      <div className="cob2-col-head">
                        <div className="cob2-col-mes">{nombreMes(k)}{esMesActual(k) && <span className="cob2-now-tag">ahora</span>}</div>
                        <div className="cob2-col-total">{money(totalMes(items))}</div>
                        {venc.length > 0 && <div className="cob2-col-venc">{venc.length} vencido{venc.length !== 1 ? 's' : ''}</div>}
                      </div>
                      <div className="cob2-col-items">
                        {items.map(i => {
                          const est = estadoCobranza(i.fecha)
                          return (
                            <div key={i.id} className={`cob2-ficha cob2-${est}`}>
                              <div className="cob2-ficha-top">
                                <span className="cob2-ficha-dia">{i.fecha?.slice(8, 10)}</span>
                                <span className="cob2-ficha-monto">{money(i.monto_neto ?? i.monto_bruto)}</span>
                              </div>
                              <div className="cob2-ficha-concepto">{i.concepto}</div>
                              {i.cliente && <div className="cob2-ficha-cliente">{i.cliente}</div>}
                              <button className="cob2-ficha-btn" onClick={async () => { await supabase.from('ingresos').update({ cobrado: true }).eq('id', i.id); fetchAll() }}>Marcar cobrado</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
