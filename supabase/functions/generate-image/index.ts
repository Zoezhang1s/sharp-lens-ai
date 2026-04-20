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

    // Step 1: Generate an image-to-image EDIT instruction (not a fresh prompt)
    const systemMsg = language === "zh"
      ? `你是专业摄影指导AI。用户会提供一段对原照片的点评。你需要输出一段"图生图改进指令"（中文），用于在保持原图人物身份的前提下，对照片进行重新拍摄式的优化。

【硬性约束 — 必须在提示词开头明确写出】
- 严格保持原图人物的脸部特征、五官、发型、肤色、身材、服装、配饰完全不变
- 严格保持原图的环境/场所/背景元素不变（可以换角度、换景别、换构图，但不能换地点）
- 仅改变：姿势、动作、表情、构图、景别、机位角度、光线方向、色调氛围

【内容要求】
- 针对点评中提到的问题（构图、光线、姿势、表情、机位等）给出具体改进
- 描述新的姿势、新的机位/景别、新的光线方向、新的色调
- 不超过200字，只输出提示词本体，不要任何解释`
      : `You are a professional photo direction AI. The user provides a critique of an original photo. Output an "image-to-image edit instruction" that re-shoots the photo while keeping the SAME person.

[Hard constraints — state these at the very beginning of the prompt]
- Strictly preserve the original subject's face, facial features, hairstyle, skin tone, body shape, clothing, and accessories — DO NOT change the person
- Strictly preserve the original environment/location/background elements — you may change angle/framing/composition but NOT the location
- Only modify: pose, gesture, expression, composition, framing, camera angle, lighting direction, color grading

[Content]
- Address the specific issues from the critique (composition, lighting, pose, expression, angle)
- Describe the new pose, new camera angle/framing, new lighting direction, new color tone
- Under 200 words. Output ONLY the prompt itself, no explanations.`;

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
            { role: "user", content: prompt },
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
