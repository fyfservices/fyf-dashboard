import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'
import AIAssistant from './components/AIAssistant'

const GOAL = 10000
const COLORS = ['#4CAF50','#5B9BD5','#F5C842','#9B7FE8','#26C6DA','#FF8A65','#66BB6A','#EC407A','#AB47BC','#29B6F6','#FFA726','#8D6E63','#78909C','#D4E157','#EF5350','#26A69A','#5C6BC0','#FF7043','#66BB6A','#9E9E9E','#F06292']
const STAGE_ORDER = ['guiones','esperando','edicion','lanzar','activa']
const STAGE_LABELS = {guiones:'Guiones',esperando:'Esperando grabación',edicion:'En edición',lanzar:'Listo para lanzar',activa:'Activa'}
const OWNER_LABELS = {fran:'Francesco',felipe:'Felipe',christian:'Christian',gaston:'Gastón',ambos:'F & F',cliente:'⚠️ Cliente'}
const CAT_LABELS = {problema:'Problema',resultado:'Resultado',friccion:'Fricción',volumen:'Volumen',ads:'ADS'}

const initials = name => name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
const daysLeft = endDate => { if (!endDate) return null; return Math.ceil((new Date(endDate) - new Date()) / (1000*60*60*24)) }
const barColor = pct => pct >= 100 ? '#4CAF50' : pct >= 60 ? '#5B9BD5' : pct >= 30 ? '#F5C842' : '#E05252'
const totalComisiones = ventas => (ventas||[]).reduce((s,v) => s + Number(v.amount), 0)

