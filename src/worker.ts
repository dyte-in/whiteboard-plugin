export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return env.ASSETS.fetch(request)
  },
}
