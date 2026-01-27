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
const GROUP_SYSTEM_PROMPT = `你是「共同查經小組分析助理」。你的工作是**忠實整理**使用者提供的筆記，**絕對禁止**添加任何內容。

🚨 嚴格禁止事項（違反將導致報告無效）：
- ❌ 禁止添加筆記中沒有的神學解釋、經文引用、靈修感想
- ❌ 禁止潤飾或美化原始內容，必須保持原意
- ❌ 禁止編造任何「弟兄姊妹說」但實際上沒人說的內容
- ❌ 禁止推測或延伸筆記沒有明確寫出的內容
- ❌ 禁止使用「深刻」「寶貴」「美好」等空洞形容詞

✅ 必須遵守：
1) 唯一資料來源 = 使用者提供的筆記原文；只能整理歸納，不可添加
2) 每一條「獨特亮光」必須是**某個人**的原創觀點，格式：「👤 [姓名]：[原話摘要]」
3) 如果筆記內容簡短或空白，就直接說「內容簡短」，不要編造內容填充
4) 必須列出每位成員，若某人沒寫內容就標註「未填寫」

輸出格式（嚴格遵守）：
**組別：**
**組員：**（列出全部姓名）
**已分析筆記數：**（實際有內容的筆記數 / 總人數）
**查經經文：**
---
**📖 主題（Themes）：**（從筆記中歸納，不可自創）
**🔍 事實發現（Observations）：**（筆記中提到的觀察，原文為主）
**💡 獨特亮光（Unique Insights）：**
- 👤 [姓名]：[該成員的原創觀點]
- 👤 [姓名]：[該成員的原創觀點]
（每條必須標註是誰說的，不可寫「小組認為」）
**🎯 如何應用（Applications）：**（筆記中提到的應用，保持原意）
---
**👤 個人貢獻摘要（Personal Contributions）：**
- [姓名]：[1-2句總結該成員寫了什麼]
- [姓名]：未填寫內容

一律使用繁體中文。`;

