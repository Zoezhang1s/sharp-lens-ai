import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, imageData, language } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!imageData || typeof imageData !== "string") {
      return new Response(
        JSON.stringify({ error: "reference image is required for image-to-image generation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const DOUBAO_API_KEY = Deno.env.get("DOUBAO_API_KEY");
    if (!DOUBAO_API_KEY) throw new Error("DOUBAO_API_KEY is not configured");

    // Step 1: Multimodal LLM looks at ORIGINAL photo + critique, then writes
    // a precise i2i edit instruction that fixes EVERY issue while preserving
    // the person and the location.
    const systemMsg = language === "zh"
      ? `你是顶级人像摄影总监。任务：基于【原照片】生成一段图生图(i2i)中文提示词，让结果成为"同一个人、同一身衣服、同一环境下，但拍得更好"的示范图。

【铁律一：人物完全一致，不能像但要"是同一个人"】
- 必须 100% 保留原图人物的脸：脸型、五官比例、眼睛形状和颜色、鼻型、嘴型、眉形、肤色、痣/雀斑、年龄感、发型、发色、发长。
- 不允许任何"美化换脸""韩式整容脸""网红脸""AI默认脸"。
- 必须保留原服装、配饰、鞋包、首饰、眼镜的款式、颜色、材质、花纹。
- 必须保留原环境/同一地点/同一主要场景元素。

【铁律二：放大原照片的气质和优点】
- 先在心里识别这张照片本来就有的气质（例如：清冷、文艺、慵懒、英气、可爱、复古、酷飒、自然清新、电影感等）以及它本身做对的地方（例如：色调统一、构图干净、光线柔和等）。
- 在 i2i 提示词里**继续放大这种气质**，让它更纯粹、更高级，而不是换成另一种风格。
  · 清冷 → 进一步强调冷调高级灰、留白、克制表情、安静氛围
  · 文艺 → 强调胶片颗粒、柔光、自然姿态、生活化构图
  · 酷飒 → 强调硬光、对比度、利落姿态、低角度
  · 复古 → 强调暖调、颗粒、年代色彩
- **保留并强化原图本来就好的部分**，不要把原本的优点抹掉。

【铁律三：把详细锐评里指出的所有缺点都修掉】
逐项修复：构图、光线、姿势、表情、机位、背景、色彩、焦段。每一条建议都要落到提示词里。

【严禁】
- 换脸、变成另一个人、改五官比例
- 改衣服、改发型、改身材、改年龄、改性别
- 跳到完全不同的场景或风格
- 套用千篇一律的"AI网红脸+暖调奶油色"

【输出】
- 直接输出最终的中文 i2i 提示词，不要解释，不要分点。
- 第一句必须是身份锁：明确写"必须是原图同一人，同一张脸，同一身衣服，同一环境"。
- 第二句写要放大的气质和保留的优点。
- 接下来按"构图 / 光线 / 姿势 / 表情 / 机位 / 背景 / 色彩"顺序，把锐评里指出的问题逐条改好。
- 总长度 200–320 字。`
      : `You are a top portrait photography director. Task: based on the [original photo], write one Chinese-style image-to-image prompt so the result is "the same person, same outfit, same environment, but photographed much better".

[Rule 1: identity lock — must be the SAME person, not just "similar"]
- Keep 100% of the original face: face shape, feature proportions, eye shape and color, nose, mouth, brows, skin tone, moles/freckles, age, hairstyle, hair color, hair length.
- No beautified face, no generic AI face, no influencer face.
- Keep the exact outfit, accessories, shoes, bag, jewelry, glasses (style, color, material, pattern).
- Keep the same environment / location / major scene elements.

[Rule 2: amplify the original mood and the things it already does well]
- First identify the mood the photo already has (e.g. cool/aloof, artsy, lazy, sharp, cute, retro, edgy, fresh, cinematic) and what it already does right (e.g. unified palette, clean composition, soft light).
- In the prompt, **push that same mood further** — make it purer and more refined. Do NOT swap to a different style.
- Preserve and strengthen the strong points of the original — do not erase them.

[Rule 3: fix every flaw the critique listed]
Address composition, lighting, pose, expression, camera angle, background, color, focal length one by one.

[Forbidden]
- New face, different person, changed feature proportions
- Changed clothes, hair, body, age, gender
- Different scene or different style
- Generic "AI influencer face + warm cream tone"

[Output]
- Output only the final i2i prompt, no explanation, no bullet points.
- First sentence must be the identity lock: same person, same face, same outfit, same environment.
- Second sentence: which mood to amplify and which strengths to keep.
- Then in order — composition / lighting / pose / expression / angle / background / color — fix each issue from the critique.
- 200–320 words total.`;

    const promptGenResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemMsg },
            {
              role: "user",
              content: imageData
                ? [
                    { type: "text", text: language === "zh" ? `【原照片】见图，【点评】如下：\n\n${prompt}` : `[Original photo] attached. [Critique]:\n\n${prompt}` },
                    { type: "image_url", image_url: { url: imageData } },
                  ]
                : prompt,
            },
          ],
        }),
      }
    );

    if (!promptGenResp.ok) {
      const errText = await promptGenResp.text();
      console.error("Prompt generation error:", promptGenResp.status, errText);
      throw new Error("Failed to generate image prompt");
    }

    const promptGenData = await promptGenResp.json();
    let imagePrompt = promptGenData.choices?.[0]?.message?.content?.trim();

    if (!imagePrompt) throw new Error("Empty image prompt generated");

    // Reinforce identity-lock at prompt level (belt-and-suspenders)
    const identityLock = language === "zh"
      ? "【绝对锁定原图人物与服装：必须是同一张脸、同一五官、同一发型发色、同一肤色、同一身材、同一套衣服和配饰；严禁换人、严禁变脸、严禁改衣服；必须保留同一环境，只能优化动作、表情、构图、光线和机位】"
      : "[ABSOLUTE IDENTITY AND WARDROBE LOCK: keep the exact same face, same facial features, same hairstyle and hair color, same skin tone, same body shape, same outfit and accessories. DO NOT change the person, DO NOT alter the face, DO NOT change clothing. Keep the same environment and only improve pose, expression, composition, lighting, and camera angle.]";
    const negativeLock = language === "zh"
      ? "负面约束：禁止新人物，禁止陌生脸，禁止韩式网红脸，禁止改变五官比例，禁止改变发型服装，禁止换场景。"
      : "Negative constraints: no new person, no different face, no beautified replacement face, no changed facial proportions, no changed hairstyle or outfit, no different location.";
    imagePrompt = `${identityLock} ${negativeLock} ${imagePrompt}`;

    console.log("Generated image prompt:", imagePrompt);

    // Step 2: Doubao Seedream 4.0 image-to-image with the original as reference
    const doubaoBody: Record<string, unknown> = {
      model: "doubao-seedream-4-0-250828",
      prompt: imagePrompt,
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "1080x1920",
      stream: false,
      watermark: false,
      seed: 1,
    };

    // Doubao Seedream 4.0 expects `image` as an array of URLs/data URIs for i2i
    if (imageData) {
      doubaoBody.image = [imageData];
    }

    const doubaoResp = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DOUBAO_API_KEY}`,
        },
        body: JSON.stringify(doubaoBody),
      }
    );

    if (!doubaoResp.ok) {
      const errText = await doubaoResp.text();
      console.error("Doubao API error:", doubaoResp.status, errText);
      throw new Error(`Image generation failed [${doubaoResp.status}]`);
    }

    const doubaoData = await doubaoResp.json();
    const imageUrl = doubaoData.data?.[0]?.url;

    if (!imageUrl) {
      console.error("No image URL in response:", JSON.stringify(doubaoData));
      throw new Error("No image URL returned");
    }

    return new Response(
      JSON.stringify({ imageUrl, prompt: imagePrompt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
