import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  pdf: "application/pdf", ico: "image/x-icon",
};

function extractEventId(bucket: string, filePath: string): string | null {
  const parts = filePath.split("/");
  if (bucket === "event-assets") {
    return parts.length >= 2 ? parts[1] : null;
  }
  if (bucket === "dress-code-images") {
    return parts.length >= 1 ? parts[0] : null;
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    const fnIdx = pathParts.indexOf("serve-event-asset");
    if (fnIdx === -1 || pathParts.length < fnIdx + 3) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    const bucket = pathParts[fnIdx + 1];
    const filePath = pathParts.slice(fnIdx + 2).join("/");

    if (!["event-assets", "dress-code-images"].includes(bucket)) {
      return new Response("Unknown bucket", { status: 400, headers: corsHeaders });
    }

    const eventId = extractEventId(bucket, filePath);
    if (!eventId || !UUID_RE.test(eventId)) {
      return new Response("Cannot determine event", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: event } = await adminClient
      .from("events")
      .select("id, status, created_by")
      .eq("id", eventId)
      .single();

    if (!event) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const isPublic = event.status === "published" || event.status === "ongoing";

    if (!isPublic) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();

      if (!user) {
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      const isOwner = event.created_by === user.id;
      if (!isOwner) {
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          return new Response("Forbidden", { status: 403, headers: corsHeaders });
        }
      }
    }

    const { data, error } = await adminClient.storage.from(bucket).download(filePath);
    if (error || !data) {
      return new Response("File not found", { status: 404, headers: corsHeaders });
    }

    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    return new Response(data, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": isPublic
          ? "public, max-age=3600, s-maxage=86400"
          : "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("serve-event-asset error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
