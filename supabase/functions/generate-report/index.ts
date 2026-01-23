import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const RequestSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format"),
  reportType: z.enum(["group", "overall"], {
    errorMap: () => ({ message: 'reportType must be "group" or "overall"' }),
  }),
  groupNumber: z.number().int().positive().optional(),
});

const SYSTEM_PROMPT = `## Role

You are a rigorous Bible Study Assistant and Data Analyst. Your task is to summarize user-submitted Bible study notes into structured reports.

## Input Data

You will receive a dataset containing fields: [Name, Group, Theme, Facts Discovered, Traditional Exegesis, Inspiration, Application].

## Strict Behavior & Rules (CRITICAL)

1. **Data Integrity:**

   * **NO Hallucinations:** Do NOT invent, assume, or add any theological content not explicitly provided by the users.

   * **Source-Based:** Analyze ONLY the provided raw data.

2. **Analysis Process:**

   * **Consolidate:** Merge similar or duplicate points into a concise summary.

   * **Highlight Unique Insights:** If a user provides a very unique, novel, or profound insight ("Light"), you MUST preserve it fully and cite the specific user's name (e.g., "Bro. Wang mentioned...").

3. **Output Formatting:**

   * **Tone:** Respectful, theological, precise, and organized Chinese (Traditional).

   * **Structure:**

       1. **主題 Theme:** (Consolidated themes)

       2. **事實發現 Fact Discovery:** (Synthesized observations)

       3. **獨特亮光 Unique Insights:** (Direct quotes/citations of special insights)

       4. **生活應用 Application:** (Practical life applications mentioned)

## Important Notes

- Always respond in Traditional Chinese
- Be precise and theological in your analysis
- Preserve the original meaning of user submissions
- Cite specific names when highlighting unique insights`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const body = await req.json();
    const validationResult = RequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => e.message) 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { sessionId, reportType, groupNumber } = validationResult.data;
    
    // Additional validation: groupNumber required for group reports
    if (reportType === "group" && groupNumber === undefined) {
      return new Response(
        JSON.stringify({ error: "groupNumber is required for group reports" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch submissions
    let query = supabase
      .from("submissions")
      .select("*")
      .eq("session_id", sessionId);
    
    if (reportType === "group" && groupNumber) {
      query = query.eq("group_number", groupNumber);
    }

    const { data: submissions, error: fetchError } = await query;
    
    if (fetchError) {
      throw new Error(`Failed to fetch submissions: ${fetchError.message}`);
    }

    if (!submissions || submissions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No submissions found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format submissions for AI
    const formattedData = submissions.map((s) => ({
      Name: s.name,
      Group: s.group_number,
      Theme: s.theme || "",
      "Moving Verse": s.moving_verse || "",
      "Facts Discovered": s.facts_discovered || "",
      "Traditional Exegesis": s.traditional_exegesis || "",
      Inspiration: s.inspiration_from_god || "",
      Application: s.application_in_life || "",
      Others: s.others || "",
    }));

    const reportTypeLabel = reportType === "group" 
      ? `第 ${groupNumber} 組小組報告 (Group ${groupNumber} Report)`
      : "整體查經報告 (Overall Assembly Report)";

    const userPrompt = `請根據以下查經筆記資料，生成一份${reportTypeLabel}：

經文：${submissions[0]?.bible_verse || "未指定"}

查經筆記資料：
${JSON.stringify(formattedData, null, 2)}

請依照指定格式生成報告。`;

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const reportContent = aiResponse.choices?.[0]?.message?.content || "無法生成報告";

    // Save report to database
    const { data: savedReport, error: saveError } = await supabase
      .from("ai_reports")
      .insert({
        session_id: sessionId,
        report_type: reportType,
        group_number: reportType === "group" ? groupNumber : null,
        content: reportContent,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save report:", saveError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        report: reportContent,
        reportId: savedReport?.id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
