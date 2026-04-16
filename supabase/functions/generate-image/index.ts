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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Generate an optimized image prompt based on the critique
    const systemMsg = language === "zh"
      ? `你是一个专业的摄影指导AI。根据用户提供的摄影点评内容，生成一段用于AI修图的详细指令（中文）。
要求：
1. 指令是基于原图进行修改优化，不是重新生成
2. 改进点评中指出的所有问题（构图、光线、姿势、表情、背景等）
3. 描述具体的修改方向：光线如何调整、构图如何改善、色调如何优化
4. 保持人物主体不变，只优化摄影效果
5. 只输出修图指令，不要其他内容
6. 指令不超过200字`
      : `You are a professional photography direction AI. Based on the critique provided, generate a detailed image editing instruction.
Requirements:
1. The instruction is to modify/optimize the original photo, NOT generate a new one
2. Fix all issues mentioned in the critique (composition, lighting, pose, expression, background)
3. Be specific about adjustments: lighting changes, composition improvements, color grading
4. Keep the subject unchanged, only optimize photography effects
5. Output ONLY the editing instruction, nothing else
6. Keep under 200 characters`;

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

    console.log("Generated editing prompt:", imagePrompt);

    // Step 2: Use Gemini image editing to modify the original photo
    if (imageData) {
      // Edit the user's uploaded image using Gemini image model
      const editInstruction = `请你参考图1的主体形象，${imagePrompt}`;

      const editResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: editInstruction },
                  { type: "image_url", image_url: { url: imageData } },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        }
      );

      if (!editResp.ok) {
        const errText = await editResp.text();
        console.error("Image edit error:", editResp.status, errText);
        throw new Error(`Image editing failed [${editResp.status}]`);
      }

      const editData = await editResp.json();
      const generatedImageUrl = editData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!generatedImageUrl) {
        console.error("No image in edit response:", JSON.stringify(editData).slice(0, 500));
        throw new Error("No image returned from editing");
      }

      return new Response(
        JSON.stringify({ imageUrl: generatedImageUrl, prompt: imagePrompt }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: no image provided, use Doubao for generation
    const DOUBAO_API_KEY = Deno.env.get("DOUBAO_API_KEY");
    if (!DOUBAO_API_KEY) {
      throw new Error("DOUBAO_API_KEY is not configured");
    }

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
