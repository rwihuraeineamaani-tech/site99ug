import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const appId = '1:1066442121439:web:f62d74e86cb4f182e0096a'
const projectId = 'database-f4b47'
const vapidKey = 'BLx7bedwKwMJwl-WKGt-PQhl94_3A3jql5558ZtEqu_y135cApqf1zg9nITsR2Eke9PRhkLJdAIPD-0TvgI4Mu8'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }
  const apiKey = Deno.env.get('VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY')
  if (!apiKey) return new Response(JSON.stringify({ error: 'Push is not configured' }), { status: 503, headers })
  return new Response(JSON.stringify({
    apiKey,
    projectId,
    appId,
    vapidKey,
    messagingSenderId: appId.split(':')[1],
  }), { headers })
})