// Overall synthesis prompt: Cross-group analysis and holistic insights
const OVERALL_SYSTEM_PROMPT = `你是「全會眾查經綜合分析助理」。你的工作是對**所有小組的筆記**進行**跨組綜合分析**，找出共同主題、對比差異、提煉精華洞察。

🎯 你的目標：
- 綜合分析所有小組的筆記，而非簡單合併
- 找出跨組共同的主題和觀點
- 對比不同組的獨特視角和差異
- 提煉出最精華的亮光和應用

🚨 嚴格禁止事項：
- ❌ 禁止添加筆記中沒有的神學解釋或靈修感想
- ❌ 禁止編造任何人沒說過的內容
- ❌ 禁止使用空洞形容詞美化內容

✅ 必須遵守：
1) 所有內容必須來自使用者提供的筆記
2) 引用觀點時標註來源（組別或姓名）
3) 進行真正的綜合分析，不是簡單羅列

輸出格式（嚴格遵守）：
**📊 全會眾查經綜合分析報告**
**查經經文：**
**參與統計：** X 組 / Y 人參與

---

**🔗 跨組共識（Cross-Group Consensus）：**
（多個小組不約而同提到的共同主題或觀點，標註有多少組提及）

**🌈 多元視角對比（Diverse Perspectives）：**
（不同小組對同一經文的不同切入角度，展現多元性）
- 第 X 組強調：...
- 第 Y 組側重：...

**💎 精選亮光（Highlighted Insights）：**
（從所有筆記中精選最具啟發性的 3-5 條洞察，標註來源）
- 👤 [姓名/第X組]：[精選亮光]

**🎯 共同應用方向（Common Applications）：**
（綜合各組提出的應用，歸納共同的行動方向）

**📈 參與度摘要（Participation Summary）：**
（簡述各組的參與情況和筆記品質）

一律使用繁體中文。`;

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
    const t0 = Date.now();
    // Verify authentication
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
      .select("owner_id, verse_reference")
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

    const tAuth = Date.now();

    // Create PENDING record first for optimistic UI
    // Use group_number: 0 for overall reports to distinguish from group reports
    const { data: pendingReport, error: pendingError } = await supabase
      .from("ai_reports")
      .insert({
        session_id: sessionId,
        report_type: reportType,
        group_number: reportType === "group" ? groupNumber : 0,
        content: "生成中...",
        status: "PENDING",
      })
      .select()
      .single();

    if (pendingError) {
      throw new Error(`Failed to create pending report: ${pendingError.message}`);
    }

    const reportId = pendingReport.id;

    const tPending = Date.now();

    // Fetch notes from secure view (no emails exposed!)
    let notesQuery = supabase
      .from("v_ai_notes_feed")
      .select("*")
      .eq("session_id", sessionId);
    
    if (reportType === "group" && groupNumber) {
      notesQuery = notesQuery.eq("group_number", groupNumber);
    }

    const { data: notes, error: notesError } = await notesQuery;
    
    if (notesError) {
      // Update status to FAILED
      await supabase
        .from("ai_reports")
        .update({ status: "FAILED", content: `Error fetching notes: ${notesError.message}` })
        .eq("id", reportId);
      throw new Error(`Failed to fetch notes: ${notesError.message}`);
    }

    // Also fetch traditional submissions
    let submissionsQuery = supabase
      .from("submissions")
      .select("name, group_number, theme, moving_verse, facts_discovered, traditional_exegesis, inspiration_from_god, application_in_life, others")
      .eq("session_id", sessionId);
    
    if (reportType === "group" && groupNumber) {
      submissionsQuery = submissionsQuery.eq("group_number", groupNumber);
    }

    const { data: submissions } = await submissionsQuery;

    const tFetchData = Date.now();

    const hasNotes = notes && notes.length > 0;
    const hasSubmissions = submissions && submissions.length > 0;

    if (!hasNotes && !hasSubmissions) {
      // Update status to FAILED
      await supabase
        .from("ai_reports")
        .update({ status: "FAILED", content: "沒有找到筆記資料" })
        .eq("id", reportId);
      return new Response(
        JSON.stringify({ error: "No notes found", reportId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format notes from secure view (privacy-safe: only first_name, no email)
    // Deduplicate by user_id to prevent counting same person multiple times
    const seenUserIds = new Set<string>();
    const uniqueNotes = (notes || []).filter((n) => {
      // Use a unique key based on available identifiers
      const key = n.first_name + '-' + n.group_number;
      if (seenUserIds.has(key)) {
        console.log(`[analyze-notes] Duplicate entry filtered: ${n.first_name}`);
        return false;
      }
      seenUserIds.add(key);
      return true;
    });

    const formattedNotes = uniqueNotes.map((n) => ({
      來源: "靈魂健身筆記",
      姓名: n.first_name || "未知",
      組別: n.group_number,
      標題短語: n.title_phrase || "",
      心跳經節: n.heartbeat_verse || "",
      經文觀察: n.observation || "",
      核心洞察類型: n.core_insight_category || "",
      核心洞察筆記: n.core_insight_note || "",
      學者筆記: n.scholars_note || "",
      行動計劃: n.action_plan || "",
      冷卻反思: n.cool_down_note || "",
    }));

    // Deduplicate traditional submissions by name + group
    const seenSubmissions = new Set<string>();
    const uniqueSubmissions = (submissions || []).filter((s) => {
      const key = s.name + '-' + s.group_number;
      if (seenSubmissions.has(key)) {
        console.log(`[analyze-notes] Duplicate submission filtered: ${s.name}`);
        return false;
      }
      seenSubmissions.add(key);
      return true;
    });

    // Format traditional submissions (also privacy-safe: only name)
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

    // Combine all data
    let allData = [...formattedNotes, ...formattedSubmissions];
    
    // Track unfilled members for filledOnly mode
    let unfilledNames: string[] = [];
    if (filledOnly) {
      const filledData = allData.filter(hasContent);
      unfilledNames = allData.filter(d => !hasContent(d)).map(d => d.姓名).filter(Boolean);
      allData = filledData;
    }
    
    const totalMembers = allData.length;
    const memberNames = allData.map(d => d.姓名).filter(Boolean).join("、");

    const compactEntries = formatCompactEntries(allData);
    
    const unfilledNote = unfilledNames.length > 0
      ? `\n⚠️ 以下成員尚未填寫內容（不納入分析）：${unfilledNames.join("、")}`
      : "";

    // Build user prompt based on report type
    let userPrompt: string;
    let systemPrompt: string;
    
    if (reportType === "group") {
      systemPrompt = GROUP_SYSTEM_PROMPT;
      userPrompt = `請根據以下資料，生成一份第 ${groupNumber} 組小組報告 (Group ${groupNumber} Report)。

⚠️ 重要提醒：
- 共有 ${totalMembers} 位成員的筆記需要分析
- 成員名單：${memberNames}
- 請確保每一位成員的內容都被納入分析，不可遺漏任何人${unfilledNote}

經文：${session.verse_reference || "未指定"}

查經筆記資料（共 ${totalMembers} 份，已做精簡格式化以加速處理）：
${compactEntries}

請依照指定格式生成完整報告，確保涵蓋所有 ${totalMembers} 位成員的貢獻。`;
    } else {
      // Overall report: Cross-group synthesis
      systemPrompt = OVERALL_SYSTEM_PROMPT;
      
      // Group data by group number for better analysis
      const groupedData = new Map<number, typeof allData>();
      allData.forEach(d => {
        const gn = d.組別 || 0;
        if (!groupedData.has(gn)) groupedData.set(gn, []);
        groupedData.get(gn)!.push(d);
      });
      
      const groupCount = groupedData.size;
      const groupSummaries = Array.from(groupedData.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([gn, data]) => {
          const names = data.map(d => d.姓名).filter(Boolean).join("、");
          const entries = formatCompactEntries(data);
          return `### 第 ${gn} 組（${data.length} 人：${names}）\n${entries}`;
        })
        .join("\n\n");
      
      userPrompt = `請對以下所有小組的查經筆記進行**綜合分析**，生成一份全會眾查經綜合分析報告。

⚠️ 重要提醒：
- 這是跨組綜合分析，不是簡單合併！
- 請找出共同主題、對比差異、提煉精華
- 共有 ${groupCount} 個小組、${totalMembers} 位成員參與${unfilledNote}

經文：${session.verse_reference || "未指定"}

各小組查經筆記資料：

${groupSummaries}

請進行深度跨組分析，依照指定格式生成綜合報告。`;
    }

    const tPrompt = Date.now();

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const tAiDone = Date.now();

    if (!response.ok) {
      let errorMessage = "AI generation failed";
      if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status === 402) {
        errorMessage = "AI credits exhausted. Please add credits to continue.";
      }
      
      // Update status to FAILED
      await supabase
        .from("ai_reports")
        .update({ status: "FAILED", content: errorMessage })
        .eq("id", reportId);
      
      return new Response(
        JSON.stringify({ error: errorMessage, reportId }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const reportContent = aiResponse.choices?.[0]?.message?.content || "無法生成報告";

    // Update report with completed content
    const { error: updateError } = await supabase
      .from("ai_reports")
      .update({ 
        content: reportContent,
        status: "COMPLETED" 
      })
      .eq("id", reportId);

    if (updateError) {
      console.error("Failed to update report:", updateError);
    }

    console.log("[analyze-notes] timings(ms)", {
      total: Date.now() - t0,
      authAndOwnCheck: tAuth - t0,
      createPending: tPending - tAuth,
      fetchData: tFetchData - tPending,
      buildPrompt: tPrompt - tFetchData,
      aiCall: tAiDone - tPrompt,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        report: reportContent,
        reportId,
        status: "COMPLETED"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred. Please try again.";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
