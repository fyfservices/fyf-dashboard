import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'

const GOAL = 10000

export default function AIAssistant({ clients, ventas, tasks, pipeline, reports, content, fetchAll }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '¡Hola! Soy tu asistente de F&F Services. Puedo ayudarte a consultar clientes, tareas, pipeline y más. También puedo crear tareas si me lo pedís. ¿En qué te ayudo?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const totalComisiones = (clientId) => (ventas||[]).filter(v=>v.client_id===clientId).reduce((s,v)=>s+Number(v.amount),0)
  const daysLeft = (endDate) => { if (!endDate) return null; return Math.ceil((new Date(endDate) - new Date()) / (1000*60*60*24)) }

  const buildContext = () => {
    const today = new Date().toISOString().slice(0,10)

    const clientsSummary = clients.map(c => {
      const comis = totalComisiones(c.id)
      const dl = daysLeft(c.end_date)
      const cv = (ventas||[]).filter(v=>v.client_id===c.id)
      return `- ${c.name} (${c.country||''}): ${c.leads} leads, $${Math.round(c.spend)} USD pauta, $${comis.toLocaleString()} USD comisiones, ${Math.min(100,Math.round(comis/GOAL*100))}% de la garantía. Estado: ${c.estado}. ${dl!==null?`Días restantes: ${dl}.`:''}`
    }).join('\n')

    const urgentTasks = tasks.filter(t=>!t.done&&t.priority==='urgent')
    const pendingTasks = tasks.filter(t=>!t.done)
    const tasksSummary = pendingTasks.map(t => {
      const late = t.deadline && t.deadline < today
      return `- [${t.priority==='urgent'?'URGENTE':'Normal'}] ${t.title} → ${t.owner} ${t.deadline?`(${late?'VENCIDA: ':''}${t.deadline})`:'(sin deadline)'}`
    }).join('\n')

    const blockedPipe = pipeline.filter(p=>p.stage==='esperando'&&p.days_in_stage>=7)
    const pipelineSummary = pipeline.map(p =>
      `- ${p.client_name} | ${p.property} | Etapa: ${p.stage} | ${p.days_in_stage}d en etapa | Responsable: ${p.owner}`
    ).join('\n')

    const renewalsSoon = clients.filter(c => {
      const d = daysLeft(c.end_date)
      return d !== null && d <= 21 && d > 0 && c.estado !== 'completo'
    })

    return `Sos el asistente de F&F Services, una agencia de marketing inmobiliario en LATAM. Hoy es ${today}.

RESUMEN GENERAL:
- Clientes activos: ${clients.length}
- Total leads generados: ${clients.reduce((s,c)=>s+c.leads,0)}
- Total pauta invertida: $${Math.round(clients.reduce((s,c)=>s+Number(c.spend||0),0))} USD
- Total comisiones generadas: $${clients.reduce((s,c)=>s+totalComisiones(c.id),0).toLocaleString()} USD
- Tareas urgentes pendientes: ${urgentTasks.length}
- Campañas bloqueadas (+7 días esperando): ${blockedPipe.length}
- Clientes con programa por vencer (21 días): ${renewalsSoon.length}

CLIENTES Y SUS MÉTRICAS:
${clientsSummary}

TAREAS PENDIENTES (${pendingTasks.length} total):
${tasksSummary||'No hay tareas pendientes.'}

PIPELINE DE PRODUCCIÓN:
${pipelineSummary||'No hay campañas en pipeline.'}

CLIENTES CON RENOVACIÓN PRÓXIMA:
${renewalsSoon.length>0?renewalsSoon.map(c=>`- ${c.name}: vence en ${daysLeft(c.end_date)} días (${c.end_date})`).join('\n'):'Ninguno en los próximos 21 días.'}

INSTRUCCIONES IMPORTANTES:
- Respondé siempre en español, de forma directa y concisa.
- Si el usuario pide crear una tarea, respondé con un JSON especial al final de tu respuesta en este formato exacto: [CREAR_TAREA:{"title":"...","owner":"fran|felipe|christian|ambos","priority":"urgent|normal","deadline":"YYYY-MM-DD o null","note":"..."}]
- Si el usuario pide un resumen, dalo de forma clara y organizada.
- Si el usuario pregunta por un cliente específico, dale toda la información disponible de ese cliente.
- Tratá al usuario de vos, con tono directo y profesional.`
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const context = buildContext()
      const conversationHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text
      }))

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1000,
          system: context,
          messages: [...conversationHistory, { role: 'user', content: userMsg }]
        })
      })

      const data = await response.json()
      const rawText = data.content?.find(b => b.type === 'text')?.text || 'No pude procesar esa solicitud.'

      // Check if response contains a task creation command
      const taskMatch = rawText.match(/\[CREAR_TAREA:(.*?)\]/)
      let displayText = rawText.replace(/\[CREAR_TAREA:.*?\]/s, '').trim()

      if (taskMatch) {
        try {
          const taskData = JSON.parse(taskMatch[1])
          await supabase.from('tasks').insert({
            title: taskData.title,
            owner: taskData.owner || 'ambos',
            priority: taskData.priority || 'normal',
            deadline: taskData.deadline || null,
            note: taskData.note || '',
            done: false
          })
          fetchAll()
          displayText += '\n\n✅ Tarea creada en el dashboard.'
        } catch(e) {
          displayText += '\n\n⚠️ Intenté crear la tarea pero hubo un error.'
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', text: displayText }])
    } catch(e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Hubo un error al procesar tu consulta. Intentá de nuevo.' }])
    }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const quickActions = [
    '¿Qué tengo urgente hoy?',
    'Resumen general de clientes',
    '¿Qué campañas están bloqueadas?',
    '¿Qué renovaciones hay próximas?',
  ]

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#333' : '#4CAF50',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, zIndex: 1000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'background 0.2s'
        }}
        title="Asistente F&F"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24,
          width: 360, height: 520,
          background: '#1A1E1A', border: '1px solid #2A302A',
          borderRadius: 12, zIndex: 999,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontFamily: 'Inter, system-ui, sans-serif',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', background: '#131613',
            borderBottom: '1px solid #2A302A',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#4CAF50', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#000', fontWeight: 700
            }}>✦</div>
            <div>
              <div style={{fontSize: 13, fontWeight: 600, color: '#E2E8E2'}}>Asistente F&F</div>
              <div style={{fontSize: 11, color: '#4CAF50'}}>● Online — acceso completo al dashboard</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#4CAF50' : '#222622',
                  color: m.role === 'user' ? '#000' : '#E2E8E2',
                  padding: '8px 12px', borderRadius: 8,
                  fontSize: 13, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{display:'flex',justifyContent:'flex-start'}}>
                <div style={{
                  background: '#222622', padding: '8px 14px',
                  borderRadius: 8, fontSize: 13, color: '#7A8A7A'
                }}>
                  <span style={{animation:'pulse 1s infinite'}}>Pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && (
            <div style={{
              padding: '0 12px 8px',
              display: 'flex', flexWrap: 'wrap', gap: 6
            }}>
              {quickActions.map((q, i) => (
                <button key={i} onClick={() => { setInput(q); }}
                  style={{
                    background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.25)',
                    color: '#4CAF50', borderRadius: 6, padding: '4px 10px',
                    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit'
                  }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #2A302A',
            display: 'flex', gap: 8, alignItems: 'flex-end'
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Preguntá algo o pedí crear una tarea..."
              rows={2}
              style={{
                flex: 1, background: '#222622', border: '1px solid #2A302A',
                borderRadius: 6, color: '#E2E8E2', padding: '8px 10px',
                fontSize: 13, fontFamily: 'inherit', resize: 'none',
                outline: 'none', lineHeight: 1.4
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? '#2A302A' : '#4CAF50',
                border: 'none', borderRadius: 6, padding: '8px 12px',
                color: loading || !input.trim() ? '#4A574A' : '#000',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                fontSize: 16, flexShrink: 0
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
