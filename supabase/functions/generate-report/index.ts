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
  fastMode: z.boolean().optional().default(false),
  filledOnly: z.boolean().optional().default(false),
});

// Strict prompt: NO hallucination, personal attribution, real content only
const SYSTEM_PROMPT_COMPACT = `你是「共同查經小組分析助理」。你的工作是**忠實整理**筆記，**絕對禁止**添加任何內容。

🚨 嚴格禁止：❌添加筆記沒有的神學/經文 ❌潤飾美化 ❌編造無人說過的話 ❌推測延伸 ❌空洞形容詞（深刻、寶貴、美好）

✅ 必須遵守：
1) 只能整理歸納筆記原文，不可添加
2) 每條「獨特亮光」格式：「👤 [姓名]：[原話摘要]」（禁止寫「小組認為」）
3) 內容簡短就直接說，不要編造填充
4) 列出每位成員，沒寫內容就標「未填寫」

格式：**組別：** **組員：** **已分析筆記數：**(有內容數/總人數) **查經經文：** --- **📖 主題：** **🔍 事實發現：** **💡 獨特亮光：**（👤姓名：內容） **🎯 如何應用：** --- **👤 個人貢獻摘要：**（每人1-2句或「未填寫」）
繁體中文。`;

function pickNonEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    (out as any)[k] = v;
  }
  return out;
}

function formatCompactEntries(allData: any[]): string {
  return allData
    .map((d, idx) => {
      const cleaned = pickNonEmpty(d);
      const name = (cleaned as any).姓名 ?? "未知";
      const src = (cleaned as any).來源 ?? "";
      const group = (cleaned as any).組別 ?? "";
      delete (cleaned as any).姓名;
      delete (cleaned as any).來源;
      delete (cleaned as any).組別;
      const details = Object.entries(cleaned)
        .map(([k, v]) => `${k}:${String(v)}`)
        .join(" | ");
      return `(${idx + 1}) ${name} [${src}${group ? ` / 組${group}` : ""}] ${details}`.trim();
    })
    .join("\n");
}

