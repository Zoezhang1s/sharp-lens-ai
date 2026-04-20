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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const DOUBAO_API_KEY = Deno.env.get("DOUBAO_API_KEY");
    if (!DOUBAO_API_KEY) throw new Error("DOUBAO_API_KEY is not configured");

    // Step 1: Multimodal LLM looks at ORIGINAL photo + critique, then writes
    // a precise i2i edit instruction that fixes EVERY issue while preserving
    // the person and the location.
    const systemMsg = language === "zh"
      ? `你是顶级摄影指导。你会同时看到【原照片】和【对它的点评】。
任务：输出一段图生图改进指令（中文），用于在**完全保留原图人物**的前提下，重拍出更好的版本。

【最高优先级 — 必须保持完全一致】
1. 人物身份：同一张脸、五官、发型、发色、肤色、身材、年龄气质，绝不换人
2. 服装与配饰：上衣、下装、鞋、包、首饰、眼镜全部保持一致
3. 场景与环境：原地点不变，主要环境元素（建筑/家具/植物/道具）保留，仅允许换机位/景别/角度

【必须修复 — 针对点评中提到的每一个问题】
仔细读点评，把每条缺点都对应到具体改进：
- 构图问题 → 新的构图（黄金分割/三分法/留白方向/景别）
- 光线问题 → 新的光线方向与质感（柔光/伦勃朗光/逆光勾边/窗光）
- 姿势问题 → 具体新姿势（手怎么放、身体朝向、重心、与道具互动）
- 表情问题 → 新表情/眼神方向/情绪
- 机位问题 → 新机位高度与角度（俯/平视/仰/侧）
- 色调问题 → 新色调氛围（冷/暖/胶片颗粒/对比度）
- 背景杂乱 → 如何避开（虚化/换角度避开/利用前景遮挡）

【输出格式】
- 第一句先写硬性身份/场景锁定声明
- 然后一段连贯描述：构图 → 机位 → 姿势 → 表情 → 光线 → 色调
- 不超过250字，只输出提示词本体，不要标题和解释`
      : `You are a top-tier photo director. You see [the original photo] and [a critique of it].
Output an image-to-image edit instruction that re-shoots the photo while STRICTLY preserving the person and location.

[Highest priority — must stay identical]
1. Identity: same face, features, hairstyle, hair color, skin tone, body — never replace the person
2. Wardrobe & accessories: same top, bottom, shoes, bag, jewelry, glasses
3. Scene & environment: same location and key elements, only change angle/framing

[Must fix — map every critique issue to a concrete change]
- Composition → new framing (rule of thirds / negative space / shot size)
- Lighting → new direction & quality (soft / Rembrandt / rim / window)
- Pose → specific new pose (hands, body orientation, weight, interaction)
- Expression → new expression / gaze / mood
- Camera angle → new height & angle (high / eye-level / low / side)
- Color tone → new mood (cool / warm / film grain / contrast)
- Cluttered background → how to avoid (bokeh / new angle / foreground)

[Format]
- First sentence: hard identity + location lock
- Then one cohesive paragraph: composition → angle → pose → expression → lighting → tone
- Under 250 words. ONLY the prompt, no headings, no explanations.`;

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
      ? "【保持原图人物完全一致：同一张脸、同一个发型、同一套服装、同一个身材，不要换人；保持原场景，仅优化姿势/构图/光线/色调/机位角度】"
      : "[Keep the SAME person from the reference image: same face, same hairstyle, same outfit, same body — DO NOT replace the person. Keep the same location. Only improve pose/composition/lighting/color/angle.]";
    imagePrompt = `${identityLock} ${imagePrompt}`;

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
