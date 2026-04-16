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
    console.log("DOUBAO_API_KEY length:", DOUBAO_API_KEY.length, "prefix:", DOUBAO_API_KEY.slice(0, 4), "suffix:", DOUBAO_API_KEY.slice(-4));

    // Step 1: Generate an optimized image prompt based on the critique
    const systemMsg = language === "zh"
      ? `你是一个专业的摄影指导AI。根据用户提供的摄影点评内容，生成一段用于AI图生图的详细提示词（中文）。
要求：
1. 描述一张基于原图优化后的理想照片应该是什么样子
2. 改进点评中指出的所有问题（构图、光线、姿势、表情、背景等）
3. 描述具体的场景、光线、色调、构图、人物状态
4. 保持原图的基本主题和风格方向
5. 只输出提示词，不要其他内容
6. 提示词不超过200字`
      : `You are a professional photography direction AI. Based on the critique provided, generate a detailed image prompt.
Requirements:
1. Describe what an ideally optimized version of the original photo should look like
2. Fix all issues mentioned in the critique (composition, lighting, pose, expression, background)
3. Be specific about scene, lighting, color grading, composition, subject state
4. Keep the original theme and style direction
5. Output ONLY the prompt, nothing else
6. Keep under 200 words`;

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
    const imagePrompt = promptGenData.choices?.[0]?.message?.content?.trim();

    if (!imagePrompt) throw new Error("Empty image prompt generated");

    console.log("Generated image prompt:", imagePrompt);

    // Step 2: Use Doubao Seedream to generate image, with original image as reference if available
    const doubaoBody: Record<string, unknown> = {
      model: "doubao-seedream-4-0-250828",
      prompt: imagePrompt,
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: false,
    };

    // Pass the original image as reference for image-to-image generation
    if (imageData) {
      doubaoBody.image = imageData; // base64 data URI or URL
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
