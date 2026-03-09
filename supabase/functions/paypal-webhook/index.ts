// DEPRECATED — Replaced by Paddle. Do not use. Kept for reference only. Will be deleted after Paddle is confirmed working.

Deno.serve(async (req) => {
  return new Response(JSON.stringify({ error: "This endpoint is deprecated. Use Paddle." }), { status: 410, headers: { "Content-Type": "application/json" } });
});
