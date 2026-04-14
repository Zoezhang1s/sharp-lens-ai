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

    const DOUBAO_API_KEY = Deno.env.get("DOUBAO_API_KEY");
    if (!DOUBAO_API_KEY) {
      throw new Error("DOUBAO_API_KEY is not configured");
    }

    // First, use Lovable AI to generate an optimized prompt based on the critique
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemMsg = language === "zh"
      ? `你是一个专业的摄影指导AI。根据用户提供的摄影点评内容，生成一段用于AI生图的详细提示词（中文），描述一张优化后的人像摄影作品。
要求：
1. 保留原照片中人物的基本特征（性别、大致年龄、发型等）
2. 改进点评中指出的所有问题（构图、光线、姿势、表情、背景等）
3. 提示词要具体描述：光线方向和质感、构图方式、人物姿势和表情、背景环境、色调风格
4. 加入摄影相关的渲染关键词：景深、光影、质感、高清等
5. 只输出提示词，不要其他内容
6. 提示词不超过200字`
      : `You are a professional photography direction AI. Based on the photography critique provided, generate a detailed image generation prompt (in Chinese) describing an optimized portrait photo.
Requirements:
1. Keep the subject's basic features (gender, approximate age, hairstyle)
2. Fix all issues mentioned in the critique (composition, lighting, pose, expression, background)
3. Be specific about: light direction and quality, composition, pose and expression, background, color tone
4. Include photography rendering keywords: depth of field, lighting, texture, high definition
5. Output ONLY the prompt, nothing else
6. Keep the prompt under 200 characters in Chinese`;

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

    if (!imagePrompt) {
      throw new Error("Empty image prompt generated");
    }

    console.log("Generated image prompt:", imagePrompt);

    // Call Doubao Seedream API
    const doubaoResp = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DOUBAO_API_KEY}`,
        },
        body: JSON.stringify({
          model: "doubao-seedream-4-0-250828",
          prompt: imagePrompt,
          sequential_image_generation: "disabled",
          response_format: "url",
          size: "1024x1024",
          stream: false,
          watermark: false,
        }),
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
