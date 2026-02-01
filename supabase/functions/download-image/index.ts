import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Proxy endpoint to download message card images without exposing Supabase URLs
 * This improves security by hiding the storage backend from end users
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imagePath = url.searchParams.get("path");

    if (!imagePath) {
      return new Response(
        JSON.stringify({ error: "Missing image path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the image from storage
    const { data, error } = await supabase.storage
      .from("message-cards")
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

    // Return the image with appropriate headers
    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
