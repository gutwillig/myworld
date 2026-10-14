// Supabase Edge Function for Server-Side Rendered OG Meta Tags
// This function serves HTML with OG tags for crawlers, then redirects to the SPA

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known crawler user agents
const CRAWLER_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /discordbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /pinterest/i,
  /embedly/i,
  /quora link preview/i,
  /outbrain/i,
  /rogerbot/i,
  /showyoubot/i,
  /vkshare/i,
  /w3c_validator/i,
  /redditbot/i,
  /applebot/i,
];

function isCrawler(userAgent: string): boolean {
  return CRAWLER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Expected path: /w/:world or /w/:world/:building
  if (pathParts.length < 2 || pathParts[0] !== "w") {
    return new Response("Not found", { status: 404 });
  }

  const worldSlug = pathParts[1];
  const buildingSlug = pathParts[2];

  // Check if this is a crawler
  const userAgent = req.headers.get("user-agent") || "";
  const shouldServeOg = isCrawler(userAgent);

  // If not a crawler, redirect to the SPA
  if (!shouldServeOg) {
    const spaUrl = `${url.origin}/${url.pathname}`;
    return Response.redirect(spaUrl, 302);
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch the world from the database
    const { data: world, error } = await supabase
      .from("worlds")
      .select("*")
      .eq("slug", worldSlug)
      .maybeSingle();

    if (error || !world) {
      return new Response("World not found", { status: 404 });
    }

    // Extract world data
    const worldData = world.data?.world as {
      ownerName?: string;
      buildings?: Array<{ slug: string; name: string; oneLiner?: string; type: string }>;
    } | null;

    if (!worldData) {
      return new Response("Invalid world data", { status: 500 });
    }

    // Prepare OG tags
    let title = `${worldData.ownerName || "Someone"}'s world`;
    let description = "A personal world built on myworld.";
    const ogImage = world.og_image_url || "";

    // If a building is specified, use its details
    if (buildingSlug && worldData.buildings) {
      const building = worldData.buildings.find((b) => b.slug === buildingSlug);
      if (building) {
        title = `${building.name} · ${worldData.ownerName || "Someone"}'s world`;
        description = building.oneLiner || `A ${building.type} in ${worldData.ownerName || "someone"}'s world.`;
      }
    }

    // Build the canonical URL
    const canonicalUrl = buildingSlug
      ? `${url.origin}/w/${worldSlug}/${buildingSlug}`
      : `${url.origin}/w/${worldSlug}`;

    // Build the HTML with OG tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} · myworld</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ""}

  <!-- Redirect to SPA for JavaScript clients -->
  <script>
    window.location.replace("${escapeHtml(canonicalUrl)}");
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
  </noscript>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });
  } catch (err) {
    console.error("Error fetching world:", err);
    return new Response("Internal server error", { status: 500 });
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
