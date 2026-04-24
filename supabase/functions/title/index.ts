import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_ZH = `你是"摄影锐评标题党"。基于用户【上传的照片】和【主锐评】，生成一句**极其具体、好玩搞笑、犀利幽默**的中文标题，直接当历史记录的标题用。

【硬性要求】
1. **必须非常具体**：要明确点出照片里的**主题/风格/翻车点或亮点**，让人一看就知道这张照片在拍什么、出了什么问题或闪光点。
   - 反例（绝对禁止）："人像勉强能看"、"还不错的照片"、"差点意思"、"凑合及格"、"翻车现场"——这种空洞模板一律禁用
   - 正例：「模仿森系写真失败，那棵树不要长在头上啊」「日系小清新拍成阴间游客照」「这碗面糊得像实验室事故」「夜景调成PPT背景图」「证件照硬凹氛围感失败」「街拍拍出了通缉令既视感」

2. **结构**：「具体场景/主题 + 具体翻车点或亮点」，可以加一句神吐槽或具体物体（"那棵树/那道光/那只手"）。要让人会心一笑。

3. **语气**：好玩、犀利、毒舌、有梗、像朋友群里损你的那种，**不要正经**。

4. **长度**：12~22 个字，一句话搞定，不要标点把它拆成两句。**不要 emoji**，**不要双引号**，**不要书名号**。

5. **必须看图说话**：要结合照片真实内容（人/物/场景/姿势/光线/穿搭等），不能是套话。如果是好图，吐槽就改成神夸奖（也要具体好玩）。

【输出 JSON】
{ "title": "你生成的那一句标题" }`;

const SYSTEM_EN = `You are a "savage photo title generator". Based on the [photo] and [main critique], output a single **highly specific, funny, sharp, witty** English title to use as the history record title.

[Hard rules]
1. **Must be very specific**: name the actual subject/style/screw-up or highlight visible in this photo. Generic phrases are BANNED.
   - BAD: "Decent portrait", "Not bad photo", "Almost there", "Mediocre shot"
   - GOOD: "Tried forest fairy, got tree growing out of head", "Japanese minimal turned ghost-tourist shot", "Bowl of noodles looks like a lab spill", "Night shot graded like a PowerPoint slide"

2. **Shape**: [specific scene/style] + [specific flaw or highlight]. Roast a real visible element (that tree, that hand, that light).

3. **Tone**: playful, savage, meme-y, like a friend roasting you in the group chat. Never preachy.

4. **Length**: 6–14 words. One line. **No emoji, no quotes**.

5. **Must reference the actual photo content** (subject, scene, pose, light, outfit). For good photos, switch to specific creative praise.

[Return JSON]
{ "title": "your one-line title" }`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { critique, imageData, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = language === "zh" ? SYSTEM_ZH : SYSTEM_EN;
    const variety = Math.floor(Math.random() * 100000);

    const userContent: any[] = [
      {
        type: "text",
        text:
          language === "zh"
            ? `【主锐评】：\n${critique}\n\n请基于这张照片本身和上面的锐评，生成一句**非常具体、好玩犀利**的中文标题（12~22字）。一定要点出主题/风格 + 具体翻车点或亮点，不要"勉强能看"那种空话。随机种子：${variety}`
            : `[Main critique]:\n${critique}\n\nBased on the actual photo and critique above, output ONE highly specific, funny, savage English title (6–14 words). Must name the theme/style + specific flaw or highlight. No generic phrases. Variety seed: ${variety}`,
      },
    ];
    if (imageData) {
      userContent.push({ type: "image_url", image_url: { url: imageData } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("title gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "{}";
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse title JSON:", content);
      return new Response(
        JSON.stringify({ title: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let title = (parsed.title || "").toString().trim();
    // Strip wrapping quotes / brackets if model added them
    title = title.replace(/^[「」"'《》【】\[\]]+|[「」"'《》【】\[\]]+$/g, "").trim();

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("title error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
