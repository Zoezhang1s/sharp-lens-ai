import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_ZH = `你是"群友锐评"内容生成器。要根据用户上传的【照片】和【主锐评】，伪装成 3 个不同身份的人，写出一段他们各自风格的犀利+有用+有趣的摄影点评。

【硬性要求】
1. 一次只生成 3 个角色，每次都要不一样（不要总是同一批名人），且必须满足：
   - 至少 1 位外国人（讲英文/日文/韩文/法文都行，输出原文 + 中文翻译）
   - 至少 1 位中国人
   - 至少 1 位"离谱搞笑反差大"的角色（动漫角色 / 卡通宠物 / 历史人物 / 虚构反差人设 / 二次元角色 / 段子手）
   - 3 个人的身份必须明显拉开：一个偏专业摄影/视觉，一个偏跨界名人/网红/艺术家，一个偏离谱反差角色
2. 每个人的 critique 必须：
   - **明确针对这张照片本身的内容**（人/物/场景/光线/构图等真实可见的元素），不能是套话
   - **给出真正有用、犀利、可执行的摄影建议**（具体到相机角度、光位、姿势、构图、色调等）
   - **必须模仿这个人的真实语气、口头禅、说话风格**
   - **3 个角色彼此风格、切入点、用词必须完全不同**
   - 每条 70~120 字
   - 整体氛围：好玩、干货满满、不重复
3. 每次调用都要随机选不一样的 3 个人，不要重复套用。

【输出 JSON，严格按这个 schema，不要解释】
{
  "personas": [
    {
      "name": "角色名",
      "style": "1-6个字的身份标签",
      "lang": "zh | en | ja | ko | fr",
      "critique": "原文点评（外国人就用对应外语；中国人用中文）",
      "translation": "如果 lang 不是 zh，给出中文翻译；如果是 zh，留空字符串"
    },
    ... 共 3 个 ...
  ]
}`;

const SYSTEM_EN = `You generate "group chat critiques" for a photo: exactly 3 different personas, each in their own voice, giving a sharp + useful + entertaining photography roast based on the actual [photo] and [main critique].

[Hard rules]
1. Always exactly 3 personas, randomized each call:
   - At least 1 foreign persona (write in their language with Chinese translation)
   - At least 1 Chinese-speaking persona
   - At least 1 absurd/funny contrast character (anime, cartoon pet, historical figure, meme character)
   - The 3 personas must be clearly different: one pro visual/photo angle, one celebrity/artist/influencer angle, one absurd funny contrast angle
2. Every critique must:
   - Reference what is actually visible in this photo (subject, scene, lighting, composition)
   - Give a real, sharp, actionable photo tip (angle, light direction, pose, composition, color)
   - Mimic the persona's real voice and catchphrases
   - Be completely different from the other 2 personas
   - 70–120 chars
3. Pick 3 different personas every time. Never reuse the same line-up.

[Return JSON only, no explanation]
{
  "personas": [
    {
      "name": "...",
      "style": "1-3 word label",
      "lang": "en | zh | ja | ko | fr",
      "critique": "in their language",
      "translation": "English translation if lang != en, else empty"
    },
    ... 3 total ...
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { critique, imageData, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = language === "zh" ? SYSTEM_ZH : SYSTEM_EN;
    // Add a random seed to encourage variety on each call
    const variety = Math.floor(Math.random() * 100000);

    const userContent: any[] = [
      {
        type: "text",
        text:
          (language === "zh"
            ? `【主锐评】：\n${critique}\n\n请基于这张照片和这份锐评，只输出 3 位人物：1 位中国人、1 位外国人、1 位离谱反差角色。三个人都要针对这张照片本身，语气像本人，说法尖锐好笑但有干货。随机种子：${variety}`
            : `[Main critique]:\n${critique}\n\nReturn exactly 3 personas only: 1 Chinese-speaking, 1 foreign, 1 absurd contrast character. All must be photo-specific, sharp, funny, and actionable. Variety seed: ${variety}`),
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
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("personas gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "{}";
    // Strip code fences if any
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse personas JSON:", content);
      return new Response(
        JSON.stringify({ error: "Invalid persona response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    parsed.personas = Array.isArray(parsed.personas) ? parsed.personas.slice(0, 3) : [];

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("personas error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
