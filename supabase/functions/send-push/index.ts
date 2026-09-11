import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.25.76'

const BodySchema = z.object({ test: z.boolean().optional() }).strict()
const gateway = 'https://connector-gateway.lovable.dev/firebase_messaging'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    const connectionKey = Deno.env.get('FIREBASE_MESSAGING_API_KEY')
    if (!url || !serviceKey || !lovableKey || !connectionKey) throw new Error('Push delivery is not configured')
    const admin = createClient(url, serviceKey)
    const body = req.method === 'POST' ? BodySchema.safeParse(await req.json().catch(() => ({}))) : BodySchema.safeParse({})
    if (!body.success) return new Response(JSON.stringify({ error: body.error.flatten().fieldErrors }), { status: 400, headers })

    let signedInUser: string | null = null
    const auth = req.headers.get('Authorization')
    if (auth?.startsWith('Bearer ')) {
      const { data } = await admin.auth.getUser(auth.slice(7))
      signedInUser = data.user?.id ?? null
    }
    if (body.data.test) {
      if (!signedInUser) return new Response(JSON.stringify({ error: 'Sign in first' }), { status: 401, headers })
      await admin.from('push_outbox').upsert({ recipient_user_id: signedInUser, actor_user_id: null, category: 'tasks', event_type: 'test', title: 'Site 99 notifications are on', body: 'This device is ready for work alerts.', path: '/app/settings', event_key: `test:${signedInUser}:${Date.now()}` }, { onConflict: 'event_key' })
    }

    await admin.rpc('prepare_due_push_reminders', { _now: new Date().toISOString() })

    let query = admin.from('push_outbox').select('*').in('status', ['pending', 'failed']).lte('available_at', new Date().toISOString()).lt('attempts', 5).order('created_at').limit(40)
    if (body.data.test && signedInUser) query = query.eq('recipient_user_id', signedInUser).eq('event_type', 'test')
    const { data: rows, error: rowsError } = await query
    if (rowsError) throw rowsError
    let delivered = 0
    for (const row of rows ?? []) {
      const { data: claimed } = await admin.from('push_outbox').update({ status: 'processing' }).eq('id', row.id).in('status', ['pending', 'failed']).select('id').maybeSingle()
      if (!claimed) continue
      const { data: pref } = await admin.from('push_preferences').select('*').eq('user_id', row.recipient_user_id).maybeSingle()
      const prefKey = row.category === 'tasks' ? 'tasks_enabled' : row.category === 'approvals' ? 'approvals_enabled' : row.category === 'finance' ? 'finance_enabled' : 'communications_enabled'
      if (pref && pref[prefKey] === false) { await admin.from('push_outbox').update({ status: 'skipped', processed_at: new Date().toISOString() }).eq('id', row.id); continue }
      const { data: devices } = await admin.from('push_devices').select('id,token').eq('user_id', row.recipient_user_id).eq('active', true)
      if (!devices?.length) { await admin.from('push_outbox').update({ status: 'skipped', processed_at: new Date().toISOString(), last_error: 'No active device' }).eq('id', row.id); continue }
      let anySent = false
      for (const device of devices) {
        const response = await fetch(`${gateway}/v1/projects/_/messages:send`, { method: 'POST', headers: { Authorization: `Bearer ${lovableKey}`, 'X-Connection-Api-Key': connectionKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { token: device.token, data: { title: row.title, body: row.body, path: row.path, eventKey: row.event_key }, webpush: { fcm_options: { link: new URL(row.path, req.headers.get('origin') || 'https://site99ug.com').href } } } }) })
        const detail = await response.text()
        const stale = response.status === 404 || (response.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/i.test(detail))
        await admin.from('push_delivery_log').insert({ outbox_id: row.id, device_id: device.id, recipient_user_id: row.recipient_user_id, status: response.ok ? 'sent' : stale ? 'stale' : 'failed', provider_status: response.status, error_detail: response.ok ? null : detail.slice(0, 1000) })
        if (stale) await admin.from('push_devices').update({ active: false }).eq('id', device.id)
        anySent ||= response.ok
      }
      await admin.from('push_outbox').update({ status: anySent ? 'sent' : 'failed', attempts: row.attempts + 1, processed_at: anySent ? new Date().toISOString() : null, available_at: anySent ? row.available_at : new Date(Date.now() + Math.min(15, 2 ** row.attempts) * 60000).toISOString() }).eq('id', row.id)
      if (anySent) delivered++
    }
    return new Response(JSON.stringify({ processed: rows?.length ?? 0, delivered }), { headers })
  } catch (error) {
    console.error('Push dispatch failed', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Push dispatch failed' }), { status: 500, headers })
  }
})