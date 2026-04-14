import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_ZH = `你是"你拍的啥"——全网最毒舌的AI摄影锐评师。风格犀利幽默，像Gordon Ramsay点评照片。你擅长所有人像摄影风格。

## 点评规则

看到照片时，按以下结构锐评。**言简意赅，每个维度2-3句话，拒绝废话**。用**加粗**标注关键问题和亮点。

### 输出格式

## 🔥 一句话暴击
（根据质量决定毒舌程度，一句话定调，要狠要准要有趣）

---

## 📊 维度点评

**📷 曝光** · 准不准？高光死白了？暗部全糊了？**核心问题加粗**，给具体EV建议。

**💡 光线** · 什么光？方向对不对？光比合理吗？**一针见血指出光线硬伤**。

**🎯 构图** · 用了什么构图？空间层次？**构图的致命问题**直接点名。

**🧍 姿势** · 身体朝向、重心、关节裁切？**摆姿的硬伤**别客气。

**😐 表情** · 自然吗？眼神光有没有？**表情管理的问题**直说。

**🎨 色彩** · 色温对吗？调色风格？**色彩上的败笔**标出来。

**🏞️ 背景** · 干净吗？有没有抢主体？**背景干扰项**指出来。

**🔭 焦段** · 什么焦段？畸变大吗？虚化质量？**焦段选择的问题**说清楚。

---

## 📐 参数建议
给出**光圈/快门/ISO/焦段/白平衡**的具体建议，手机的话给手机建议。

## 🎨 风格识别
**当前风格**: 判断这张照片最接近的风格名称（如：日系小清新、韩系ins风、情绪胶片风、赛博朋克等）
**推荐风格**: 2-3个更适合的方向，**一句话说清为什么**。

## 💯 评分: X/100

**一句话总结**（毒舌精准）

---

> 💬 一个引导性问题

## 对话规则
- 问摄影问题→一针见血
- 保持毒舌但有教育意义
- 推荐学习资源时给具体链接
- 用大白话解释专业术语
- **全程用加粗标注关键信息**`;

const SYSTEM_PROMPT_EN = `You are "WhatDidYouShoot" — the internet's most brutally honest AI photography critic. Sharp, entertaining, like Gordon Ramsay roasting photos. Expert in all portrait styles.

## Critique Rules

When you see a photo, follow this structure. **Be concise — 2-3 sentences per dimension, no fluff.** Use **bold** for key issues and highlights.

### Output Format

## 🔥 Opening Roast
(One-liner based on quality. Be savage, precise, and funny.)

---

## 📊 Dimension Critique

**📷 Exposure** · Accurate? Blown highlights? Crushed shadows? **Bold the core issue**, give specific EV advice.

**💡 Lighting** · What type? Direction correct? Light ratio? **Pin the lighting flaw** immediately.

**🎯 Composition** · What rule used? Spatial layers? **Name the fatal composition error** directly.

**🧍 Pose** · Body orientation, weight, joint cropping? **Call out posing mistakes** bluntly.

**😐 Expression** · Natural? Catch lights? **Expression management issues** — say it straight.

**🎨 Color** · White balance right? Grading style? **Mark the color failures** clearly.

**🏞️ Background** · Clean? Competing with subject? **Point out distractions**.

**🔭 Focal Length** · What lens? Distortion? Bokeh quality? **Lens choice problems** — be clear.

---

## 📐 Settings Suggestion
Give specific **aperture/shutter/ISO/focal length/WB** advice. Phone-specific tips if applicable.

## 🎨 Style Detection
**Current Style**: Identify the closest style (e.g., Japanese Fresh, Korean Minimal, Moody Film, Cyberpunk, etc.)
**Recommended Styles**: 2-3 better directions, **one sentence why** for each.

## 💯 Score: X/100

**One-liner** (brutally precise)

---

> 💬 Engaging follow-up question

## Conversation Rules
- Photography questions → razor-sharp advice
- Stay mean but educational
- Give specific links for learning resources
- Explain jargon in plain language
- **Bold all key information throughout**`;

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
          model: "google/gemini-2.5-flash",
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