function hasContent(entry: any): boolean {
  // Check if entry has any meaningful content beyond name/group
  const contentFields = ['主題', '感動經節', '事實發現', '傳統解經', '神的啟示', '生活應用', '其他',
    '標題短語', '心跳經節', '經文觀察', '核心洞察類型', '核心洞察筆記', '學者筆記', '行動計劃', '冷卻反思'];
  return contentFields.some(field => {
    const val = entry[field];
    return val && typeof val === 'string' && val.trim().length > 0;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication using getClaims() for secure JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's token for auth validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    // Securely validate JWT using getUser()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = user.id;

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
    
    const { sessionId, reportType, groupNumber, fastMode, filledOnly } = validationResult.data;
    
    // Additional validation: groupNumber required for group reports
    if (reportType === "group" && groupNumber === undefined) {
      return new Response(
        JSON.stringify({ error: "groupNumber is required for group reports" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns this session (authorization check)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("owner_id")
      .eq("id", sessionId)
      .single();
    
    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (session.owner_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch submissions (traditional form)
    let submissionsQuery = supabase
      .from("submissions")
      .select("*")
      .eq("session_id", sessionId);
    
    if (reportType === "group" && groupNumber) {
      submissionsQuery = submissionsQuery.eq("group_number", groupNumber);
    }

    const { data: submissions, error: submissionsError } = await submissionsQuery;
    
    if (submissionsError) {
      throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
    }

    // Fetch study responses from the CORRECT view (v_ai_notes_feed) - NOT study_responses_public which has CROSS JOIN bug!
    let studyQuery = supabase
      .from("v_ai_notes_feed")
      .select("*")
      .eq("session_id", sessionId);
    
    if (reportType === "group" && groupNumber) {
      studyQuery = studyQuery.eq("group_number", groupNumber);
    }

    const { data: studyResponses, error: studyError } = await studyQuery;

    if (studyError) {
      throw new Error(`Failed to fetch study responses: ${studyError.message}`);
    }

    // Combine both data sources
    const hasSubmissions = submissions && submissions.length > 0;
    const hasStudyResponses = studyResponses && studyResponses.length > 0;

    if (!hasSubmissions && !hasStudyResponses) {
      return new Response(
        JSON.stringify({ error: "No submissions found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate traditional submissions by name + group
    const seenSubmissions = new Set<string>();
    const uniqueSubmissions = (submissions || []).filter((s) => {
      const key = s.name + '-' + s.group_number;
      if (seenSubmissions.has(key)) {
        console.log(`[generate-report] Duplicate submission filtered: ${s.name}`);
        return false;
      }
      seenSubmissions.add(key);
      return true;
    });

    // Format traditional submissions
    const formattedSubmissions = uniqueSubmissions.map((s) => ({
      來源: "傳統查經表",
      姓名: s.name,
      組別: s.group_number,
      主題: s.theme || "",
      感動經節: s.moving_verse || "",
      事實發現: s.facts_discovered || "",
      傳統解經: s.traditional_exegesis || "",
      神的啟示: s.inspiration_from_god || "",
      生活應用: s.application_in_life || "",
      其他: s.others || "",
    }));

    // Deduplicate study responses by first_name + group (v_ai_notes_feed uses first_name, not participant_name)
    const seenStudyResponses = new Set<string>();
    const uniqueStudyResponses = (studyResponses || []).filter((s) => {
      const key = (s.first_name || 'unknown') + '-' + s.group_number;
      if (seenStudyResponses.has(key)) {
        console.log(`[generate-report] Duplicate study response filtered: ${s.first_name}`);
        return false;
      }
      seenStudyResponses.add(key);
      return true;
    });

    // Format spiritual fitness responses (using v_ai_notes_feed column names)
    const formattedStudyResponses = uniqueStudyResponses.map((s) => ({
      來源: "靈魂健身筆記",
      姓名: s.first_name || "未知",
      組別: s.group_number,
      標題短語: s.title_phrase || "",
      心跳經節: s.heartbeat_verse || "",
      經文觀察: s.observation || "",
      核心洞察類型: s.core_insight_category || "",
      核心洞察筆記: s.core_insight_note || "",
      學者筆記: s.scholars_note || "",
      行動計劃: s.action_plan || "",
      冷卻反思: s.cool_down_note || "",
    }));

    // Combine all data
    let allData = [...formattedSubmissions, ...formattedStudyResponses];
    
    // Track unfilled members for filledOnly mode
    let unfilledNames: string[] = [];
    if (filledOnly) {
      const filledData = allData.filter(hasContent);
      unfilledNames = allData.filter(d => !hasContent(d)).map(d => d.姓名).filter(Boolean);
      allData = filledData;
    }
    
    const totalMembers = allData.length;
    const memberNames = allData.map(d => d.姓名).filter(Boolean).join("、");

    // Get verse reference
    const verseRef = submissions?.[0]?.bible_verse || 
      (await supabase.from("sessions").select("verse_reference").eq("id", sessionId).single()).data?.verse_reference ||
      "未指定";

    const reportTypeLabel = reportType === "group" 
      ? `第 ${groupNumber} 組小組報告 (Group ${groupNumber} Report)`
      : "整體健身報告 (Overall Assembly Report)";

    // Use compact format for faster processing
    const compactEntries = formatCompactEntries(allData);
    
    const unfilledNote = unfilledNames.length > 0
      ? `\n⚠️ 以下成員尚未填寫內容（不納入分析）：${unfilledNames.join("、")}`
      : "";

    const userPrompt = `請根據以下資料，生成一份${reportTypeLabel}。

⚠️ 重要提醒：
- 共有 ${totalMembers} 位成員的筆記需要分析
- 成員名單：${memberNames}
- 請確保每一位成員的內容都被納入分析，不可遺漏任何人${unfilledNote}

經文：${verseRef}

查經筆記資料（共 ${totalMembers} 份，已做精簡格式化以加速處理）：
${compactEntries}

請依照指定格式生成完整報告，確保涵蓋所有 ${totalMembers} 位成員的貢獻。`;

    // Model selection: fast mode uses lighter model for group reports
    const model = (fastMode && reportType === "group") 
      ? "google/gemini-2.5-flash" 
      : "google/gemini-2.5-pro";

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_COMPACT },
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
      // Log error server-side without exposing details
      await response.text(); // Consume response body
      throw new Error("Failed to generate report. Please try again.");
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
      // Report generated but not saved - continue with response
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
    // Return generic error message to client - no details exposed
    const errorMessage = error instanceof Error ? error.message : "An error occurred. Please try again.";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
