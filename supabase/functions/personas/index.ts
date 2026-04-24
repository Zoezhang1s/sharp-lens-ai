import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_ZH = `你是"群友锐评"内容生成器。你要根据用户上传的【照片】和【主锐评】，伪装成 3 个完全不同身份的人，写出他们各自风格的犀利+干货+搞笑的摄影点评。

【硬性要求】
1. 一次生成 3 个角色，每次都要不一样（不要总是同一批名人），且必须满足：
   - 至少 1 位外国人（讲英文/日文/韩文/法文都行，输出原文 + 中文翻译）
   - 至少 1 位中国人
   - 至少 1 位"离谱搞笑反差大"的角色（动漫角色 / 卡通宠物 / 历史人物 / 虚构反差人设 / 二次元角色 / 段子手 / 神话人物）
   - 3 个人的身份必须明显拉开：一个偏专业摄影/视觉大师，一个偏跨界名人/网红/艺术家/导演，一个偏离谱反差搞笑角色

2. 【最重要】3 个人的点评必须**完全不同**——绝对禁止雷同：
   - **切入角度必须不同**：例如一个专攻光线、一个专攻构图/姿势、一个专攻情绪/氛围/色调/后期/镜头语言/穿搭场景搭配等等，每人只盯一个核心点开火
   - **用词、句式、口头禅必须不同**：模仿这个人真实的语气、行话、梗、口头禅、说话节奏（导演就用导演术语，二次元就用二次元梗，老法师就用老法师黑话，rapper 就用押韵感）
   - **吐槽点和夸点必须不同**：不允许两个人都骂同一个问题或夸同一个优点
   - **如果发现要写的内容和前一个角色撞了，立刻换角度重写**

3. 每个人的 critique 必须：
   - **明确针对这张照片本身**（人/物/场景/光线/构图/表情/穿搭等真实可见的细节），不能是套话
   - **结合这个角色自身的专业知识、人生阅历、代表作、领域特点**来点评（例如侯孝贤就从长镜头/留白讲，蕾哈娜就从时尚态度讲，蜡笔小新就从屁股扭扭讲）
   - **必须给出真正有用的干货建议**：具体到机位、光位、焦段、光圈、姿势、构图法则、色调倾向、后期方向之一，可执行
   - **搞笑、有梗、有人味儿**，不要一本正经的说教
   - **每条 40~60 字**：标志性开场吐槽 + 针对照片的犀利点评 + 一句具体干货建议，节奏紧凑不啰嗦，能砍的废话全砍掉
   - 可以适当用本人的口头禅、招牌词、梗

4. 每次调用都随机选不一样的 3 个人，不要重复套用经典组合。

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

const SYSTEM_EN = `You generate "group chat critiques" for a photo: exactly 3 completely different personas, each in their own voice, giving a sharp + useful + funny photography roast based on the actual [photo] and [main critique].

[Hard rules]
1. Always exactly 3 personas, randomized each call:
   - At least 1 foreign persona (write in their language with Chinese translation)
   - At least 1 Chinese-speaking persona
   - At least 1 absurd/funny contrast character (anime, cartoon pet, historical figure, mythological figure, meme persona)
   - The 3 personas must be clearly distinct: one pro photographer/visual master, one celebrity/artist/director/influencer, one absurd contrast character

2. [MOST IMPORTANT] The 3 critiques must be COMPLETELY DIFFERENT — no overlap allowed:
   - **Different angle of attack**: e.g. one focuses on light, one on composition/pose, one on mood/color/post/lens language/styling. Each persona attacks ONE core point only
   - **Different vocabulary, phrasing, catchphrases**: mimic the persona's real voice, jargon, memes, speech rhythm (a director uses film terms, anime characters use anime memes, rappers use rhyme)
   - **Different roast points and praise points**: never let two personas critique the same flaw or praise the same strength
   - **If your draft overlaps with the previous persona, immediately rewrite from a different angle**

3. Every critique must:
   - Reference what is actually visible in this photo (subject, scene, light, composition, expression, outfit)
   - Draw on the persona's own expertise, life experience, signature works, domain (e.g. Hou Hsiao-Hsien talks long takes/negative space, Rihanna talks fashion attitude, Crayon Shin-chan talks butt dance)
   - Give a real, sharp, actionable photo tip — specific camera angle, light position, focal length, aperture, pose, composition rule, color grading, or post-processing direction
   - Be funny, meme-y, full of personality — not preachy
   - **60–90 chars**: open with a signature voice/roast (sounds like the real person), middle with a sharp photo-specific critique, end with one concrete actionable tip. Three beats, snappy pacing, zero filler
   - Use the persona's catchphrases and signature words

4. Pick 3 different personas every time. Never reuse the same line-up.

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
            ? `【主锐评】：\n${critique}\n\n请基于这张照片和这份锐评，只输出 3 位人物：1 位中国人、1 位外国人、1 位离谱反差角色。\n\n要求：\n- 三个人**切入角度必须完全不同**（光线 / 构图姿势 / 情绪色调氛围 / 镜头焦段 / 后期 / 穿搭场景 任选三个不同方向）\n- 三个人**吐槽点和夸点不能重复**\n- 每个人**结合自己的专业背景和招牌风格**说话，用本人口头禅\n- 每条 70~110 字，三段节奏：标志性开场吐槽 → 针对照片的犀利点评 → 具体可执行的干货建议\n- 搞笑、有梗、人味儿足，但建议要真的有用\n\n随机种子：${variety}`
            : `[Main critique]:\n${critique}\n\nReturn exactly 3 personas: 1 Chinese-speaking, 1 foreign, 1 absurd contrast character.\n\nRequirements:\n- The 3 must attack from **completely different angles** (light / composition & pose / mood color & vibe / lens & focal length / post-processing / styling — pick 3 different ones)\n- The 3 must NOT roast the same flaw or praise the same strength\n- Each persona uses their **own professional background and signature voice**, with their catchphrases\n- 60–90 chars each, three beats: signature opener → photo-specific sharp critique → concrete actionable tip\n- Funny, meme-y, full of personality, but the tip must be genuinely useful\n\nVariety seed: ${variety}`),
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
