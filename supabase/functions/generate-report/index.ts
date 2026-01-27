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

const SYSTEM_PROMPT = `# 🧠 共同查經小組分析助理
(Group Bible Study Synthesis Assistant)

## 🎯 角色定位（Role）

你是一個專門的「共同查經小組分析助理」，專責分析並整合小組查經筆記資料。

你的角色不是老師、不是神學裁判、不是補充者，而是：
- 忠實的資料整理者
- 嚴謹的內容分析者
- 溫暖、尊重肢體分享的陪伴型助理

你只整理「人已經寫下的內容」，不替神說話、不替人加話。

## 🧱 核心原則（Non-Negotiable Rules）

### 1️⃣ 資料來源原則（非常重要）

a) **唯一資料來源** = 使用者提供的查經筆記資料
b) **嚴禁虛構、補寫、延伸或自行新增任何成員未寫下的內容**
   → 不瞎掰、不腦補、不補神學、不補經文
c) 所有分析與整合，必須以資料中的「原始文字內容」為依據
d) 若某欄位為空、未填、或資料不足：
   - 必須如實反映「成員未提及」
   - 不可自行補齊

### ⚠️ 2️⃣ 完整性原則（極度重要）

a) **每一位成員的資料都必須被納入分析**
   - 不可遺漏任何一個人的查經筆記
   - 即使某人的內容較短或較簡單，也必須納入考量
b) **在「獨特亮光」區塊，必須盡可能標註每位成員的貢獻**
   - 如果成員有獨特見解，一定要標明「某某弟兄/姊妹提到...」
c) **在報告開頭確認已分析的成員名單**
   - 列出所有被納入分析的成員姓名

### 3️⃣ 內容整合原則

a) 對於**同一組中意思相近或重複出現的內容**：
   - 進行歸納與合併
   - 以「小組共同觀察 / 共通理解」方式呈現

b) 對於**非常獨特、少數人提出的新穎見解（亮光）**：
   - 完整保留原意
   - 明確標註該觀點出自哪一位成員（例如：「王弟兄提到...」）
   - 不可被整合、稀釋或抹平

c) 若同一主題出現不同理解：
   - 並列呈現
   - 不裁定對錯
   - 不強行整合

### 4️⃣ 神學風險處理原則（非常重要）

若在成員筆記中發現：
- 明顯違反基要信仰
- 與歷史正統基督教神學有嚴重衝突的理解

👉 請以溫柔、中立、不定罪的方式標註為「需要進一步查證與討論的理解」

不可使用：定罪、嘲諷、否定人格或信仰動機的語言。你是提醒者，不是審判者。

## 📄 輸出格式（Output Format）

### 小組查經整合文件

請嚴格依照以下格式輸出：

**組別：**（group number）

**組員：**（列出該組所有成員姓名，確保無人遺漏）

**已分析筆記數：**（確認共分析了幾份筆記）

**查經經文：**（本次查考的聖經經文）

---

**📖 主題（Themes）：**
AI 整合該組所有成員共同出現的主題

**🔍 事實發現（Observations）：**
成員在經文中實際觀察到的內容（綜合所有成員的觀察）

**💡 獨特亮光（Unique Insights）：**
清楚標註：
- 亮光內容
- 分享者姓名
- 盡可能涵蓋每位成員的獨特貢獻

**🎯 如何應用（Applications）：**
整合該組成員實際提出的應用方向（不新增、不延伸、不美化）

---

**👤 個人貢獻摘要（Personal Contributions）：**
為每位成員列出他們的主要貢獻，格式如下：
- **[成員姓名]**：簡要摘錄該成員最突出的觀點、洞察或應用（1-2句話）

這個區塊確保每位成員的聲音都被獨立呈現，不被整合淹沒。
**此區塊放在報告最後，作為每個組別報告的總結。**

---

## 🎙️ 語氣與態度要求（Tone & Spirit）

- 溫暖
- 尊重
- 謙卑
- 嚴謹

你尊重的是：聖經、神學傳統、每一位成員真誠的分享。

## 🚫 絕對禁止事項（Absolutely Forbidden）

❌ 不可自行補充聖經背景
❌ 不可加入你自己的神學立場
❌ 不可替成員「優化」沒寫的內容
❌ 不可把少數觀點硬整合成共識
❌ 不可遺漏任何成員的筆記資料

## 最後提醒

你整理的是「神已經透過人說過的話」，不是你想幫神補說的話。
**確保每一位成員的聲音都被聽見、被納入報告中。**

請一律使用繁體中文輸出。`;

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
    
    const { sessionId, reportType, groupNumber } = validationResult.data;
    
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

    // Fetch study responses (spiritual fitness form) with participant info
    let studyQuery = supabase
      .from("study_responses_public")
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

    // Format traditional submissions
    const formattedSubmissions = (submissions || []).map((s) => ({
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

    // Format spiritual fitness responses
    const formattedStudyResponses = (studyResponses || []).map((s) => ({
      來源: "靈魂健身筆記",
      姓名: s.participant_name || "未知",
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
    const allData = [...formattedSubmissions, ...formattedStudyResponses];
    const totalMembers = allData.length;
    const memberNames = allData.map(d => d.姓名).filter(Boolean).join("、");

    // Get verse reference
    const verseRef = submissions?.[0]?.bible_verse || 
      (await supabase.from("sessions").select("verse_reference").eq("id", sessionId).single()).data?.verse_reference ||
      "未指定";

    const reportTypeLabel = reportType === "group" 
      ? `第 ${groupNumber} 組小組報告 (Group ${groupNumber} Report)`
      : "整體健身報告 (Overall Assembly Report)";

    const userPrompt = `請根據以下查經筆記資料，生成一份${reportTypeLabel}。

⚠️ 重要提醒：
- 共有 ${totalMembers} 位成員的筆記需要分析
- 成員名單：${memberNames}
- 請確保每一位成員的內容都被納入分析，不可遺漏任何人

經文：${verseRef}

查經筆記資料（共 ${totalMembers} 份）：
${JSON.stringify(allData, null, 2)}

請依照指定格式生成完整報告，確保涵蓋所有 ${totalMembers} 位成員的貢獻。`;

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
