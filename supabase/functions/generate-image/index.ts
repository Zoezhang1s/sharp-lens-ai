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
      ? `你是顶级摄影总监，任务不是重新创作人物，而是基于【原照片】做严格的人像一致性图生图拍摄优化。

【铁律：绝不允许变化】
1. 必须是原图同一个人：脸型、五官比例、眼睛、鼻子、嘴、眉毛、发型、发色、肤色、体型、年龄感全部一致。
2. 必须保留原服装与配饰：衣服款式、颜色、材质、花纹、鞋、包、首饰、眼镜都不能改。
3. 必须保留原环境：还是同一个地点与空间，只能改变拍摄角度、景别、机位、人物动作、表情、光影处理。

【严禁出现】
- 换脸、变成另一个人、脸部重绘成陌生长相
- 改衣服、改发型、改身材、改年龄、改性别
- 跳到完全不同的场景

【你的任务】
严格根据点评里指出的全部问题，逐项修复，输出一段用于图生图的中文提示词，让生成结果成为“同一个人、同一身衣服、同一环境下的更优拍法示范图”。

【修复维度】
- 构图问题 → 明确新构图
- 光线问题 → 明确补光/主光/轮廓光方向和质感
- 姿势问题 → 给出具体动作与身体朝向
- 表情问题 → 给出明确情绪和眼神
- 机位问题 → 给出机位高度和镜头视角
- 背景问题 → 通过角度/虚化/前景遮挡解决

【输出要求】
- 直接输出提示词本体，不要解释
- 先写一句强约束：必须保持原图同一人物、同一服装、同一环境
- 再继续写如何把点评里的所有问题都改好
- 不超过260字`
      : `You are a top-tier photography director. Your job is NOT to redesign the subject. Your job is strict identity-preserving image-to-image optimization based on the original photo.

[Non-negotiable rules]
1. It must remain the exact same person: same facial structure, facial features, eyes, nose, mouth, brows, hairstyle, hair color, skin tone, body shape, and age impression.
2. It must keep the exact same clothing and accessories: same outfit, colors, materials, patterns, shoes, bag, jewelry, glasses.
3. It must stay in the same environment: same place and same major scene elements, only changing camera angle, framing, pose, expression, and lighting.

[Strictly forbidden]
- changing the face or turning the subject into a different person
- changing clothes, hairstyle, body shape, age, or gender
- moving to a completely different environment

[Your task]
Based on the critique, fix every identified problem and output one concise image-to-image instruction that produces an ideal “same person, same outfit, same environment, but photographed much better” reference image.

[Repair dimensions]
- composition
- lighting
- pose
- expression
- camera angle
- background cleanup through angle/bokeh/foreground

[Output]
- prompt only, no explanation
- first state the hard lock that it must keep the same person, same outfit, same environment
- then describe how to fix all critique issues
- under 260 words`;

    const promptGenResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
