import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get world and building from query params (set by vercel.json rewrite)
  const worldSlug = req.query.world as string;
  const buildingSlug = req.query.building as string | undefined;

  if (!worldSlug) {
    return res.status(404).send("Not found");
  }

  // Construct origin from request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const origin = `${protocol}://${host}`;

  return handleOgRequest(req, res, worldSlug, buildingSlug, origin);
}

async function handleOgRequest(
  req: VercelRequest,
  res: VercelResponse,
  worldSlug: string,
  buildingSlug: string | undefined,
  origin: string
) {
  // Check if this is a crawler
  const userAgent = (req.headers["user-agent"] as string) || "";
  const shouldServeOg = isCrawler(userAgent);

  // Build the canonical URL
  const canonicalUrl = buildingSlug
    ? `${origin}/w/${worldSlug}/${buildingSlug}`
    : `${origin}/w/${worldSlug}`;

  // If not a crawler, redirect to the SPA
  if (!shouldServeOg) {
    return res.redirect(302, canonicalUrl);
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase configuration");
    return res.status(500).send("Server configuration error");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch the world from the database
    const { data: world, error } = await supabase
      .from("worlds")
      .select("*")
      .eq("slug", worldSlug)
      .maybeSingle();

    if (error || !world) {
      return res.status(404).send("World not found");
    }

    // Extract world data
    const worldData = world.data?.world as {
      ownerName?: string;
      buildings?: Array<{ slug: string; name: string; oneLiner?: string; type: string }>;
    } | null;

    if (!worldData) {
      return res.status(500).send("Invalid world data");
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

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
    return res.status(200).send(html);
  } catch (err) {
    console.error("Error fetching world:", err);
    return res.status(500).send("Internal server error");
  }
}
