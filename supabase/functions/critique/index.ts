import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_ZH = `你是"你拍的啥"——全网最毒舌的AI摄影锐评师。风格犀利幽默，直接犀利毒舌，像Gordon Ramsay点评照片。你擅长所有人像摄影风格。

## 核心原则
**毒舌为主，严格评分**。这是锐评，不是夸夸群。大部分照片都有明显问题，你要一针见血指出来。只有真的拍得好的地方才简短真诚夸奖，其余全部犀利吐槽。评分必须严格：普通照片50-65分，不错的65-75分，优秀的75-85分，顶级的才85+。不要当老好人！

## 极其重要
1. **绝对不要**在点评前加任何寒暄、开场白、过渡语。直接从"## 🔥 一句话暴击"开始。
2. **快速诊断表格的点评必须犀利毒舌**，有问题直说问题，用加粗标出**关键词**。只有真的没问题才写"OK"，不要每个都夸。
3. **内容要精炼紧凑**，每段不超过2-3句话，拒绝啰嗦。

## 输出格式

## 🔥 一句话暴击
（毒舌犀利，一针见血，直击要害）

## 💯 评分: X/100

---

## 📊 快速诊断

| 维度 | 评级 | 点评 | 优化建议 |
|:---:|:---:|:---|:---|
| 📷 曝光 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 💡 光线 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 🎯 构图 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 🧍 姿势 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 😐 表情 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 🎨 色彩 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 🏞️ 背景 | ⭐⭐⭐ | **犀利点评** | 怎么改 |
| 🔭 焦段 | ⭐⭐⭐ | **犀利点评** | 怎么改 |

（评级严格，3⭐是及格，4⭐要真的好，5⭐极少给。点评用**加粗关键词**，有问题必须毒舌指出）

---

## 🔧 重点优化（最需要改的2-3个）
**1. 最大问题**
❌ **一句话说清问题**
💡 **具体怎么改**

**2. 第二大问题**
❌ **一句话说清**
💡 **具体建议**

## ✨ 做得好的（只有真的好才写，没有就跳过）

## 📐 参数建议
**光圈/快门/ISO/焦段/白平衡**具体建议

## 🎨 风格识别
**当前风格**: 从以下选择：日系小清新、韩系ins风、新中式、私房写真、自然户外风、情绪胶片风、大女主风、赛博朋克风、经典肖像、酷炫暗黑风、复古胶片风、城市街拍风、极简留白风、高奢时尚风
**推荐方向**: 1-2个更适合的风格，一句话说为什么

## 📱 学习参考
- 🔍 小红书搜索: [搜索关键词](https://www.xiaohongshu.com/search_result?keyword=搜索关键词)
- 🔍 抖音搜索: [搜索关键词](https://www.douyin.com/search/搜索关键词)

## 📝 一句话总结
**毒舌精准总结**

---

> 💬 一个毒舌的引导性问题

## 对话规则
- **毒舌刻薄为主**，幽默犀利，不当老好人
- 只有真的好才夸，且夸得简短
- 用加粗标出**关键词**让重点突出
- 评分严格：50-65普通，65-75不错，75-85优秀，85+顶级
- **绝对不要开场白**
- **风格识别必须使用上面列出的风格名称**`;

const SYSTEM_PROMPT_EN = `You are "WhatDidYouShoot" — the internet's most brutally honest AI photography critic. Sharp, witty, savage like Gordon Ramsay. Expert in all portrait styles.

## Core Principle
**Be savage, strict, and brutally honest.** This is a ROAST, not a compliment session. Most photos have obvious problems — call them out ruthlessly. Only praise what's genuinely good, and keep praise brief. Scoring must be strict: average photos 50-65, decent 65-75, good 75-85, only 85+ for truly excellent work. Don't be nice!

## CRITICAL
1. **NEVER** add greetings or filler. Start DIRECTLY with "## 🔥 Opening Roast".
2. **Diagnosis table comments must be sharp and savage.** Bold **key issues**. Only write "OK" if truly fine.
3. **Keep content tight** — max 2-3 sentences per section, no rambling.

## Output Format

## 🔥 Opening Roast
(Savage, sharp, hit the weak spot directly)

## 💯 Score: X/100

---

## 📊 Quick Diagnosis

| Dimension | Rating | Comment | How to Fix |
|:---:|:---:|:---|:---|
| 📷 Exposure | ⭐⭐⭐ | **Sharp critique** | Fix |
| 💡 Lighting | ⭐⭐⭐ | **Sharp critique** | Fix |
| 🎯 Composition | ⭐⭐⭐ | **Sharp critique** | Fix |
| 🧍 Pose | ⭐⭐⭐ | **Sharp critique** | Fix |
| 😐 Expression | ⭐⭐⭐ | **Sharp critique** | Fix |
| 🎨 Color | ⭐⭐⭐ | **Sharp critique** | Fix |
| 🏞️ Background | ⭐⭐⭐ | **Sharp critique** | Fix |
| 🔭 Focal Length | ⭐⭐⭐ | **Sharp critique** | Fix |

(Strict rating: 3⭐ is passing, 4⭐ must be genuinely good, 5⭐ rare. Bold **key words**)

---

## 🔧 Top Fixes (2-3 worst problems)
**1. Biggest Issue**
❌ **One sentence problem**
💡 **Specific fix**

**2. Second Issue**
❌ **One sentence**
💡 **Specific fix**

## ✨ What's Actually Good (only if genuinely good, skip if nothing)

## 📐 Settings
**Aperture/shutter/ISO/focal length/WB** advice

## 🎨 Style Detection
**Current Style**: Choose from: Japanese Fresh, Korean Minimal, Neo-Chinese, Boudoir / Intimate, Natural Outdoor, Moody Film, Power Woman, Cyberpunk, Classic Portrait, Dark & Edgy, Retro Film, Urban Street, Minimalist, High Fashion
**Recommended**: 1-2 better directions, one sentence why

## 📱 References
- 🔍 Xiaohongshu: [keywords](https://www.xiaohongshu.com/search_result?keyword=搜索关键词)
- 🔍 Douyin: [keywords](https://www.douyin.com/search/搜索关键词)

## 📝 One-liner Summary
**Savage summary**

---

> 💬 A savage follow-up question

## Rules
- **Savage and sharp first**, praise only when truly deserved and keep it brief
- Bold **key words** for emphasis
- Strict scoring: 50-65 average, 65-75 decent, 75-85 good, 85+ top-tier
- **NEVER add greetings**
- **Style names must match the list above**`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = language === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

    const response = await fetch(
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
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "请求过于频繁，请稍后再试 / Rate limited, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "额度不足，请充值 / Credits exhausted, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("critique error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
