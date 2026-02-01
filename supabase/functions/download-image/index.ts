import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed buckets for proxy access
const ALLOWED_BUCKETS = ["message-cards", "avatars"];

/**
 * Proxy endpoint to download images without exposing Supabase URLs
 * This improves security by hiding the storage backend from end users
 * 
 * Supports:
 * - message-cards bucket (for weekly message summary cards)
 * - avatars bucket (for user profile pictures)
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imagePath = url.searchParams.get("path");
    const bucket = url.searchParams.get("bucket") || "message-cards";
    const mode = url.searchParams.get("mode") || "download"; // "download" or "view"
    
    if (!imagePath) {
      return new Response(
        JSON.stringify({ error: "Missing image path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate bucket to prevent unauthorized access
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return new Response(
        JSON.stringify({ error: "Invalid bucket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the image from storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(imagePath);

    if (error || !data) {
      console.error("Storage download error:", error);
      return new Response(
        JSON.stringify({ error: "Image not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine content type based on file extension
    const ext = imagePath.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "png") contentType = "image/png";
    else if (ext === "gif") contentType = "image/gif";
    else if (ext === "webp") contentType = "image/webp";

    // Extract filename for download
    const filename = imagePath.split("/").pop() || "image";

    // Build response headers based on mode
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": bucket === "avatars" ? "public, max-age=86400" : "public, max-age=3600",
    };

    // Only add Content-Disposition for download mode
    if (mode === "download") {
      responseHeaders["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    // Return the image with appropriate headers
    return new Response(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Download error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
