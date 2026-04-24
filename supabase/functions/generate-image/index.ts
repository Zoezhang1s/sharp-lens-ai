import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callLovableChat(
  apiKey: string,
  model: string,
  messages: Array<Record<string, unknown>>,
) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Lovable AI error:", resp.status, errText);
    throw new Error(`Failed to generate image prompt [${resp.status}]`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty image prompt generated");
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, imageData, language } = await req.json();

    const inferSizeFromImageData = (dataUrl: string) => {
      const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/);
      if (!match) return { width: 1080, height: 1920 };
      const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));

      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        const dv = new DataView(bytes.buffer);
        return { width: dv.getUint32(16), height: dv.getUint32(20) };
      }

      if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset < bytes.length) {
          if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
          }
          const marker = bytes[offset + 1];
          const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
          if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            const height = (bytes[offset + 5] << 8) + bytes[offset + 6];
            const width = (bytes[offset + 7] << 8) + bytes[offset + 8];
            return { width, height };
          }
          offset += 2 + length;
        }
      }

      return { width: 1080, height: 1920 };
    };

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

    // Step 1: Gemini Pro first extracts concrete issues from critique + photo.
    const analysisSystemMsg = language === "zh"
      ? `你是顶级人像摄影总监兼修图统筹。你的任务不是夸，而是先拆解问题，再给出一段可执行的图生图优化指令。

【目标】
- 必须根据【原照片】和【锐评内容】识别出原图存在的具体问题。
- 必须确保生成结果仍然是原图同一个人、同一张脸、同一身衣服、同一环境。
- 必须让输出图相较原图产生肉眼可见的提升，不能只是轻微润色，更不能几乎一模一样。

【必须分析的维度】
1. 原图已有优点（最多 3 条）
2. 原图明确缺点（至少 5 条，必须具体）
3. 哪些缺点必须被强修：构图 / 光线 / 表情 / 姿势 / 机位 / 背景 / 色彩 / 清晰度
4. 如何在不换人的前提下把画面做得明显更好

【人脸和身份铁律】
- 必须是同一个人，同一张脸，同一五官比例，同一发型发色，同一肤色与年龄感。
- 严禁任何模糊脸、变形脸、双眼不对称、塑料皮、AI 默认脸、陌生人替换。
- 眼睛必须清晰对焦，鼻口结构不能错位，手指和肢体不能畸形。

【输出格式】
只输出 3 段内容：
优点：...
缺点：...
优化指令：...

其中“优化指令”必须是给下一步图生图模型使用的中文高强度执行说明，必须具体写清楚要改哪里、怎么改、改到什么程度。`
      : `You are a top portrait photography director and retouching supervisor. First diagnose the photo, then produce a concrete Chinese image-to-image optimization instruction.

[Goal]
- Identify concrete problems from both the original photo and the critique.
- Preserve the exact same person, same face, same outfit, same environment.
- Make the result visibly better, not just lightly retouched and never near-identical.

[Must analyze]
1. Existing strengths (max 3)
2. Specific flaws (at least 5, concrete)
3. Which flaws must be strongly fixed: composition / lighting / expression / pose / camera angle / background / color / sharpness
4. How to make it clearly better without changing identity

[Identity and face rules]
- Same person, same face, same feature proportions, same hair, same skin tone, same age impression.
- No blur, no face distortion, no asymmetric eyes, no plastic skin, no generic AI face, no replacement person.
- Eyes must be in focus; nose and mouth structure must remain correct; fingers and limbs must not deform.

[Output format]
Output exactly 3 sections only:
Strengths: ...
Flaws: ...
Optimization instruction: ...

The “Optimization instruction” must be a Chinese high-intensity execution brief for the next image model, with concrete, actionable fixes.`;

    const analysisResult = await callLovableChat(
      LOVABLE_API_KEY,
      "google/gemini-2.5-pro",
      [
        { role: "system", content: analysisSystemMsg },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: language === "zh"
                ? `【原照片】见图，【锐评内容】如下：\n\n${prompt}`
                : `[Original photo] attached. [Critique]:\n\n${prompt}`,
            },
            { type: "image_url", image_url: { url: imageData } },
          ],
        },
      ],
    );

    // Step 2: Multimodal LLM writes a precise i2i instruction that fixes EVERY issue.
    const systemMsg = language === "zh"
      ? `你是顶级人像摄影总监。任务：基于【原照片】+【问题分析】生成一段图生图(i2i)中文提示词，让结果成为"同一个人、同一身衣服、同一环境下，但拍得明显更好"的示范图。

【铁律一：人脸必须清晰锐利，绝对不能变形、模糊、糊脸】
- 人脸必须高清、五官清晰锐利、皮肤纹理自然真实，眼神有神，对焦点必须落在眼睛上。
- 严禁出现：脸部模糊、五官扭曲、双眼不对称变形、塑料感皮肤、磨皮过度、瞳孔变形、AI 拼贴痕迹、嘴部错位、牙齿融合、手指变形、肢体多余/缺失。
- 即便整体景别拉远，人脸像素也必须保持锐利可辨。
- 必须 100% 保留原图人物的脸：脸型、五官比例、眼睛形状和颜色、鼻型、嘴型、眉形、肤色、痣/雀斑、年龄感、发型、发色、发长。
- 不允许任何"美化换脸""韩式整容脸""网红脸""AI默认脸"。
- 必须保留原服装、配饰、鞋包、首饰、眼镜的款式、颜色、材质、花纹。
- 必须保留原环境/同一地点/同一主要场景元素。

【铁律二：结果必须明显比原图更好，绝对不能和原图几乎一样】
- 这是"示范图"，目的是让用户看到改进后的效果。**如果输出图和原图几乎一致，就是失败**。
- 必须在构图、光线、角度、姿势、表情、背景处理、色彩这些维度上做出**肉眼可见的优化**。
- 优化方向严格按照下面【铁律四】中详细锐评里指出的每一个缺点逐条修正。
- 同时把原图本来就有的优点和气质（见铁律三）放大到更高级、更专业的水准。

【铁律三：放大原照片的气质和优点】
- 先识别原图的气质（清冷、文艺、慵懒、英气、可爱、复古、酷飒、自然清新、电影感等）和它本身做对的地方（色调统一、构图干净、光线柔和等）。
- 在 i2i 提示词里**继续放大这种气质**，让它更纯粹、更高级，而不是换成另一种风格。
  · 清冷 → 进一步强调冷调高级灰、留白、克制表情、安静氛围
  · 文艺 → 强调胶片颗粒、柔光、自然姿态、生活化构图
  · 酷飒 → 强调硬光、对比度、利落姿态、低角度
  · 复古 → 强调暖调、颗粒、年代色彩
- **保留并强化原图本来就好的部分**，不要把原本的优点抹掉。

【铁律四：把详细锐评里指出的所有缺点都修掉】
逐项明确修复：构图（比例、主体位置、留白、地平线、引导线）、光线（光位、光质、光比、面部布光、避免顶光阴影）、姿势（手部、肩颈、重心、自然度）、表情（眼神方向、嘴角、放松度）、机位（高度、角度、距离）、背景（去杂物、虚化、层次）、色彩（色温、色调、对比度、肤色还原）、焦段（更适合人像的等效焦距）。每一条建议都必须落到提示词里成为可执行的拍摄指令。

【严禁】
- 换脸、变成另一个人、改五官比例、糊脸/变形脸
- 改衣服、改发型、改身材、改年龄、改性别
- 跳到完全不同的场景或风格
- **绝对禁止任何摄影器材或拍摄现场穿帮入画**：补光灯、柔光箱、灯架、反光板、影棚背景纸、提词器、三脚架、相机、麦克风、手持稳定器、收音杆、导演椅、剧组人员、化妆师、助理、路人围观、电线、闪光灯灯头、伞灯——一律不许出现在画面里
- **必须只输出最终成片**，不可以是"幕后照/拍摄花絮/工作照/中间状态"，画面里不能有任何暗示这是在被拍摄的元素
- 套用千篇一律的"AI网红脸+暖调奶油色"
- 输出几乎和原图一样的结果

【输出】
- 直接输出最终的中文 i2i 提示词，不要解释，不要分点。
- 第一句必须是身份锁 + 人脸锐度锁：明确写"必须是原图同一人，同一张脸，同一身衣服，同一环境；人脸高清锐利对焦在眼睛，绝不模糊变形"。
- 第二句写要放大的气质和保留的优点。
- 必须把【问题分析】里列出的缺点逐项硬修，不能遗漏；如果没修就是失败。
- 必须明确写出“成片与原图要有明显差异，但人物身份不能变”。
- 接下来按"构图 / 光线 / 姿势 / 表情 / 机位 / 背景 / 色彩 / 焦段"顺序，把锐评里指出的问题逐条改好，写成具体可执行的拍摄指令（例如"机位下蹲到胸口高度仰拍 15 度"）。
- 总长度 220–350 字。`
      : `You are a top portrait photography director. Task: based on the [original photo], write one Chinese-style image-to-image prompt so the result is "the same person, same outfit, same environment, but photographed visibly better".

[Rule 1: face must be SHARP, never blurry or distorted]
- Face must be high-resolution, sharp features, natural skin texture, eyes in focus.
- Forbidden: blurry face, distorted features, asymmetric eyes, plastic skin, over-smoothing, warped pupils, AI-collage artifacts, mismatched mouth, fused teeth, deformed fingers, extra/missing limbs.
- Even at wider framings, the face pixels must stay crisp.
- Keep 100% of the original face: face shape, feature proportions, eye shape and color, nose, mouth, brows, skin tone, moles/freckles, age, hairstyle, hair color, hair length.
- No beautified face, no generic AI face, no influencer face.
- Keep the exact outfit, accessories, shoes, bag, jewelry, glasses (style, color, material, pattern).
- Keep the same environment / location / major scene elements.

[Rule 2: result MUST be visibly better — never near-identical to the original]
- This is a reference shot. **If the output looks almost the same as the original, it is a failure.**
- Make visible improvements on composition, lighting, angle, pose, expression, background handling, color.
- Improvements must address every flaw listed by the critique below (Rule 4).
- At the same time, amplify the original strengths and mood (Rule 3) to a more refined, professional level.

[Rule 3: amplify the original mood and strengths]
- Identify the original mood (cool/aloof, artsy, lazy, sharp, cute, retro, edgy, fresh, cinematic) and the things it already does right.
- Push that mood further — purer, more refined. Do NOT swap to a different style.
- Preserve and strengthen the strong points of the original.

[Rule 4: fix every flaw the critique listed]
Address composition, lighting, pose, expression, camera angle, background, color, focal length one by one — turn each into a concrete shooting instruction.

[Forbidden]
- New face, different person, blurry/distorted face, changed feature proportions
- Changed clothes, hair, body, age, gender
- Different scene or different style
- **Absolutely NO photo equipment or behind-the-scenes leaking into frame**: no softboxes, fill lights, light stands, reflectors, studio backdrops, teleprompters, tripods, cameras, microphones, gimbals, boom poles, director chairs, crew members, makeup artists, assistants, onlookers, cables, strobes, umbrella lights — none of these may appear
- **Must output ONLY the finished final photograph**, never a BTS / making-of / work-in-progress shot. Nothing in the frame may suggest the subject is being photographed
- Generic "AI influencer face + warm cream tone"
- Output that looks essentially identical to the original

[Output]
- Output only the final i2i prompt in Chinese, no explanation, no bullet points.
- First sentence: identity + face-sharpness lock.
- Second sentence: which mood to amplify and which strengths to keep.
- You MUST fix every flaw listed in the analysis; missing fixes means failure.
- You MUST explicitly require a visibly improved result while preserving identity.
- Then in order — composition / lighting / pose / expression / angle / background / color / focal length — fix each issue from the critique with specific shooting instructions.
- 220–350 words total.`;
    let imagePrompt = await callLovableChat(
      LOVABLE_API_KEY,
      "google/gemini-2.5-pro",
      [
        { role: "system", content: systemMsg },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: language === "zh"
                ? `【原照片】见图，【锐评】如下：\n\n${prompt}\n\n【问题分析】\n${analysisResult}`
                : `[Original photo] attached. [Critique]:\n\n${prompt}\n\n[Analysis]\n${analysisResult}`,
            },
            { type: "image_url", image_url: { url: imageData } },
          ],
        },
      ],
    );

    // Reinforce identity-lock + face-sharpness + must-improve at prompt level
    const identityLock = language === "zh"
      ? "【绝对身份锁】：必须是原图同一个人，同一张脸，同一五官比例，同一眼型鼻型嘴型眉形，同一发型发色，同一肤色，同一年龄感，同一身衣服与配饰，同一环境与主体场景元素，不允许换人、不允许换脸、不允许AI重绘成陌生长相。【人脸锐度锁】：人脸必须高清、干净、锐利，对焦点必须落在眼睛上，眼睛鼻子嘴巴结构完整自然，绝不能模糊、拉扯、扭曲、双眼不对称、糊五官、塑料皮、嘴部错位、牙齿融合、手指畸形。【强修要求】：必须严格根据锐评和问题分析逐项修复缺点，尤其是构图、光线、姿势、表情、机位、背景、色彩与清晰度；成片必须比原图有肉眼可见的明显优化，不能只是小修小补，更不能和原图几乎一样。"
      : "[ABSOLUTE IDENTITY LOCK]: must be the exact same person from the original — same face, same feature proportions, same eyes, nose, mouth, brows, same hair, same skin tone, same age impression, same outfit, same accessories, same environment and scene elements. No face swap, no new person, no AI replacement face. [FACE SHARPNESS LOCK]: face must be clean, high-resolution, and sharp with eyes in focus; eyes, nose, mouth, skin texture, teeth, and fingers must remain natural and undistorted. No blur, stretch, asymmetry, mushy features, plastic skin, warped mouth, fused teeth, or deformed hands. [MANDATORY FIXES]: you must fix the flaws from the critique and analysis one by one, especially composition, lighting, pose, expression, angle, background, color, and sharpness. The result must be visibly improved, not lightly tweaked and never near-identical.";
    const negativeLock = language === "zh"
      ? "负面约束：禁止换脸、禁止陌生人、禁止韩式脸/AI网红脸、禁止改变五官比例、禁止改发型服装、禁止改年龄感和身材、禁止换场景、**绝对禁止任何摄影器材或拍摄现场穿帮入画**（补光灯/柔光箱/灯架/反光板/影棚背景纸/三脚架/相机/麦克风/稳定器/收音杆/伞灯/闪光灯灯头/电线/剧组人员/化妆师/助理/路人围观一律不许出现）、**只能输出最终成片，禁止幕后照/拍摄花絮/工作照/任何中间状态**、禁止千篇一律奶油暖调、禁止柔焦糊脸、禁止脸部和手部畸形、禁止只有磨皮不修问题、禁止输出与原图构图和光线都几乎相同的结果。"
      : "Negative: no face swap, no different person, no influencer AI face, no altered facial proportions, no changed hair or outfit, no changed age/body impression, no different scene. **ABSOLUTELY NO photo equipment or behind-the-scenes leaks in frame** (no softboxes, fill lights, light stands, reflectors, studio backdrops, tripods, cameras, microphones, gimbals, boom poles, umbrella lights, strobes, cables, crew, makeup artists, assistants, onlookers). **Output ONLY the finished final photo — never a BTS / making-of / work-in-progress shot, no intermediate state.** No generic creamy warm grading, no soft blurry face, no face/hand deformation, no simple beauty retouch without fixing flaws, and no output whose composition and lighting remain almost the same as the original.";
    imagePrompt = `${identityLock} ${negativeLock} ${imagePrompt}`;

    console.log("Image analysis:", analysisResult);
    console.log("Generated image prompt:", imagePrompt);

    // Step 3: Native image editing model generates the improved reference image
    const { width, height } = inferSizeFromImageData(imageData);
    const normalizedWidth = Math.max(512, Math.min(1920, Math.round(width / 32) * 32));
    const normalizedHeight = Math.max(512, Math.min(1920, Math.round(height / 32) * 32));

    const imageEditInstruction = language === "zh"
      ? `${imagePrompt}\n\n额外强约束：这不是重新生成陌生模特，而是基于原图做高质量优化编辑。必须保留原图人物身份一致性与场景一致性；人脸必须清晰锐利、五官稳定自然；必须明显修复锐评中提到的问题；输出不能与原图几乎一样。输出一张完成图，不要解释。`
      : `${imagePrompt}\n\nAdditional hard constraint: this is a high-quality edit of the original photo, not a newly invented model. Preserve the exact person identity and scene continuity; keep the face sharp and natural; visibly fix the flaws from the critique; never return an image that looks almost identical to the original. Output one finished image only, no explanation.`;

    const imageResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: imageEditInstruction },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
        modalities: ["image", "text"],
        image: {
          size: `${normalizedWidth}x${normalizedHeight}`,
        },
      }),
    });

    if (!imageResp.ok) {
      const errText = await imageResp.text();
      console.error("Image editing error:", imageResp.status, errText);
      throw new Error(`Image generation failed [${imageResp.status}]`);
    }

    const imageDataResult = await imageResp.json();
    const imageUrl = imageDataResult.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image URL in response:", JSON.stringify(imageDataResult));
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