const SEED_CLIENTS = [
  {name:'Adriana Roa',country:'Asunción, Paraguay',start_date:'2026-02-19',end_date:'2026-11-19',duration_months:9,estado:'activo',color:'#4CAF50',leads:277,spend:1145,objetivo:'Mínimo $5.000/mes',facturacion:'No especificada',problema:'Falta de cierres constantes'},
  {name:'Judy Rodriguez',country:'Asunción, Paraguay',start_date:'2026-03-28',end_date:'2026-11-19',duration_months:3,estado:'activo',color:'#5B9BD5',leads:423,spend:2600,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
  {name:'Diego González',country:'Asunción, Paraguay',start_date:'2026-07-28',end_date:'2026-10-28',duration_months:3,estado:'activo',color:'#F5C842',leads:25,spend:70,objetivo:'$3.000 USD/mes',facturacion:'No registrada',problema:'Falta de leads calificados'},
  {name:'Soledad Villagra',country:'Paraguay',start_date:'2026-06-25',end_date:'2026-09-25',duration_months:3,estado:'activo',color:'#9B7FE8',leads:307,spend:968,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
  {name:'Alejandro Nardini',country:'Buenos Aires, Argentina',start_date:'2026-04-21',end_date:'2026-10-21',duration_months:3,estado:'activo',color:'#26C6DA',leads:93,spend:515,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
  {name:'Rocío Ortiz',country:'Paraguay',start_date:'2026-06-08',end_date:'2026-10-08',duration_months:4,estado:'activo',color:'#FF8A65',leads:70,spend:280,objetivo:'$80.000 gross/mes',facturacion:'$40.000/mes',problema:'Falta de sistemas y estructura'},
  {name:'Claudia Barrios',country:'Paraguay',start_date:'2026-07-14',end_date:'2026-11-14',duration_months:4,estado:'activo',color:'#66BB6A',leads:113,spend:157,objetivo:'1 venta al mes',facturacion:'Recién arrancando',problema:'Falta de leads y sistema'},
  {name:'Mariano Conti',country:'Buenos Aires, Argentina',start_date:'2026-05-11',end_date:'2026-08-11',duration_months:3,estado:'activo',color:'#EC407A',leads:172,spend:592,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
  {name:'Dayana Salazar',country:'Costa Rica',start_date:'2026-06-22',end_date:'2026-09-22',duration_months:3,estado:'activo',color:'#29B6F6',leads:17,spend:238,objetivo:'$2.500-3.000/mes',facturacion:'$1.500 aprox/mes',problema:'Competencia del rubro'},
  {name:'Ariel Colturi',country:'Paraguay',start_date:'2026-06-10',end_date:'2026-10-10',duration_months:4,estado:'activo',color:'#FFA726',leads:40,spend:178,objetivo:'$50.000/mes + 7 agentes/mes',facturacion:'No especificada',problema:'Falta de prospectos'},
  {name:'Laura & Nathalia (Designo)',country:'Paraguay',start_date:'2026-07-01',end_date:'2026-11-01',duration_months:4,estado:'activo',color:'#8D6E63',leads:108,spend:424,objetivo:'5 ventas mensuales',facturacion:'No especificada',problema:'Falta de leads calificados'},
  {name:'Maria Courel',country:'Paraguay',start_date:'2026-07-01',end_date:'2026-11-01',duration_months:4,estado:'activo',color:'#D4E157',leads:45,spend:117,objetivo:'$8.000 USD/mes',facturacion:'$3.000 USD/mes',problema:'Dependía de referidos'},
  {name:'Ailin Sidney',country:'Arizona, EEUU',start_date:'2026-07-08',end_date:'2026-11-08',duration_months:4,estado:'activo',color:'#AB47BC',leads:19,spend:173,objetivo:'1 venta/mes mínimo',facturacion:'No especificada',problema:'Llegar a más clientes'},
  {name:'Juan y Nacho Portela',country:'Uruguay',start_date:'2026-07-14',end_date:'2026-10-14',duration_months:3,estado:'activo',color:'#78909C',leads:0,spend:0,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
  {name:'Ventora Realty',country:'Costa Rica',start_date:'2026-07-24',end_date:'2026-11-24',duration_months:4,estado:'activo',color:'#26A69A',leads:8,spend:173,objetivo:'$50.000 en 6 meses',facturacion:'No especificada',problema:'Falta de leads'},
  {name:'Rafael Pereyra',country:'Paraguay',start_date:'2026-08-08',end_date:'2026-11-08',duration_months:3,estado:'activo',color:'#EF5350',leads:5,spend:60,objetivo:'$6.000-$10.000 USD/mes',facturacion:'$3.000-$4.500 USD/mes',problema:'Falta de desarrollos'},
  {name:'Luciano Cabrera',country:'Paraguay',start_date:'2026-08-12',end_date:'2026-11-12',duration_months:3,estado:'activo',color:'#5C6BC0',leads:0,spend:0,objetivo:'$5.000/mes',facturacion:'$1.000 USD',problema:'Falta de tiempo y leads'},
  {name:'Nadia Melgarejo',country:'Paraguay',start_date:'2026-08-24',end_date:'2026-12-24',duration_months:4,estado:'activo',color:'#F06292',leads:0,spend:0,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
  {name:'Vanessa Gayozo',country:'Paraguay',start_date:'2026-08-26',end_date:'2026-11-26',duration_months:3,estado:'activo',color:'#FF7043',leads:0,spend:0,objetivo:'$250.000 Gs/mes',facturacion:'$2.950',problema:'Leads curiosos y ads sin ROI'},
  {name:'Carolina Perona',country:'Buenos Aires, Argentina',start_date:'2026-08-27',end_date:'2026-12-27',duration_months:4,estado:'activo',color:'#66BB6A',leads:0,spend:0,objetivo:'$130.000 en 4 meses',facturacion:'$20.000',problema:'Falta de sistema'},
  {name:'Carlos Barón',country:'Salta, Argentina',start_date:'2026-09-01',end_date:'2026-12-01',duration_months:3,estado:'activo',color:'#9E9E9E',leads:22,spend:120,objetivo:'No especificado',facturacion:'No especificada',problema:'No especificado'},
]

const SEED_VENTAS = [
  {client_name:'Adriana Roa',description:'Depto en pozo – inversores ARG',amount:4650,date:'2026-07-15'},
  {client_name:'Adriana Roa',description:'Depto USD 56K',amount:2800,date:'2026-08-02'},
  {client_name:'Adriana Roa',description:'Depto USD 77K',amount:3850,date:'2026-08-20'},
  {client_name:'Adriana Roa',description:'Venta adicional',amount:3000,date:'2026-08-28'},
  {client_name:'Judy Rodriguez',description:'Venta primera operación',amount:1750,date:'2026-04-29'},
  {client_name:'Judy Rodriguez',description:'Venta junio',amount:2500,date:'2026-06-15'},
  {client_name:'Judy Rodriguez',description:'Venta agosto',amount:4750,date:'2026-08-20'},
  {client_name:'Diego González',description:'2 ventas Vida Alegre USD 57K c/u',amount:5700,date:'2026-08-28'},
  {client_name:'Soledad Villagra',description:'Venta USD 80K',amount:4000,date:'2026-07-20'},
  {client_name:'Carlos Barón',description:'Venta propiedad USD 330K (6% comisión)',amount:19800,date:'2026-07-10'},
]

const SEED_TASKS = [
  {title:'Agregar pregunta de rango de inversión en Calendly',owner:'felipe',priority:'urgent',deadline:'2026-09-01',note:'Rangos: $800-1.5K / $1.5K-2.5K / $2.5K+. Sin opción "menos de 800".'},
  {title:'Reactivar campaña de Felipe y escalar ambas al 20%',owner:'ambos',priority:'urgent',deadline:'2026-09-01',note:'Subir de a 20% cada 48hs para no desestabilizar el algoritmo.'},
  {title:'Felipe toma todos los cierres — definir roles ya',owner:'felipe',priority:'urgent',deadline:'2026-09-01',note:'Francesco se enfoca en marketing y operaciones.'},
  {title:'Finalizar contrato con Carolina Perona RE/MAX',owner:'felipe',priority:'normal',deadline:'2026-09-03',note:'Fee $1.5K + 20% comisión neta. Cláusula penalización $5K.'},
  {title:'Reportes HTML semanales — lanzar con Cowork Skill',owner:'christian',priority:'normal',deadline:'2026-09-01',note:'Usar el prompt de Cowork ya configurado.'},
  {title:'Seguimiento con Mara — reunión martes 1 sept 14hs',owner:'fran',priority:'urgent',deadline:'2026-09-01',note:'Definir plan de pago antes de la llamada.'},
]

const SEED_PIPELINE = [
  {client_name:'Judy Rodriguez',property:'España y Colombia',stage:'esperando',owner:'cliente',days_in_stage:14,note:'Grabó 3 videos Colombia, falta España'},
  {client_name:'Adriana Roa',property:'Condominio Isla Aranda',stage:'esperando',owner:'cliente',days_in_stage:17,note:'Falta que se grabe y suba los videos'},
  {client_name:'Ariel Colturi',property:'CAPTACION AGENTES',stage:'esperando',owner:'cliente',days_in_stage:12,note:'Falta que se grabe y suba los videos'},
  {client_name:'Carolina Perona',property:'Propiedad 2 (2 campañas)',stage:'guiones',owner:'felipe',days_in_stage:5,note:'In progress'},
  {client_name:'Ventora Realty',property:'Casa Acqua Blue',stage:'activa',owner:'christian',days_in_stage:5,note:'3 videos nuevos en campaña'},
  {client_name:'Juan y Nacho Portela',property:'Venta Argentinos',stage:'activa',owner:'christian',days_in_stage:13,note:'Lanzamos con 4 videos y 2 estáticos'},
]

const SEED_CONTENT = [
  {hook:'Por qué cerrar una venta grande te da alivio en vez de felicidad.',category:'problema',status:'subido',format:'Improvisado',publish_date:'2026-07-20'},
  {hook:'La estafa oculta de destacar propiedades en portales inmobiliarios.',category:'problema',status:'subido',format:'Improvisado',publish_date:'2026-07-22'},
  {hook:'El boca en boca te está mintiendo.',category:'friccion',status:'subido',format:'Improvisado',publish_date:'2026-07-15'},
  {hook:'Caso Adriana Roa $2.995 en 9 días + Caso Rosario $2.700 en 5 días.',category:'resultado',status:'subido',format:'Reel',publish_date:'2026-03-31'},
  {hook:'No consiguen leads calificados para los tickets de sus propiedades.',category:'problema',status:'pendiente',format:'Reel'},
  {hook:'La dictadura de los portales: creer que pagar el plan Destacado es tener estrategia.',category:'problema',status:'pendiente',format:'Reel'},
  {hook:'Miedo a invertir — el costo de oportunidad que no ven.',category:'friccion',status:'pendiente',format:'Reel'},
  {hook:'Caso Fer Scarani: 15 captaciones en menos de 30 días de campaña.',category:'resultado',status:'pendiente',format:'Carrusel'},
]

export default function App() {
  const [tab, setTab] = useState('tasks')
  const [clients, setClients] = useState([])
  const [ventas, setVentas] = useState([])
  const [tasks, setTasks] = useState([])
  const [reports, setReports] = useState([])
  const [pipeline, setPipeline] = useState([])
  const [content, setContent] = useState([])
  const [semanal, setSemanal] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeded, setSeeded] = useState(false)

  const fetchAll = useCallback(async () => {
    const [c,v,t,r,p,co,sem] = await Promise.all([
      supabase.from('clients').select('*').order('created_at'),
      supabase.from('ventas').select('*').order('date'),
      supabase.from('tasks').select('*').order('created_at',{ascending:false}),
      supabase.from('reports').select('*').order('created_at',{ascending:false}),
      supabase.from('pipeline').select('*').order('created_at'),
      supabase.from('content').select('*').order('created_at',{ascending:false}),
      supabase.from('campaign_weekly').select('*').order('fecha',{ascending:false}),
    ])
    setClients(c.data||[])
    setVentas(v.data||[])
    setTasks(t.data||[])
    setReports(r.data||[])
    setPipeline(p.data||[])
    setContent(co.data||[])
    setSemanal(sem.data||[])
    setLoading(false)
  }, [])

  const seedData = useCallback(async () => {
    if (seeded) return
    setSeeded(true)
    const {data: insertedClients} = await supabase.from('clients').insert(SEED_CLIENTS).select()
    if (insertedClients) {
      const ventasToInsert = SEED_VENTAS.map(v => {
        const client = insertedClients.find(c => c.name === v.client_name)
        if (!client) return null
        return {client_id:client.id,description:v.description,amount:v.amount,date:v.date}
      }).filter(Boolean)
      if (ventasToInsert.length) await supabase.from('ventas').insert(ventasToInsert)
    }
    await supabase.from('tasks').insert(SEED_TASKS.map(t=>({...t,done:false})))
    await supabase.from('pipeline').insert(SEED_PIPELINE)
    await supabase.from('content').insert(SEED_CONTENT)
    await fetchAll()
  }, [seeded, fetchAll])

  useEffect(() => {
    fetchAll().then(() => {
      supabase.from('clients').select('id').limit(1).then(({data}) => {
        if (!data || data.length === 0) seedData()
      })
    })
  }, [fetchAll, seedData])

  const date = new Date().toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'')

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0B0D0B',color:'#7A8A7A',fontFamily:'Inter,sans-serif',gap:12}}>
      <div style={{width:20,height:20,border:'2px solid #2A302A',borderTop:'2px solid #4CAF50',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      Cargando dashboard...
    </div>
  )

  return (
    <div className="app">
      <header className="header">
        <div className="logo"><div className="logo-mark">F</div><span className="logo-name">F&F Services</span></div>
        <span className="header-date">{date}</span>
      </header>
      <nav className="tabs-bar">
        {[{id:'tasks',icon:'✓',label:'Tareas'},{id:'analytics',icon:'▤',label:'Analytics'},{id:'clients',icon:'◎',label:'Clientes'},{id:'pipeline',icon:'⟶',label:'Pipeline'},{id:'content',icon:'▶',label:'Contenido'},{id:'accionables',icon:'⚠',label:'Accionables'}].map(t => (
          <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab==='tasks' && <TasksView tasks={tasks} fetchAll={fetchAll}/>}
        {tab==='analytics' && <AnalyticsView clients={clients} ventas={ventas} pipeline={pipeline} semanal={semanal}/>}
        {tab==='clients' && <ClientsView clients={clients} ventas={ventas} fetchAll={fetchAll}/>}
        {tab==='pipeline' && <PipelineView pipeline={pipeline} clients={clients} fetchAll={fetchAll}/>}
        {tab==='accionables' && <AccionablesView semanal={semanal} fetchAll={fetchAll}/>}
        {tab==='content' && <ContentView content={content} fetchAll={fetchAll}/>}
      </main>
      <AIAssistant
        clients={clients}
        ventas={ventas}
        tasks={tasks}
        pipeline={pipeline}
        reports={reports}
        content={content}
        fetchAll={fetchAll}
      />
    </div>
  )
}

// ── TASKS ──────────────────────────────────────────────────
function TasksView({tasks, fetchAll}) {
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [form, setForm] = useState({title:'',owner:'ambos',priority:'normal',deadline:'',note:''})

  const filtered = tasks.filter(t => {
    if (filter==='pending') return !t.done
    if (filter==='done') return t.done
    if (['fran','felipe','christian','gaston'].includes(filter)) return t.owner===filter||t.owner==='ambos'
    return true
  })

  const pending=tasks.filter(t=>!t.done).length
  const urgent=tasks.filter(t=>!t.done&&t.priority==='urgent').length
  const done=tasks.filter(t=>t.done).length

  const openEdit = (task) => {
    setEditingTask(task.id)
    setForm({title:task.title,owner:task.owner,priority:task.priority,deadline:task.deadline||'',note:task.note||''})
    setShowForm(true)
  }

  const saveTask = async () => {
    if (!form.title.trim()) return
    if (editingTask) {
      await supabase.from('tasks').update(form).eq('id',editingTask)
      setEditingTask(null)
    } else {
      await supabase.from('tasks').insert({...form,done:false})
    }
    setForm({title:'',owner:'ambos',priority:'normal',deadline:'',note:''})
    setShowForm(false)
    fetchAll()
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingTask(null)
    setForm({title:'',owner:'ambos',priority:'normal',deadline:'',note:''})
  }

  const toggleDone = async (task) => { await supabase.from('tasks').update({done:!task.done}).eq('id',task.id); fetchAll() }
  const deleteTask = async (id) => { await supabase.from('tasks').delete().eq('id',id); fetchAll() }

  const today = new Date().toISOString().slice(0,10)
  const ownerColors = {fran:'green',felipe:'blue',christian:'yellow',gaston:'purple',ambos:'gray'}

  return (
    <div className="view">
      <div className="summary-strip">
        <div className="sum-card"><div className="sum-num">{tasks.length}</div><div className="sum-lbl">Total</div></div>
        <div className="sum-card"><div className="sum-num">{pending}</div><div className="sum-lbl">Pendientes</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--red)'}}>{urgent}</div><div className="sum-lbl">Urgentes</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--green)'}}>{done}</div><div className="sum-lbl">Listas</div></div>
      </div>
      <div className="topbar">
        <h2>Tareas del equipo</h2>
        <button className="btn-add" onClick={()=>{setEditingTask(null);setForm({title:'',owner:'ambos',priority:'normal',deadline:'',note:''});setShowForm(!showForm)}}>＋ Nueva tarea</button>
      </div>
      {showForm && (
        <div className="form-panel">
          <div style={{font:'600 13px Inter',color:'var(--text)',marginBottom:12}}>{editingTask?'Editar tarea':'Nueva tarea'}</div>
          <div className="form-grid"><div className="form-field" style={{gridColumn:'1/-1'}}><label>Título *</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Descripción de la tarea"/></div></div>
          <div className="form-grid">
            <div className="form-field"><label>Asignado a</label><select value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}><option value="ambos">Francesco y Felipe</option><option value="fran">Francesco</option><option value="felipe">Felipe</option><option value="christian">Christian</option><option value="gaston">Gastón</option></select></div>
            <div className="form-field"><label>Prioridad</label><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="urgent">Urgente</option><option value="normal">Normal</option></select></div>
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></div>
            <div className="form-field"><label>Nota</label><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Contexto adicional"/></div>
          </div>
          <div className="form-actions"><button className="btn-cancel" onClick={cancelForm}>Cancelar</button><button className="btn-save" onClick={saveTask}>{editingTask?'Guardar cambios':'Guardar'}</button></div>
        </div>
      )}
      <div className="filters">
        {[['all','Todas'],['pending','Pendientes'],['done','Completadas'],['fran','Francesco'],['felipe','Felipe'],['christian','Christian']].map(([f,l])=>(
          <button key={f} className={`filter ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>
      <div className="list">
        {filtered.length===0 && <div className="empty">Sin tareas</div>}
        {filtered.map(t=>{
          const late=t.deadline&&t.deadline<today&&!t.done
          return (
            <div key={t.id} className={`task-card ${t.done?'done':''}`}>
              <div className={`checkbox ${t.done?'checked':''}`} onClick={()=>toggleDone(t)}/>
              <div className="task-body">
                <div className="task-title">{t.title}</div>
                {t.note&&<div className="task-note">{t.note}</div>}
                <div className="task-meta">
                  <span className={`badge b-${ownerColors[t.owner]||'gray'}`}>{OWNER_LABELS[t.owner]||t.owner}</span>
                  <span className={`badge ${t.priority==='urgent'?'b-urgent':'b-normal'}`}>{t.priority==='urgent'?'Urgente':'Normal'}</span>
                  {t.deadline&&<span className={`badge-date ${late?'late':''}`}>{t.deadline}</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <button className="btn-edit" onClick={()=>openEdit(t)} title="Editar">✎</button>
                <button className="btn-del" onClick={()=>deleteTask(t.id)}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── REPORTS ────────────────────────────────────────────────
function SemanalPanel({semanal}) {
  const [cliente, setCliente] = useState('todos')
  const [periodo, setPeriodo] = useState('semanal')
  const [semanaSel, setSemanaSel] = useState('')

  if (!semanal || !semanal.length) return null

  const activas = semanal.filter(f => f.estado === 'activa')
  const clientes = [...new Set(activas.map(f => f.cliente))].sort()
  const base = cliente === 'todos' ? activas : activas.filter(f => f.cliente === cliente)
  if (!base.length) return null

  const clave = f => periodo === 'mensual' ? f.fecha.slice(0,7) : (periodo === 'total' ? 'total' : f.fecha)
  const grupos = {}
  base.forEach(f => {
    const k = clave(f)
    if (!grupos[k]) grupos[k] = {k, leads:0, spend:0, camps:0}
    grupos[k].leads += Number(f.leads||0)
    grupos[k].spend += Number(f.spend_usd||0)
    grupos[k].camps += 1
  })
  const serie = Object.values(grupos).sort((a,b) => a.k.localeCompare(b.k))
  serie.forEach(g => { g.cpl = g.leads ? g.spend/g.leads : 0 })

  const hoy = serie[serie.length-1]
  const prev = serie.length > 1 ? serie[serie.length-2] : null
  const delta = (a,b) => b ? ((a-b)/b*100) : 0

  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const fmt = k => {
    if (k === 'total') return 'Todo'
    if (k.length === 7) return MESES[parseInt(k.slice(5,7))-1] + ' ' + k.slice(2,4)
    return k.slice(8,10)+'/'+k.slice(5,7)
  }

  const fechasDisp = [...new Set(base.map(f=>f.fecha))].sort()
  const ultimaFecha = (periodo==='semanal' && semanaSel && fechasDisp.includes(semanaSel))
    ? semanaSel : fechasDisp[fechasDisp.length-1]
  const filasUlt = base.filter(f => f.fecha === ultimaFecha)

  const agrupar = (filas, campo) => {
    const o = {}
    filas.forEach(f => {
      const k = f[campo]
      if (!o[k]) o[k] = {nombre:k, leads:0, spend:0}
      o[k].leads += Number(f.leads||0)
      o[k].spend += Number(f.spend_usd||0)
    })
    return Object.values(o).filter(x=>x.leads>0).map(x=>({...x, cpl:x.spend/x.leads})).sort((a,b)=>a.cpl-b.cpl)
  }
  const ranking = agrupar(filasUlt, cliente === 'todos' ? 'cliente' : 'campana')
  const maxCpl = ranking.length ? Math.max(...ranking.map(c=>c.cpl)) : 1

  let empeoraron = []
  if (serie.length > 1 && periodo === 'semanal') {
    const idx = fechasDisp.indexOf(ultimaFecha)
    const fPrev = idx > 0 ? fechasDisp[idx-1] : null
    if (!fPrev) empeoraron = []
    const prevAgr = {}
    agrupar(base.filter(f=>f.fecha===fPrev), cliente==='todos'?'cliente':'campana')
      .forEach(x => { prevAgr[x.nombre] = x.cpl })
    empeoraron = ranking.map(c => {
      const cp = prevAgr[c.nombre]
      if (!cp) return null
      return {nombre:c.nombre, ahora:c.cpl, var: delta(c.cpl, cp)}
    }).filter(x => x && x.var > 15).sort((a,b) => b.var - a.var)
  }

  const KPI = ({label, valor, variacion, invertido}) => {
    const sube = variacion >= 0
    const bueno = invertido ? !sube : sube
    return (
      <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
        <div style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{label}</div>
        <div style={{fontSize:24,fontWeight:600,color:'var(--text)',fontFamily:'var(--mono)',lineHeight:1.1}}>{valor}</div>
        {prev ? (
          <div style={{fontSize:12,marginTop:4,color: bueno ? 'var(--green)' : 'var(--red)'}}>
            {sube?'\u25b2':'\u25bc'} {Math.abs(variacion).toFixed(1)}% vs anterior
          </div>
        ) : <div style={{fontSize:12,marginTop:4,color:'var(--dim)'}}>sin comparacion</div>}
      </div>
    )
  }

  const Sel = ({valor, set, opciones}) => (
    <select value={valor} onChange={e=>set(e.target.value)}
      style={{background:'var(--s2)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:6,padding:'6px 10px',fontSize:12,fontFamily:'inherit',cursor:'pointer'}}>
      {opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  )

  // grafico
  const W=680, H=170, PL=44, PR=16, PT=14, PB=26
  const iw = W-PL-PR, ih = H-PT-PB
  const maxL = Math.max(...serie.map(w=>w.leads))*1.15 || 1
  const maxS = Math.max(...serie.map(w=>w.spend))*1.15 || 1
  const x = i => PL + (serie.length===1 ? iw/2 : (i/(serie.length-1))*iw)
  const yL = v => PT + ih - (v/maxL)*ih
  const yS = v => PT + ih - (v/maxS)*ih
  const linea = f => serie.map((w,i) => (i?'L':'M')+x(i).toFixed(1)+' '+f(w).toFixed(1)).join(' ')
  const area = serie.map((w,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+yL(w.leads).toFixed(1)).join(' ')
           + ' L'+x(serie.length-1).toFixed(1)+' '+(PT+ih)+' L'+x(0).toFixed(1)+' '+(PT+ih)+' Z'

  return (
    <div style={{marginBottom:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:10,flexWrap:'wrap'}}>
        <h2 style={{fontSize:13,fontWeight:500,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Rendimiento de campanas</h2>
        <div style={{display:'flex',gap:8}}>
          <Sel valor={cliente} set={setCliente} opciones={[{v:'todos',l:'Toda la agencia'},...clientes.map(c=>({v:c,l:c}))]}/>
          <Sel valor={periodo} set={setPeriodo} opciones={[{v:'semanal',l:'Semanal'},{v:'mensual',l:'Mensual'},{v:'total',l:'Total'}]}/>
          {periodo==='semanal' && fechasDisp.length>1 && (
            <Sel valor={ultimaFecha} set={setSemanaSel} opciones={fechasDisp.slice().reverse().map(f=>({v:f,l:'Semana '+fmt(f)}))}/>
          )}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:16}}>
        <KPI label="Leads" valor={hoy.leads.toLocaleString()} variacion={prev?delta(hoy.leads,prev.leads):0}/>
        <KPI label="Pauta USD" valor={'$'+Math.round(hoy.spend).toLocaleString()} variacion={prev?delta(hoy.spend,prev.spend):0}/>
        <KPI label="CPL promedio" valor={'$'+hoy.cpl.toFixed(2)} variacion={prev?delta(hoy.cpl,prev.cpl):0} invertido/>
      </div>

      {serie.length > 1 && (
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:16}}>
          <div style={{display:'flex',gap:16,marginBottom:10,fontSize:11,color:'var(--muted)'}}>
            <span><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'var(--green)',marginRight:5}}/>Leads</span>
            <span><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'var(--muted)',marginRight:5}}/>Pauta USD</span>
          </div>
          <svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',height:'auto',display:'block'}}>
            <defs>
              <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.28"/>
                <stop offset="100%" stopColor="#4CAF50" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {[0,0.5,1].map(t => (
              <line key={t} x1={PL} x2={W-PR} y1={PT+ih*t} y2={PT+ih*t} stroke="#2A302A" strokeWidth="1"/>
            ))}
            {[0,0.5,1].map(t => (
              <text key={'l'+t} x={PL-8} y={PT+ih*t+4} textAnchor="end" fill="#4A574A" fontSize="10" fontFamily="monospace">
                {Math.round(maxL*(1-t))}
              </text>
            ))}
            <path d={area} fill="url(#gLeads)"/>
            <path d={linea(w=>yS(w.spend))} fill="none" stroke="#7A8A7A" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round"/>
            <path d={linea(w=>yL(w.leads))} fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {serie.map((w,i) => (
              <g key={i}>
                <circle cx={x(i)} cy={yL(w.leads)} r="3.5" fill="#0B0D0B" stroke="#4CAF50" strokeWidth="2"/>
                <text x={x(i)} y={H-8} textAnchor="middle" fill="#4A574A" fontSize="10" fontFamily="monospace">{fmt(w.k)}</text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:empeoraron.length?'1.4fr 1fr':'1fr',gap:12}}>
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>
            Leads y pauta por {cliente==='todos'?'cliente':'campana'} &middot; {fmt(ultimaFecha)}
          </div>
          {ranking.slice().sort((a,b)=>b.leads-a.leads).map((c,i,arr) => (
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4,gap:10}}>
                <span style={{color:'var(--text)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nombre}</span>
                <span style={{fontFamily:'var(--mono)',color:'var(--muted)',whiteSpace:'nowrap'}}>{c.leads} leads &middot; ${Math.round(c.spend).toLocaleString()}</span>
              </div>
              <div style={{height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:(c.leads/arr[0].leads*100)+'%',background:i<3?'var(--green)':'var(--border2)',borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>

        {empeoraron.length > 0 && (
          <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--red)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>CPL en alza</div>
            {empeoraron.map((e,i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,padding:'7px 0',borderBottom:i<empeoraron.length-1?'1px solid var(--border)':'none'}}>
                <span style={{fontSize:12,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.nombre}</span>
                <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--red)',whiteSpace:'nowrap'}}>
                  +{e.var.toFixed(0)}% &middot; ${e.ahora.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AnalyticsView({clients, ventas, pipeline, semanal}) {
  const CHRISTIAN_URL = 'https://script.google.com/macros/s/AKfycbwR4NxNLlKoMKcoag58OFQ7yEQnMZTEBU11hVHeghBRFzpG2quBcReaVLzmwnRthf3BFQ/exec'
  const GOAL = 10000
  const totalComis = (id) => (ventas||[]).filter(v=>v.client_id===id).reduce((s,v)=>s+Number(v.amount),0)
  const daysLeft = (d) => d ? Math.ceil((new Date(d)-new Date())/(1000*60*60*24)) : null

  const topClients = [...clients].sort((a,b) => b.leads - a.leads).slice(0,8)
  const blocked = pipeline.filter(p=>p.stage==='esperando'&&p.days_in_stage>=7)
  const renewals = clients.filter(c=>{const d=daysLeft(c.end_date);return d!==null&&d<=21&&d>0&&c.estado!=='completo'})
  const totalLeads = clients.reduce((s,c)=>s+c.leads,0)
  const totalSpend = clients.reduce((s,c)=>s+Number(c.spend||0),0)
  const totalComisAll = clients.reduce((s,c)=>s+totalComis(c.id),0)
  const avgCPL = totalLeads > 0 ? (totalSpend/totalLeads).toFixed(2) : 0

  return (
    <div className="view">
      {/* Header con link a Christian */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:16,fontWeight:600,color:'var(--text)',marginBottom:4}}>Analytics — Overview</h2>
          <div style={{fontSize:12,color:'var(--muted)'}}>Datos actualizados desde Supabase</div>
        </div>
        <a href={CHRISTIAN_URL} target="_blank" rel="noreferrer"
          style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'var(--gbg)',border:'1px solid var(--gbd)',color:'var(--green)',borderRadius:6,fontSize:13,fontWeight:500,textDecoration:'none'}}>
          📊 Ver dashboard completo de Christian ↗
        </a>
      </div>

      <SemanalPanel semanal={semanal}/>

      {/* KPIs globales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
        {[
          {n:clients.length,l:'Clientes activos',c:''},
          {n:totalLeads.toLocaleString(),l:'Leads totales',c:''},
          {n:'$'+Math.round(totalSpend).toLocaleString(),l:'Pauta invertida (USD)',c:''},
          {n:'$'+Math.round(totalComisAll).toLocaleString(),l:'Comisiones generadas',c:'color:var(--green)'},
        ].map((k,i)=>(
          <div key={i} className="sum-card">
            <div className="sum-num" style={k.c?{color:'var(--green)'}:{}}>{k.n}</div>
            <div className="sum-lbl">{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>

        {/* Ranking de leads por cliente */}
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Ranking por leads</div>
          {topClients.map((c,i)=>{
            const maxLeads = topClients[0]?.leads||1
            const pct = Math.round(c.leads/maxLeads*100)
            return (
              <div key={c.id} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{color:'var(--text)',fontWeight:500}}>{c.name.split(' ')[0]}</span>
                  <span style={{fontFamily:'var(--mono)',color:'var(--muted)'}}>{c.leads} leads</span>
                </div>
                <div style={{height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:'var(--green)',borderRadius:2}}/>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progreso garantía por cliente */}
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Progreso garantía $10K</div>
          {[...clients].sort((a,b)=>totalComis(b.id)-totalComis(a.id)).slice(0,8).map((c,i)=>{
            const comis = totalComis(c.id)
            const pct = Math.min(100,Math.round(comis/GOAL*100))
            const color = pct>=100?'#4CAF50':pct>=60?'#5B9BD5':pct>=30?'#F5C842':'#E05252'
            return (
              <div key={c.id} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{color:'var(--text)',fontWeight:500}}>{c.name.split(' ')[0]}</span>
                  <span style={{fontFamily:'var(--mono)',color}}>{pct}%</span>
                </div>
                <div style={{height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2}}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {/* Alertas */}
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Alertas activas</div>
          {blocked.length===0&&renewals.length===0&&<div style={{fontSize:12,color:'var(--dim)',fontStyle:'italic'}}>Sin alertas activas ✓</div>}
          {blocked.map(p=>(
            <div key={p.id} style={{display:'flex',gap:8,padding:'6px 10px',background:'var(--obg)',border:'1px solid var(--obd)',borderRadius:6,marginBottom:6,fontSize:12,color:'var(--orange)'}}>
              ⚠️ <span><strong>{p.client_name}</strong> — {p.property} lleva {p.days_in_stage}d sin grabar</span>
            </div>
          ))}
          {renewals.map(c=>(
            <div key={c.id} style={{display:'flex',gap:8,padding:'6px 10px',background:'var(--rbg)',border:'1px solid var(--rbd)',borderRadius:6,marginBottom:6,fontSize:12,color:'var(--red)'}}>
              🔄 <span><strong>{c.name}</strong> — vence en {daysLeft(c.end_date)} días</span>
            </div>
          ))}
        </div>

        {/* CPL por cliente */}
        <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>CPL por cliente (USD)</div>
          {[...clients].filter(c=>c.leads>0&&c.spend>0).sort((a,b)=>(a.spend/a.leads)-(b.spend/b.leads)).slice(0,8).map((c,i)=>{
            const cpl = (c.spend/c.leads).toFixed(2)
            const color = cpl<5?'var(--green)':cpl<15?'var(--yellow)':'var(--red)'
            return (
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                <span style={{color:'var(--text)'}}>{c.name.split(' ')[0]}</span>
                <span style={{fontFamily:'var(--mono)',color,fontWeight:500}}>${cpl}</span>
              </div>
            )
          })}
          <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0 0',fontSize:11,color:'var(--muted)'}}>
            <span>Promedio general</span>
            <span style={{fontFamily:'var(--mono)',fontWeight:500}}>${avgCPL}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportsView({reports, fetchAll}) {
  const [showForm, setShowForm] = useState(false)
  const [editingReport, setEditingReport] = useState(null)
  const [form, setForm] = useState({client_name:'',week:'',leads:0,spend:0,cpl:0,status:'ok',notes:''})

  const openEdit = (r) => {
    setEditingReport(r.id)
    setForm({client_name:r.client_name,week:r.week||'',leads:r.leads,spend:r.spend,cpl:r.cpl,status:r.status,notes:r.notes||''})
    setShowForm(true)
  }

  const saveReport = async () => {
    if (!form.client_name.trim()) return
    if (editingReport) {
      await supabase.from('reports').update(form).eq('id',editingReport)
      setEditingReport(null)
    } else {
      await supabase.from('reports').insert(form)
    }
    setForm({client_name:'',week:'',leads:0,spend:0,cpl:0,status:'ok',notes:''})
    setShowForm(false)
    fetchAll()
  }

  const cancelForm = () => { setShowForm(false); setEditingReport(null); setForm({client_name:'',week:'',leads:0,spend:0,cpl:0,status:'ok',notes:''}) }
  const deleteReport = async (id) => { await supabase.from('reports').delete().eq('id',id); fetchAll() }

  return (
    <div className="view">
      <div className="topbar"><h2>Reportes de campañas</h2><button className="btn-add" onClick={()=>{setEditingReport(null);setShowForm(!showForm)}}>＋ Nuevo reporte</button></div>
      {showForm && (
        <div className="form-panel">
          <div style={{font:'600 13px Inter',color:'var(--text)',marginBottom:12}}>{editingReport?'Editar reporte':'Nuevo reporte'}</div>
          <div className="form-grid">
            <div className="form-field"><label>Cliente *</label><input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Nombre del cliente"/></div>
            <div className="form-field"><label>Semana</label><input value={form.week} onChange={e=>setForm({...form,week:e.target.value})} placeholder="ej: 25-31 ago"/></div>
          </div>
          <div className="form-grid cols3">
            <div className="form-field"><label>Leads</label><input type="number" value={form.leads} onChange={e=>setForm({...form,leads:e.target.value})}/></div>
            <div className="form-field"><label>Gasto (USD)</label><input type="number" value={form.spend} onChange={e=>setForm({...form,spend:e.target.value})}/></div>
            <div className="form-field"><label>CPL (USD)</label><input type="number" value={form.cpl} onChange={e=>setForm({...form,cpl:e.target.value})}/></div>
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Estado</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ok">OK — todo bien</option><option value="warn">Atención — revisar</option><option value="bad">Alerta — problema</option></select></div>
            <div className="form-field"><label>Notas</label><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Accionables..."/></div>
          </div>
          <div className="form-actions"><button className="btn-cancel" onClick={cancelForm}>Cancelar</button><button className="btn-save" onClick={saveReport}>{editingReport?'Guardar cambios':'Guardar'}</button></div>
        </div>
      )}
      <div className="list">
        {reports.length===0&&<div className="empty">Sin reportes todavía</div>}
        {reports.map(r=>{
          const cc=r.cpl>15?'bad':r.cpl>8?'warn':'good'
          const sc={ok:'s-ok',warn:'s-warn',bad:'s-bad'}[r.status]
          const sl={ok:'OK',warn:'Revisar',bad:'Alerta'}[r.status]
          return (
            <div key={r.id} className="report-card">
              <div className="report-top">
                <span className="report-client">{r.client_name}</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {r.week&&<span className="report-week">{r.week}</span>}
                  <span className={`status-tag ${sc}`}>{sl}</span>
                  <button className="btn-edit" onClick={()=>openEdit(r)} title="Editar">✎</button>
                  <button className="btn-del" onClick={()=>deleteReport(r.id)}>✕</button>
                </div>
              </div>
              <div className="report-metrics">
                <div className="metric-cell"><div className="metric-val">{r.leads}</div><div className="metric-lbl">Leads</div></div>
                <div className="metric-cell"><div className="metric-val">${Number(r.spend).toFixed(0)}</div><div className="metric-lbl">Gasto</div></div>
                <div className="metric-cell"><div className={`metric-val ${cc}`}>${Number(r.cpl).toFixed(1)}</div><div className="metric-lbl">CPL</div></div>
                <div className="metric-cell"><div className="metric-val">{r.leads&&r.spend?(r.leads/r.spend).toFixed(1)+'x':'—'}</div><div className="metric-lbl">Lead/$</div></div>
              </div>
              {r.notes&&<div className="report-notes">{r.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CLIENTS ────────────────────────────────────────────────
function ClientsView({clients, ventas, fetchAll}) {
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [modalClient, setModalClient] = useState(null)
  const [vForm, setVForm] = useState({description:'',amount:'',date:new Date().toISOString().slice(0,10)})
  const [form, setForm] = useState({name:'',country:'',start_date:'',end_date:'',duration_months:3,estado:'activo',objetivo:'',facturacion:'',problema:''})

  const clientVentas = (id) => ventas.filter(v=>v.client_id===id)
  const totalComis = (id) => totalComisiones(clientVentas(id))
  const pct = (id) => Math.min(100,Math.round(totalComis(id)/GOAL*100))
  const totalLeads = clients.reduce((s,c)=>s+(c.leads||0),0)
  const totalSpend = clients.reduce((s,c)=>s+Number(c.spend||0),0)
  const totalComisAll = clients.reduce((s,c)=>s+totalComis(c.id),0)
  const renewals = clients.filter(c=>{const d=daysLeft(c.end_date);return d!==null&&d<=21&&d>0&&c.estado!=='completo'})

  const openEdit = (c) => {
    setEditingClient(c.id)
    setForm({name:c.name,country:c.country||'',start_date:c.start_date||'',end_date:c.end_date||'',duration_months:c.duration_months||3,estado:c.estado,objetivo:c.objetivo||'',facturacion:c.facturacion||'',problema:c.problema||''})
    setShowForm(true)
  }

  const saveClient = async () => {
    if (!form.name.trim()) return
    if (editingClient) {
      await supabase.from('clients').update(form).eq('id',editingClient)
      setEditingClient(null)
    } else {
      const color = COLORS[clients.length%COLORS.length]
      await supabase.from('clients').insert({...form,color,leads:0,spend:0})
    }
    setForm({name:'',country:'',start_date:'',end_date:'',duration_months:3,estado:'activo',objetivo:'',facturacion:'',problema:''})
    setShowForm(false)
    fetchAll()
  }

  const cancelForm = () => { setShowForm(false); setEditingClient(null) }
  const deleteClient = async (id) => { if (!window.confirm('¿Eliminar este cliente?')) return; await supabase.from('clients').delete().eq('id',id); fetchAll() }
  const saveVenta = async () => {
    if (!vForm.amount||!vForm.description) return
    await supabase.from('ventas').insert({client_id:modalClient,description:vForm.description,amount:Number(vForm.amount),date:vForm.date})
    setModalClient(null)
    setVForm({description:'',amount:'',date:new Date().toISOString().slice(0,10)})
    fetchAll()
  }
  const deleteVenta = async (id) => { await supabase.from('ventas').delete().eq('id',id); fetchAll() }

  return (
    <div className="view">
      <div className="summary-strip">
        <div className="sum-card"><div className="sum-num">{clients.length}</div><div className="sum-lbl">Clientes</div></div>
        <div className="sum-card"><div className="sum-num">{totalLeads}</div><div className="sum-lbl">Leads totales</div></div>
        <div className="sum-card"><div className="sum-num">${Math.round(totalSpend)}</div><div className="sum-lbl">Pauta invertida</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--green)'}}>${Math.round(totalComisAll).toLocaleString()}</div><div className="sum-lbl">Comisiones</div></div>
      </div>
      {renewals.map(c=>(
        <div key={c.id} className="renewal-banner">⚠️ <strong>{c.name}</strong> — programa vence en <strong>{daysLeft(c.end_date)} días</strong>. Gestionar renovación.</div>
      ))}
      <div className="topbar">
        <h2>Clientes activos</h2>
        <button className="btn-add" onClick={()=>{setEditingClient(null);setForm({name:'',country:'',start_date:'',end_date:'',duration_months:3,estado:'activo',objetivo:'',facturacion:'',problema:''});setShowForm(!showForm)}}>＋ Nuevo cliente</button>
      </div>
      {showForm && (
        <div className="form-panel">
          <div style={{font:'600 13px Inter',color:'var(--text)',marginBottom:12}}>{editingClient?'Editar cliente':'Nuevo cliente'}</div>
          <div className="form-grid">
            <div className="form-field"><label>Nombre *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre del cliente"/></div>
            <div className="form-field"><label>País / Ciudad</label><input value={form.country} onChange={e=>setForm({...form,country:e.target.value})} placeholder="ej: Asunción, Paraguay"/></div>
          </div>
          <div className="form-grid cols3">
            <div className="form-field"><label>Fecha inicio</label><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></div>
            <div className="form-field"><label>Fecha fin</label><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></div>
            <div className="form-field"><label>Estado</label><select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option value="activo">Activo</option><option value="riesgo">En riesgo</option><option value="completo">Programa completo</option></select></div>
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Objetivo</label><input value={form.objetivo} onChange={e=>setForm({...form,objetivo:e.target.value})} placeholder="ej: $5.000/mes"/></div>
            <div className="form-field"><label>Facturación al inicio</label><input value={form.facturacion} onChange={e=>setForm({...form,facturacion:e.target.value})} placeholder="ej: $2.000/mes"/></div>
          </div>
          <div className="form-grid full"><div className="form-field"><label>Problema principal</label><input value={form.problema} onChange={e=>setForm({...form,problema:e.target.value})} placeholder="ej: Depende del boca a boca"/></div></div>
          <div className="form-actions"><button className="btn-cancel" onClick={cancelForm}>Cancelar</button><button className="btn-save" onClick={saveClient}>{editingClient?'Guardar cambios':'Guardar'}</button></div>
        </div>
      )}
      <div className="list">
        {clients.map((c,i)=>{
          const cv=clientVentas(c.id)
          const comis=totalComis(c.id)
          const p=pct(c.id)
          const bc=barColor(p)
          const dl=daysLeft(c.end_date)
          const isExpanded=expanded===c.id
          return (
            <div key={c.id} className={`client-card ${isExpanded?'expanded':''}`}>
              <div className="client-header" onClick={()=>setExpanded(isExpanded?null:c.id)}>
                <div className="client-header-left">
                  <div className="client-avatar" style={{background:c.color+'22',color:c.color}}>{initials(c.name)}</div>
                  <div><div className="client-name">{c.name}</div><div className="client-country">{c.country}</div></div>
                </div>
                <div className="client-header-right">
                  {dl!==null&&dl<=7&&dl>0&&<span className="badge b-urgent">{dl}d restantes</span>}
                  {dl!==null&&dl>7&&dl<=21&&<span className="badge b-warn">{dl}d restantes</span>}
                  {dl!==null&&dl>21&&<span className="badge b-normal">{dl}d restantes</span>}
                  {dl!==null&&dl<=0&&<span className="badge b-muted">Finalizado</span>}
                  <span className={`estado-badge e-${c.estado}`}>{c.estado==='activo'?'Activo':c.estado==='riesgo'?'En riesgo':'Completo'}</span>
                  <div className="progress-wrap"><div className="progress-bar-bg"><div className="progress-bar-fill" style={{width:`${p}%`,background:bc}}/></div><div className="progress-label">{p}% de $10K</div></div>
                  <button className="btn-edit" onClick={e=>{e.stopPropagation();openEdit(c)}} title="Editar">✎</button>
                  <button className="btn-del" onClick={e=>{e.stopPropagation();deleteClient(c.id)}}>✕</button>
                  <span className="chevron">{isExpanded?'▲':'▼'}</span>
                </div>
              </div>
              {isExpanded&&(
                <div className="client-body">
                  <div className="client-metrics">
                    {[{v:c.leads,l:'Leads'},{v:'$'+Math.round(c.spend),l:'Pauta'},{v:c.leads&&c.spend?(c.spend/c.leads).toFixed(1):'-',l:'CPL'},{v:c.leads&&c.spend?(c.leads/c.spend).toFixed(1)+'x':'-',l:'ROAS'},{v:'$'+comis.toLocaleString(),l:'Comisionado',color:'var(--green)'},{v:'$'+Math.max(0,GOAL-comis).toLocaleString(),l:'Faltan',color:comis>=GOAL?'var(--green)':'var(--yellow)'}].map((m,i)=>(
                      <div key={i} className="cm-cell"><div className="cm-val" style={m.color?{color:m.color}:{}}>{m.v}</div><div className="cm-lbl">{m.l}</div></div>
                    ))}
                  </div>
                  {(c.objetivo||c.facturacion||c.problema)&&(
                    <div className="client-info">
                      {c.objetivo&&<div><div className="cm-lbl">Objetivo</div><div className="info-val">{c.objetivo}</div></div>}
                      {c.facturacion&&<div><div className="cm-lbl">Facturación al inicio</div><div className="info-val">{c.facturacion}</div></div>}
                      {c.problema&&<div><div className="cm-lbl">Problema principal</div><div className="info-val muted">{c.problema}</div></div>}
                    </div>
                  )}
                  <div className="guarantee-section">
                    <div className="guarantee-header"><span>Progreso hacia la garantía de $10.000</span><span className="mono">${comis.toLocaleString()} / ${GOAL.toLocaleString()}</span></div>
                    <div className="guarantee-bar-bg"><div className="guarantee-bar-fill" style={{width:`${p}%`,background:bc}}/></div>
                    <div className="guarantee-footer"><span>{c.start_date?'Inicio: '+c.start_date:''}</span><span className="mono">{p}%</span></div>
                  </div>
                  <div className="ventas-section">
                    <div className="ventas-header"><span className="ventas-title">Ventas y comisiones</span><button className="btn-venta" onClick={()=>setModalClient(c.id)}>＋ Registrar venta</button></div>
                    {cv.length===0&&<div style={{fontSize:12,color:'var(--dim)',fontStyle:'italic'}}>Sin ventas registradas todavía</div>}
                    {cv.map(v=>(
                      <div key={v.id} className="venta-item">
                        <span className="venta-desc">{v.description}</span>
                        <span className="venta-date">{v.date}</span>
                        <span className="venta-amount">+${Number(v.amount).toLocaleString()}</span>
                        <button className="venta-del" onClick={()=>deleteVenta(v.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {modalClient&&(
        <div className="modal-overlay" onClick={()=>setModalClient(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3>Registrar venta / comisión</h3>
            <div className="form-field" style={{marginBottom:10}}><label>Descripción</label><input value={vForm.description} onChange={e=>setVForm({...vForm,description:e.target.value})} placeholder="ej: Venta depto 3 amb."/></div>
            <div className="form-grid" style={{marginBottom:10}}>
              <div className="form-field"><label>Comisión (USD)</label><input type="number" value={vForm.amount} onChange={e=>setVForm({...vForm,amount:e.target.value})}/></div>
              <div className="form-field"><label>Fecha</label><input type="date" value={vForm.date} onChange={e=>setVForm({...vForm,date:e.target.value})}/></div>
            </div>
            <div className="form-actions"><button className="btn-cancel" onClick={()=>setModalClient(null)}>Cancelar</button><button className="btn-save" onClick={saveVenta}>Registrar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PIPELINE ───────────────────────────────────────────────
function AccionablesView({semanal, fetchAll}) {
  const [hechos, setHechos] = useState({})
  const [creando, setCreando] = useState(null)

  const ultima = semanal.length ? semanal[0].fecha : null
  const filas = semanal.filter(f => f.fecha === ultima)

  const items = []
  filas.forEach(f => {
    let acc = f.accionables
    if (typeof acc === 'string') { try { acc = JSON.parse(acc) } catch(e) { acc = [] } }
    if (!Array.isArray(acc)) acc = []
    acc.forEach(a => items.push({
      texto: typeof a === 'string' ? a : (a.texto || ''),
      urgencia: (typeof a === 'object' && a.urgencia) ? a.urgencia : 'media',
      cliente: f.cliente, campana: f.campana
    }))
  })
  filas.forEach(f => {
    if (f.nota_importante && /pago/i.test(f.nota_importante)) {
      items.push({texto: f.nota_importante, urgencia: 'alta', cliente: f.cliente, campana: f.campana})
    }
  })

  const peso = {alta:0, media:1, baja:2}
  items.sort((a,b) => (peso[a.urgencia] ?? 1) - (peso[b.urgencia] ?? 1))

  const acento = u => u==='alta' ? 'var(--red)' : u==='media' ? '#d97706' : 'var(--muted)'

  const aTarea = async (it, k) => {
    setCreando(k)
    await supabase.from('tasks').insert({
      title: it.cliente + ' - ' + it.campana + ': ' + it.texto,
      owner: 'ambos',
      priority: it.urgencia==='alta' ? 'urgent' : 'normal',
      note: 'Accionable de la semana ' + ultima,
      done: false
    })
    setCreando(null)
    setHechos(h => ({...h, [k]: true}))
    fetchAll()
  }

  if (!items.length) return (
    <div style={{padding:20}}>
      <h2 style={{fontSize:16,fontWeight:600,color:'var(--text)',marginBottom:4}}>Accionables de clientes</h2>
      <div style={{fontSize:12,color:'var(--muted)'}}>Todavia no hay accionables cargados.</div>
    </div>
  )

  const urgentes = items.filter(i=>i.urgencia==='alta').length
  const pendientes = items.filter((it,i)=>!hechos[i]).length

  return (
    <div style={{padding:20}}>
      <h2 style={{fontSize:16,fontWeight:600,color:'var(--text)',marginBottom:4}}>Accionables de clientes</h2>
      <div style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>
        Semana del {ultima} &middot; {pendientes} pendientes de {items.length} &middot; {urgentes} urgentes
      </div>
      {items.map((it,i) => {
        const hecho = hechos[i]
        return (
          <div key={i} style={{background:'var(--s2)',border:'1px solid var(--border)',borderLeft:'3px solid '+acento(it.urgencia),borderRadius:8,padding:'12px 14px',marginBottom:8,opacity:hecho?0.45:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <input type="checkbox" checked={!!hecho} onChange={()=>setHechos(h=>({...h,[i]:!h[i]}))} style={{cursor:'pointer',accentColor:'var(--green)'}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:8,alignItems:'baseline',marginBottom:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:700,color:acento(it.urgencia),textTransform:'uppercase',letterSpacing:'0.06em'}}>{it.urgencia}</span>
                  <span style={{fontSize:12,color:'var(--muted)'}}>{it.cliente} &middot; {it.campana}</span>
                </div>
                <div style={{fontSize:14,color:'var(--text)',textDecoration:hecho?'line-through':'none'}}>{it.texto}</div>
              </div>
              <button onClick={()=>aTarea(it,i)} disabled={creando===i||hecho}
                style={{background:'transparent',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:6,padding:'5px 10px',fontSize:12,cursor:hecho?'default':'pointer',whiteSpace:'nowrap'}}>
                {creando===i ? '...' : 'A tarea'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PipelineView({pipeline, clients, fetchAll}) {
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingPipe, setEditingPipe] = useState(null)
  const [form, setForm] = useState({client_name:'',property:'',campaign_type:'venta',stage:'guiones',owner:'felipe',days_in_stage:0,budget_daily:0,geo:'',note:''})

  // Separar activas de las que están en proceso
  const inProgress = pipeline.filter(p=>p.stage!=='activa')
  const activas = pipeline.filter(p=>p.stage==='activa')

  const filtered = filter==='all' ? inProgress :
    filter==='activa' ? activas :
    inProgress.filter(p=>p.stage===filter)

  const blocked = inProgress.filter(p=>p.stage==='esperando'&&p.days_in_stage>=7).length
  const renewSoon = clients.filter(c=>{const d=daysLeft(c.end_date);return d!==null&&d<=21&&d>0&&c.estado!=='completo'}).length
  const counts = {}
  STAGE_ORDER.forEach(s=>counts[s]=pipeline.filter(p=>p.stage===s).length)

  const openEdit = (item) => {
    setEditingPipe(item.id)
    setForm({client_name:item.client_name,property:item.property,campaign_type:item.campaign_type||'venta',stage:item.stage,owner:item.owner,days_in_stage:item.days_in_stage,budget_daily:item.budget_daily||0,geo:item.geo||'',note:item.note||''})
    setShowForm(true)
  }

  const savePipe = async () => {
    if (!form.client_name||!form.property) return
    if (editingPipe) {
      await supabase.from('pipeline').update(form).eq('id',editingPipe)
      setEditingPipe(null)
    } else {
      await supabase.from('pipeline').insert(form)
    }
    setForm({client_name:'',property:'',campaign_type:'venta',stage:'guiones',owner:'felipe',days_in_stage:0,budget_daily:0,geo:'',note:''})
    setShowForm(false)
    fetchAll()
  }

  const cancelForm = () => { setShowForm(false); setEditingPipe(null) }
  const advance = async (item) => {
    const idx=STAGE_ORDER.indexOf(item.stage)
    if (idx<STAGE_ORDER.length-1) { await supabase.from('pipeline').update({stage:STAGE_ORDER[idx+1],days_in_stage:0}).eq('id',item.id); fetchAll() }
  }
  const deletePipe = async (id) => { await supabase.from('pipeline').delete().eq('id',id); fetchAll() }

  const PipeCard = ({p, isActiva=false}) => {
    const isBlocked=p.stage==='esperando'&&p.days_in_stage>=7
    const cardClass=p.stage==='activa'?'pipe-activo':p.stage==='esperando'?'pipe-bloqueado':'pipe-internal'
    const stageIdx=STAGE_ORDER.indexOf(p.stage)
    return (
      <div className={`pipe-card ${cardClass} ${isActiva?'pipe-tachada':''}`}>
        <div>
          <div className="pipe-name" style={isActiva?{textDecoration:'line-through',opacity:0.6}:{}}>{p.client_name}</div>
          <div className="pipe-prop" style={isActiva?{textDecoration:'line-through',opacity:0.6}:{}}>{p.property}</div>
          {!isActiva&&(
            <div className="pipe-stages">
              {STAGE_ORDER.map((s,i)=>{
                let cls='stage-pending'
                if(i<stageIdx)cls='stage-done'
                else if(i===stageIdx)cls=isBlocked?'stage-blocked':'stage-current'
                return <React.Fragment key={s}><span className={`stage ${cls}`}>{STAGE_LABELS[s]}</span>{i<STAGE_ORDER.length-1&&<span className="stage-arrow">›</span>}</React.Fragment>
              })}
            </div>
          )}
          {isActiva&&<span className="badge" style={{background:'var(--gbg)',color:'var(--green)',border:'1px solid var(--gbd)',fontSize:11,marginTop:4,display:'inline-block'}}>✓ Activa — {p.days_in_stage}d corriendo</span>}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
            {p.campaign_type&&<span className="badge b-normal" style={{fontSize:10}}>{({venta:'Venta',captacion:'Captación leads',reclutamiento:'Reclutamiento',alquiler:'Alquiler'})[p.campaign_type]||p.campaign_type}</span>}
            {p.geo&&<span className="badge b-normal" style={{fontSize:10}}>📍 {p.geo}</span>}
            {p.budget_daily>0&&<span className="badge b-normal" style={{fontSize:10}}>💰 ${p.budget_daily}/día</span>}
          </div>
          {p.note&&<div className="pipe-note">{p.note}</div>}
        </div>
        <div className="pipe-right">
          {!isActiva&&<div className={`pipe-days ${isBlocked?'warn':''}`}>{p.days_in_stage}d en etapa</div>}
          <div className="pipe-owner">{OWNER_LABELS[p.owner]||p.owner}</div>
          <div style={{display:'flex',gap:4}}>
            {!isActiva&&<button className="btn-advance" onClick={()=>advance(p)} title="Avanzar etapa">›</button>}
            <button className="btn-edit" onClick={()=>openEdit(p)} title="Editar">✎</button>
            <button className="btn-del" onClick={()=>deletePipe(p.id)}>✕</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="view">
      <div className="summary-strip" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        <div className="sum-card"><div className="sum-num">{pipeline.length}</div><div className="sum-lbl">Total</div></div>
        <div className="sum-card"><div className="sum-num">{counts.guiones||0}</div><div className="sum-lbl">Guiones</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:counts.esperando>5?'var(--orange)':''}}>{counts.esperando||0}</div><div className="sum-lbl">Esperando</div></div>
        <div className="sum-card"><div className="sum-num">{counts.edicion||0}</div><div className="sum-lbl">Edición</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--green)'}}>{counts.activa||0}</div><div className="sum-lbl">Activas</div></div>
      </div>
      {blocked>0&&<div className="alert-chip blocked">⚠️ {blocked} campaña{blocked>1?'s':''} bloqueada{blocked>1?'s':''} hace más de 7 días esperando grabación</div>}
      {renewSoon>0&&<div className="alert-chip renewal" style={{marginTop:8}}>🔄 {renewSoon} cliente{renewSoon>1?'s':''} con programa por vencer en 21 días</div>}
      <div className="topbar" style={{marginTop:16}}>
        <h2>Pipeline de producción</h2>
        <button className="btn-add" onClick={()=>{setEditingPipe(null);setShowForm(!showForm)}}>＋ Nueva campaña</button>
      </div>
      {showForm&&(
        <div className="form-panel">
          <div style={{font:'600 13px Inter',color:'var(--text)',marginBottom:12}}>{editingPipe?'Editar campaña':'Nueva campaña'}</div>
          <div className="form-grid">
            <div className="form-field"><label>Cliente *</label><input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Nombre del cliente"/></div>
            <div className="form-field"><label>Propiedad / Campaña *</label><input value={form.property} onChange={e=>setForm({...form,property:e.target.value})} placeholder="ej: Insignia 10"/></div>
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Tipo de campaña</label>
              <select value={form.campaign_type} onChange={e=>setForm({...form,campaign_type:e.target.value})}>
                <option value="venta">Venta</option>
                <option value="captacion">Captación de leads</option>
                <option value="reclutamiento">Reclutamiento de agentes</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>
            <div className="form-field"><label>Delimitación geográfica</label><input value={form.geo} onChange={e=>setForm({...form,geo:e.target.value})} placeholder="ej: Argentina, Paraguay"/></div>
          </div>
          <div className="form-grid cols3">
            <div className="form-field"><label>Etapa</label><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{STAGE_ORDER.map(s=><option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select></div>
            <div className="form-field"><label>Responsable</label><select value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}><option value="felipe">Felipe</option><option value="christian">Christian</option><option value="cliente">Cliente</option></select></div>
            <div className="form-field"><label>Presupuesto diario (USD)</label><input type="number" value={form.budget_daily} onChange={e=>setForm({...form,budget_daily:Number(e.target.value)})} placeholder="0"/></div>
          </div>
          <div className="form-field" style={{marginBottom:10}}><label>Nota</label><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="ej: Grabó 3 videos, falta España"/></div>
          <div className="form-actions"><button className="btn-cancel" onClick={cancelForm}>Cancelar</button><button className="btn-save" onClick={savePipe}>{editingPipe?'Guardar cambios':'Guardar'}</button></div>
        </div>
      )}
      <div className="filters">
        {[['all','En proceso'],['esperando','Bloqueadas'],['guiones','Guiones'],['edicion','Edición'],['lanzar','Para lanzar'],['activa','Activas']].map(([f,l])=>(
          <button key={f} className={`filter ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>

      {/* Campañas en proceso */}
      {filter!=='activa'&&(
        <div className="list">
          {filtered.length===0&&<div className="empty">Sin campañas en proceso</div>}
          {filtered.map(p=><PipeCard key={p.id} p={p}/>)}
        </div>
      )}

      {/* Sección campañas activas - siempre visible abajo o al filtrar */}
      {(filter==='all'||filter==='activa')&&activas.length>0&&(
        <>
          <div style={{margin:'20px 0 10px',fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',display:'flex',alignItems:'center',gap:10}}>
            <span style={{color:'var(--green)'}}>●</span> Campañas activas ({activas.length})
            <div style={{flex:1,height:1,background:'var(--border)'}}/>
          </div>
          <div className="list">
            {activas.map(p=><PipeCard key={p.id} p={p} isActiva={true}/>)}
          </div>
        </>
      )}
      {filter==='activa'&&activas.length===0&&<div className="empty">Sin campañas activas</div>}
    </div>
  )
}

// ── CONTENT ────────────────────────────────────────────────
function ContentView({content, fetchAll}) {
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingContent, setEditingContent] = useState(null)
  const [form, setForm] = useState({hook:'',category:'problema',status:'pendiente',format:'Reel',publish_date:''})

  const filtered = content.filter(c=>{
    if(filter==='pendiente')return c.status==='pendiente'
    if(filter==='prep')return c.status==='prep'
    if(filter==='subido')return c.status==='subido'
    if(['problema','resultado','friccion','volumen','ads'].includes(filter))return c.category===filter
    return true
  })

  const subido=content.filter(c=>c.status==='subido').length
  const pendiente=content.filter(c=>c.status==='pendiente').length
  const prep=content.filter(c=>c.status==='prep').length

  const openEdit = (item) => {
    setEditingContent(item.id)
    setForm({hook:item.hook,category:item.category,status:item.status,format:item.format,publish_date:item.publish_date||''})
    setShowForm(true)
  }

  const saveContent = async () => {
    if (!form.hook.trim()) return
    if (editingContent) {
      await supabase.from('content').update(form).eq('id',editingContent)
      setEditingContent(null)
    } else {
      await supabase.from('content').insert(form)
    }
    setForm({hook:'',category:'problema',status:'pendiente',format:'Reel',publish_date:''})
    setShowForm(false)
    fetchAll()
  }

  const cancelForm = () => { setShowForm(false); setEditingContent(null) }
  const deleteContent = async (id) => { await supabase.from('content').delete().eq('id',id); fetchAll() }

  const catCls={problema:'cat-problema',resultado:'cat-resultado',friccion:'cat-friccion',volumen:'cat-volumen',ads:'cat-ads'}
  const stCls={subido:'cs-subido',pendiente:'cs-pendiente',prep:'cs-prep'}
  const stLabel={subido:'Subido',pendiente:'Pendiente',prep:'En preparación'}

  return (
    <div className="view">
      <div className="summary-strip">
        <div className="sum-card"><div className="sum-num">{content.length}</div><div className="sum-lbl">Ideas totales</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--green)'}}>{subido}</div><div className="sum-lbl">Subidos</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--blue)'}}>{prep}</div><div className="sum-lbl">En preparación</div></div>
        <div className="sum-card"><div className="sum-num" style={{color:'var(--yellow)'}}>{pendiente}</div><div className="sum-lbl">Pendientes</div></div>
      </div>
      <div className="topbar"><h2>Banco de contenido orgánico</h2><button className="btn-add" onClick={()=>{setEditingContent(null);setShowForm(!showForm)}}>＋ Nueva idea</button></div>
      {showForm&&(
        <div className="form-panel">
          <div style={{font:'600 13px Inter',color:'var(--text)',marginBottom:12}}>{editingContent?'Editar idea':'Nueva idea'}</div>
          <div className="form-field" style={{marginBottom:10}}><label>Hook / Apertura *</label><input value={form.hook} onChange={e=>setForm({...form,hook:e.target.value})} placeholder="La primera frase del video..."/></div>
          <div className="form-grid cols3">
            <div className="form-field"><label>Categoría</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{Object.entries(CAT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div className="form-field"><label>Estado</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="pendiente">Pendiente</option><option value="prep">En preparación</option><option value="subido">Subido</option></select></div>
            <div className="form-field"><label>Formato</label><select value={form.format} onChange={e=>setForm({...form,format:e.target.value})}>{['Reel','Carrusel','Historia','Improvisado'].map(f=><option key={f} value={f}>{f}</option>)}</select></div>
          </div>
          <div className="form-actions"><button className="btn-cancel" onClick={cancelForm}>Cancelar</button><button className="btn-save" onClick={saveContent}>{editingContent?'Guardar cambios':'Guardar'}</button></div>
        </div>
      )}
      <div className="filters">
        {[['all','Todo'],['pendiente','Pendientes'],['prep','En preparación'],['subido','Subidos'],['problema','🔴 Problema'],['resultado','🟢 Resultado'],['friccion','🟡 Fricción']].map(([f,l])=>(
          <button key={f} className={`filter ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>
      <div className="content-grid">
        {filtered.length===0&&<div className="empty">Sin contenido</div>}
        {filtered.map(c=>(
          <div key={c.id} className={`content-card ${c.status}`}>
            <div className="content-header">
              <span className={`content-cat ${catCls[c.category]||''}`}>{CAT_LABELS[c.category]||c.category}</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span className={`content-status ${stCls[c.status]||''}`}>{stLabel[c.status]||c.status}</span>
                <button className="btn-edit" onClick={()=>openEdit(c)} title="Editar">✎</button>
                <button className="btn-del" onClick={()=>deleteContent(c.id)}>✕</button>
              </div>
            </div>
            <div className="content-hook">{c.hook}</div>
            <div className="content-meta">
              {c.format&&<span className="content-format">{c.format}</span>}
              {c.publish_date&&<span className="mono" style={{fontSize:11,color:'var(--muted)'}}>{c.publish_date}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
