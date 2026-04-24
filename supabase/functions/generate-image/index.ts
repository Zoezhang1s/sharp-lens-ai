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
      ? `你是顶级人像摄影总监兼造型策划。你的任务是先把原图的问题彻底拆解，再给出一段「重新拍一张真正好看的参考图」的执行指令。

【核心定位】
- 这不是磨皮修图，而是**为同一个人、同一身衣服重新策划并拍摄一张明显更高级的人像作品**。
- 构图、光线、姿势、动作、表情、机位、焦段、氛围、色调 —— **全部都可以大幅改变**，目标是打造一张真正有亮点、可以当作参考的好照片。
- **场景/背景需要保持同一主题**：必须是原图场景的"升级优化版"，不能跳到完全不相关的另一个地方。例如原图是海边 → 新图也是海边但更出片的机位/角度/时段；原图是咖啡馆 → 新图还是咖啡馆但是更有氛围的角落和光线；原图是街头 → 新图还是同类街头但更干净更电影感。原场景的核心元素（地点类型、主要环境特征）必须延续，但可以让它变得更干净、更有氛围、更上镜。
- **唯一不能变的有两样**：人脸身份 + 身上穿的衣服。其余一切都应该围绕"如何让这个人这身衣服在同一主题场景里拍得最好看"来重新设计。

【必须分析的维度】
1. 原图已有优点（最多 3 条，作为可继承的方向参考）
2. 原图明确缺点（至少 5 条，必须具体到构图/光线/姿势/表情/背景/色彩/机位）
3. 原图场景的主题判断（海边/街头/咖啡馆/室内/公园/天台/商场/校园等），新图必须延续这个主题但优化执行
4. 这身衣服 + 这个人 + 这个主题场景下，什么光线、什么姿势、什么机位、什么气质能把人和衣服都衬托到最好
5. 锐评里指出的每一个问题在新图里如何被彻底避开

【身份与服装铁律】
- 必须是同一个人，同一张脸，同一五官比例，同一发型发色，同一肤色与年龄感。
- 必须是原图同一身衣服（款式、颜色、材质、花纹、配饰都要一致）。
- 严禁模糊脸、变形脸、双眼不对称、塑料皮、AI 默认脸、陌生人替换。
- 眼睛必须清晰对焦，鼻口结构不能错位，手指和肢体不能畸形。

【可以也应该大幅改变的维度】
- 背景细节：在同一主题场景下换到更干净、更有层次、更有氛围的角落或机位
- 姿势/动作：可以完全重新设计成更自然、更有张力、更上镜的姿态
- 光线：可以换成完全不同的光位、光质、时间段（黄金时刻/蓝调时刻/柔光/逆光等）
- 表情/眼神：可以重新设计更动人的情绪
- 机位/焦段/景别：可以重新选最合适的拍摄角度

【输出格式】
只输出 3 段：
优点：...
缺点：...
优化指令：...

其中"优化指令"必须是给下一步图生图模型使用的中文高强度执行说明，明确写出原场景的主题判断、在同一主题下的升级版背景、新姿势、新光线、新构图、新表情，让结果是一张和原图明显不同但同主题、人脸和服装一致的高质量参考图。`
      : `You are a top portrait director and creative producer. Your task is to fully diagnose the original photo, then write an execution brief to **re-shoot a genuinely beautiful reference photo** of the same person in the same outfit.

[Core positioning]
- This is NOT light retouching. It is **re-planning and re-shooting** a clearly superior portrait of the same person wearing the same clothes.
- Composition, lighting, pose, action, expression, camera angle, focal length, mood, color grading — **all can change drastically**. The goal is a real, look-worthy reference photo.
- **Scene/background must stay on the same theme**: the new shot must be an "upgraded version" of the original scene, NOT a jump to a totally unrelated location. E.g. original beach → new shot still at the beach but with a more cinematic angle/time of day; original cafe → still a cafe but a more atmospheric corner with better light; original street → same kind of street but cleaner and more cinematic. The core elements of the original location (location type, main environmental features) must continue, but it can be made cleaner, more atmospheric, and more photogenic.
- **Only two things must stay locked**: face identity and outfit. Everything else should be redesigned to make this person in this outfit look as good as possible within the same scene theme.

[Must analyze]
1. Existing strengths (max 3, as direction hints)
2. Specific flaws (at least 5: composition / lighting / pose / expression / background / color / camera angle)
3. Theme of the original scene (beach / street / cafe / indoor / park / rooftop / mall / campus etc) — the new shot must continue this theme but execute it better
4. The best lighting, pose, camera angle, mood for this person + this outfit + this scene theme
5. How the new shot will completely avoid each flaw the critique called out

[Identity and outfit rules]
- Same person, same face, same proportions, same hair, same skin tone, same age impression.
- Same outfit from the original (style, color, material, pattern, accessories all preserved).
- No blur, no face distortion, no asymmetric eyes, no plastic skin, no generic AI face.

[What can and SHOULD change drastically]
- Background details: within the same scene theme, switch to a cleaner, more layered, more atmospheric corner or angle
- Pose / action: fully redesign into a more natural, dynamic, photogenic pose
- Lighting: different light position, quality, time of day (golden hour / blue hour / soft / backlit)
- Expression / gaze: redesign a more compelling emotion
- Camera angle / focal length / framing: pick the best shot for this subject

[Output format]
Three sections only:
Strengths: ...
Flaws: ...
Optimization instruction: ...

The "Optimization instruction" must be a Chinese high-intensity execution brief specifying the original scene theme, an upgraded background within that same theme, new pose, new lighting, new composition, and new expression — producing a clearly different but same-themed, identity- and outfit-consistent high-quality reference image.`;

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
      ? `你是顶级人像摄影总监 + 创意造型师。任务：基于【原照片】+【问题分析】生成一段中文图生图(i2i)提示词，让结果成为「同一个人、同一身衣服，但被重新策划、重新拍摄成一张真正高级、真正好看、可以当作参考的人像作品」。

【铁律一：锁定人脸 + 服装 + 场景主题，其余一切重新设计】
- **绝对不能变**：人脸（脸型、五官比例、眼鼻嘴眉、肤色、发型发色发长、年龄感、痣/雀斑） + 身上所有服装配饰（款式、颜色、材质、花纹、鞋包、首饰、眼镜全部一致）。
- **场景主题必须延续**：原图是什么类型的地点（海边/街头/咖啡馆/室内/天台/公园/校园/商场/家中等），新图就必须还在这个类型的场景里，**不能跳到完全不相关的另一个地方**。但要在同一主题下选一个更干净、更有氛围、更出片的角落、机位、时间段，把原场景做"升级版"。
- **可以也必须大幅改变**：构图、光线（光位/光质/色温/时间段）、姿势、动作、肢体语言、表情、眼神、机位、角度、焦段、景别、氛围、色调、背景细节（在同一主题下变得更干净更有层次）。
- 这不是给原图磨皮调色，而是带着同一个人 + 同一身衣服在同一个主题场景里重新拍一张完全不同但明显更好看的照片。
- 如果输出图和原图的姿势、构图、光线都还差不多 → 就是失败；如果跳到完全无关的地点 → 也是失败。

【铁律二：人脸必须清晰锐利，绝对不能糊脸/变形】
- 人脸必须高清、五官清晰锐利、皮肤纹理自然真实，眼神有神，对焦点必须落在眼睛上。
- 严禁：脸部模糊、五官扭曲、双眼不对称、塑料皮、磨皮过度、瞳孔变形、AI 拼贴痕迹、嘴部错位、牙齿融合、手指畸形、肢体多余/缺失。
- 即便景别拉远，人脸像素也必须保持锐利可辨。
- 不允许"美化换脸""韩式整容脸""网红脸""AI默认脸"。

【铁律三：必须打造一张真正有亮点的好照片】
- 在原场景主题下，判断这身衣服 + 这个人最适合的拍摄方向（街头电影感 / 复古胶片 / 高级杂志感 / 自然清新生活流 / 暗调艺术 / 阳光通透 / 夜景霓虹 等），选最能衬托人和衣服的方向。
- 设计一个**有故事感、有氛围感、构图讲究**的画面：明确的主光方向、干净有层次的背景、自然舒展且上镜的姿态、生动的眼神和情绪。
- 必须有专业摄影师的取景思路：黄金分割/三分法、引导线、前后景层次、合适的负空间、合理的虚实关系。
- 必须有真实摄影质感：自然光影过渡、合理的景深、真实皮肤质感、电影级色彩。

【铁律四：把锐评里指出的所有缺点都彻底避开】
锐评里说构图有问题 → 新图就用完全不同且优秀的构图；说光线平/硬/脏 → 换成讲究的布光；说姿势僵 → 重新设计自然有张力的姿态；说背景乱 → 在同一主题下换到更干净有氛围的角落；说表情木 → 重新设计生动的眼神和情绪；说色调差 → 重新定调。每一条缺点都不允许在新图中再次出现。

【严禁】
- 换脸、变成另一个人、改五官比例、糊脸/变形脸
- 改衣服款式/颜色/花纹、改发型、改身材、改年龄、改性别
- 跳到与原场景主题完全无关的另一个地点
- 输出和原图姿势、构图、光线都几乎一样的"小修小补"结果
- **绝对禁止任何摄影器材或拍摄现场穿帮入画**：补光灯、柔光箱、灯架、反光板、影棚背景纸、提词器、三脚架、相机、麦克风、手持稳定器、收音杆、导演椅、剧组人员、化妆师、助理、路人围观、电线、闪光灯灯头、伞灯——一律不许出现
- **必须只输出最终成片**，不可以是幕后照/拍摄花絮/工作照/中间状态
- 套用千篇一律的"AI网红脸+暖调奶油色"

【输出】
- 直接输出最终的中文 i2i 提示词，一段连贯文字，不要解释，不要分点。
- 第一句必须是身份与服装锁 + 人脸锐度锁 + 场景主题延续锁。
- 接下来用具体可执行的拍摄语言写清楚：原场景主题（必须延续）、同主题下的升级版背景细节、新光线（光位+光质+色温+时间段）、新姿势/动作（肢体+手部+重心）、新表情/眼神、新机位（高度+角度+距离）、新构图（景别+取景+前后景）、新色调、新焦段。
- 必须明确写出"成片要和原图在姿势、构图、光线上明显不同，但保持原场景主题、人脸和服装一致"。
- 总长度 240–380 字。`
      : `You are a top portrait director and creative stylist. Task: based on [original photo] + [analysis], write one Chinese image-to-image prompt so the result is "the same person in the same outfit, but completely re-planned and re-shot as a genuinely high-end, genuinely beautiful reference portrait".

[Rule 1: lock face + outfit + scene theme, redesign EVERYTHING else]
- **Locked**: face (shape, proportions, eyes/nose/mouth/brows, skin tone, hair style/color/length, age, moles) + entire outfit and accessories (style, color, material, pattern, shoes, bag, jewelry, glasses).
- **Scene theme MUST continue**: identify the original location type (beach / street / cafe / indoor / rooftop / park / campus / mall / home etc) — the new shot MUST stay in that same location type. **Do NOT jump to a totally unrelated location.** But within the same theme, choose a cleaner, more atmospheric, more photogenic corner, angle, or time of day — make it the "upgraded version" of the original scene.
- **Can and MUST change drastically**: composition, lighting (position/quality/color temp/time of day), pose, action, body language, expression, gaze, camera angle, focal length, framing, mood, color grading, background details (cleaner and more layered within the same theme).
- This is NOT retouching the original. It is taking the same person in the same outfit, staying in the same scene theme, and shooting a totally different and clearly better photo.
- If the output's pose, composition, and lighting still resemble the original → failure. If it jumps to a totally unrelated location → also failure.

[Rule 2: face must stay sharp, never blurry/distorted]
- High-resolution face, sharp features, natural skin texture, eyes in focus.
- Forbidden: blurry face, distorted features, asymmetric eyes, plastic skin, over-smoothing, warped pupils, mismatched mouth, fused teeth, deformed fingers/limbs.
- Even at wider framings the face must stay crisp.
- No beautified face, no influencer face, no generic AI face.

[Rule 3: deliver a genuinely strong photograph]
- Within the original scene theme, pick the best direction for this outfit + person (cinematic street / retro film / editorial magazine / fresh lifestyle / moody art / sunlit airy / neon night, etc).
- Design a frame with story, atmosphere, and intentional composition: clear key light, clean layered background, natural photogenic posture, vivid gaze and emotion.
- Use professional framing: rule-of-thirds, leading lines, foreground/background depth, negative space, considered focus.
- Real photographic quality: natural light transitions, proper depth of field, real skin texture, cinematic color.

[Rule 4: completely avoid every flaw the critique listed]
If composition was bad → use a totally different excellent composition; flat/harsh/dirty lighting → designed lighting; stiff pose → newly designed natural pose; messy background → cleaner atmospheric corner within the same theme; dull expression → vivid gaze and emotion; bad grading → new color tone. None of the original flaws may reappear.

[Forbidden]
- New face, different person, changed feature proportions, blurry/distorted face
- Changed outfit style/color/pattern, changed hair, body, age, gender
- Jumping to a location whose theme is unrelated to the original
- A near-identical "lightly tweaked" output where pose/composition/lighting match the original
- **No photo equipment or BTS in frame**: no softboxes, fill lights, light stands, reflectors, studio backdrops, tripods, cameras, microphones, gimbals, boom poles, umbrella lights, strobes, cables, crew, makeup artists, assistants, onlookers
- **Output only the final finished photo**, never BTS / making-of / WIP
- Generic "AI influencer face + creamy warm tone"

[Output]
- Output only the final Chinese i2i prompt as one cohesive paragraph, no explanation, no bullets.
- First sentence: identity + outfit lock + face sharpness lock + scene-theme continuity lock.
- Then describe in concrete shooting language: original scene theme (must continue), upgraded background details within the same theme, new lighting (position + quality + color temp + time of day), new pose/action (body + hands + weight), new expression/gaze, new camera (height + angle + distance), new composition (framing + foreground/background), new color tone, new focal length.
- Must explicitly require: "result must clearly differ from the original in pose/composition/lighting, but keep the original scene theme, face, and outfit identical".
- 240–380 words total.`;
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
      ? "【绝对身份锁】：必须是原图同一个人，同一张脸，同一五官比例，同一眼型鼻型嘴型眉形，同一发型发色，同一肤色，同一年龄感；必须穿着原图同一身衣服与配饰（款式、颜色、材质、花纹、鞋包首饰眼镜全部一致），不允许换人、换脸、改服装、AI重绘成陌生长相。【人脸锐度锁】：人脸必须高清、干净、锐利，对焦点必须落在眼睛上，眼睛鼻子嘴巴结构完整自然，绝不能模糊、拉扯、扭曲、双眼不对称、糊五官、塑料皮、嘴部错位、牙齿融合、手指畸形。【场景主题延续锁】：必须保留原图的场景主题（同一类型的地点：海边/街头/咖啡馆/室内/天台/公园/校园/商场/家中等），**不许跳到完全无关的另一个地点**，但可以在同主题下换到更干净、更有氛围、更出片的角落、机位、时间段，把原场景做"升级版"。【重新策划要求】：构图、光线、姿势、动作、表情、机位、角度、焦段、色调全部都要重新设计，目标是为这个人和这身衣服在同主题场景里打造一张真正高级、有亮点、可以当作参考的人像作品；成片在姿势、构图、光线上必须与原图明显不同，不能只是小修小补。"
      : "[ABSOLUTE IDENTITY LOCK]: must be the exact same person from the original — same face, same feature proportions, same eyes, nose, mouth, brows, same hair, same skin tone, same age impression; must wear the exact same outfit and accessories from the original (style, color, material, pattern, shoes, bag, jewelry, glasses all identical). No face swap, no new person, no outfit change, no AI replacement face. [FACE SHARPNESS LOCK]: face must be clean, high-resolution, and sharp with eyes in focus; eyes, nose, mouth, skin texture, teeth, and fingers must remain natural and undistorted. No blur, stretch, asymmetry, mushy features, plastic skin, warped mouth, fused teeth, or deformed hands. [SCENE-THEME CONTINUITY LOCK]: must preserve the original scene theme (same location type — beach / street / cafe / indoor / rooftop / park / campus / mall / home etc). **Do NOT jump to a totally unrelated location.** Within the same theme, switch to a cleaner, more atmospheric, more photogenic corner, angle, or time of day — make it the upgraded version of the original scene. [RE-PLAN REQUIREMENT]: composition, lighting, pose, action, expression, camera angle, focal length, color tone must all be redesigned — deliver a genuinely high-end, look-worthy reference portrait of this person in this outfit within the same scene theme. The result must clearly differ from the original in pose, composition, and lighting; it must not be a light tweak.";
    const negativeLock = language === "zh"
      ? "负面约束：禁止换脸、禁止陌生人、禁止韩式脸/AI网红脸、禁止改变五官比例、禁止改发型、禁止改服装款式颜色花纹、禁止改年龄感和身材、禁止跳到与原图主题完全无关的另一个地点、**绝对禁止任何摄影器材或拍摄现场穿帮入画**（补光灯/柔光箱/灯架/反光板/影棚背景纸/三脚架/相机/麦克风/稳定器/收音杆/伞灯/闪光灯灯头/电线/剧组人员/化妆师/助理/路人围观一律不许出现）、**只能输出最终成片，禁止幕后照/拍摄花絮/工作照/任何中间状态**、禁止千篇一律奶油暖调、禁止柔焦糊脸、禁止脸部和手部畸形、禁止只有磨皮不修问题、禁止输出与原图姿势构图光线都几乎相同的结果。"
      : "Negative: no face swap, no different person, no influencer AI face, no altered facial proportions, no changed hair, no changed outfit style/color/pattern, no changed age/body impression, no jumping to a location whose theme is unrelated to the original. **ABSOLUTELY NO photo equipment or behind-the-scenes leaks in frame** (no softboxes, fill lights, light stands, reflectors, studio backdrops, tripods, cameras, microphones, gimbals, boom poles, umbrella lights, strobes, cables, crew, makeup artists, assistants, onlookers). **Output ONLY the finished final photo — never a BTS / making-of / work-in-progress shot.** No generic creamy warm grading, no soft blurry face, no face/hand deformation, no simple beauty retouch, and no output whose pose/composition/lighting still resembles the original.";
    imagePrompt = `${identityLock} ${negativeLock} ${imagePrompt}`;

    console.log("Image analysis:", analysisResult);
    console.log("Generated image prompt:", imagePrompt);

    // Step 3: Native image editing model generates the improved reference image
    const { width, height } = inferSizeFromImageData(imageData);
    const normalizedWidth = Math.max(512, Math.min(1920, Math.round(width / 32) * 32));
    const normalizedHeight = Math.max(512, Math.min(1920, Math.round(height / 32) * 32));

    const imageEditInstruction = language === "zh"
      ? `${imagePrompt}\n\n额外强约束：把原图作为人脸、服装、场景主题的身份参考。要为这个人和这身衣服在同一主题场景下重新策划并拍摄一张完全不同、明显更高级、有亮点的参考照片：场景主题必须延续（同类型的地点），但可以换到同主题下更干净、更有氛围的角落或机位；构图、光线、姿势、动作、表情、机位都必须重新设计，**不能只是在原图基础上微调**，**也不能跳到完全无关的另一个地方**。人脸必须清晰锐利、五官稳定自然；服装必须和原图完全一致；成片必须是一张真正好看的人像作品。输出一张完成图，不要解释。`
      : `${imagePrompt}\n\nAdditional hard constraint: treat the original photo as a reference for face identity, outfit, and scene theme. Re-plan and re-shoot a completely different, clearly more elevated, look-worthy reference portrait of this person in this outfit, **staying within the same scene theme** (same type of location) — switch to a cleaner, more atmospheric corner or angle within that same theme. Composition, lighting, pose, action, expression, and camera angle must all be redesigned — **do NOT lightly tweak the original, and do NOT jump to a totally unrelated location**. Keep the face sharp and natural; keep the outfit identical to the original; deliver a genuinely beautiful portrait. Output one finished image only, no explanation.`;

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
