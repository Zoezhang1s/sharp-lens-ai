import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, ImagePlus, Loader2, ArrowLeft, ZoomIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageData?: string;
}

const Critique = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const img = sessionStorage.getItem("critique-image");
    if (img) {
      setImageData(img);
      sessionStorage.removeItem("critique-image");
      // Auto-trigger critique
      const userMsg: Message = {
        role: "user",
        content: t("请点评这张照片", "Please critique this photo"),
        imageData: img,
      };
      setMessages([userMsg]);
      simulateCritique(img);
    } else {
      navigate("/");
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const simulateCritique = async (_img: string) => {
    setIsLoading(true);
    // Simulate AI response - will be replaced with real AI call
    await new Promise((r) => setTimeout(r, 2000));

    const critique = t(
      `## 🔥 总体定调

又来一张"自信之作"？让我仔细看看…

好吧，这张照片——怎么说呢——**及格线上挣扎**。你确定你在拍照而不是在做视力测试？

---

## 📊 分维度点评

### 📷 曝光与技术参数
曝光基本准确，但高光区域有轻微溢出。暗部细节被吃掉了一部分，你的直方图右端快要爆了。建议降低0.3-0.7EV曝光补偿。

### 💡 光线质量与方向
光线偏平，缺乏立体感。看起来像是正午直射光——**顶光骷髅光预警**！试试找个阴影处，或者等到黄金时段（日出后/日落前1小时），侧光45度角打过来，人脸的立体感立刻出来。

### 🎯 构图与视觉引导
主体居中构图，中规中矩。但画面上方留白过多，底部又截得太紧。建议使用三分法，把人物眼睛放在上三分之一线上。负空间运用= 0分。

### 🧍 人物姿势与肢体语言
双肩完全平行面对镜头——恭喜你拍出了"证件照既视感"。让模特身体转45度，前脚微曲交叉，重心放后腿。肩线要有倾斜，不然就是木桩一根。

### 😐 人物表情与眼神
表情僵硬，嘴角用力过猛，眼神没有光。建议在拍摄前和模特聊天让她放松，或者让她看向远方再突然回头看镜头，捕捉最自然的瞬间。

### 🎨 色彩与色调
色温偏冷，皮肤发灰。白平衡需要往暖方向调整200-300K。整体色调平淡，缺乏风格化后期处理。

### 🏞️ 背景与道具设计
背景杂乱——那个垃圾桶你是故意留的吗？人像摄影背景要么极简留白，要么与主题呼应。当前背景严重分散注意力。

### 🔭 焦段与景深
看起来像是用手机广角端拍的，人脸边缘有轻微畸变。建议使用2x或3x镜头（等效50-85mm），能有效压缩背景并减少畸变。

---

## 📐 相机参数建议
- **光圈**: F2.8 - F4（背景虚化同时保证人脸锐度）
- **快门**: 1/200s（防止手抖和模特微动）
- **ISO**: 100-400（保证画质纯净）
- **焦段**: 85mm（人像黄金焦段）
- **白平衡**: 5500-6000K（暖调）

---

## 🎨 风格建议
当前照片有**自然户外风**的雏形，但执行不到位。建议尝试：
1. **日系小清新** — 柔光+低饱和+空气感，适合当前场景
2. **情绪胶片风** — 加颗粒+复古色调，掩盖技术不足的同时增加氛围

---

## 💯 综合评分: 45/100

**一句话总结**: 技术底子薄弱，审美有想法但执行力约等于零。回去好好练基本功，别总想着靠滤镜救命。

---

> 💬 *想了解更多关于日系小清新的拍摄技巧吗？或者告诉我你是用手机还是相机拍的，我给你更针对性的建议。*`,

      `## 🔥 Overall Verdict

Another "masterpiece"? Let me take a closer look...

Well, this photo — how do I put it — is **barely scraping by**. Are you sure you were taking a photo and not testing your eyesight?

---

## 📊 Dimension-by-Dimension Critique

### 📷 Exposure & Technical Parameters
Exposure is roughly correct, but highlights are slightly blown. Shadow details are crushed. Your histogram is about to clip on the right. Dial down 0.3-0.7 EV exposure compensation.

### 💡 Light Quality & Direction
The light is flat, lacking dimensionality. Looks like harsh noon sunlight — **skull light warning**! Find some shade, or wait for golden hour (1 hour after sunrise / before sunset). A 45-degree side light will instantly add depth.

### 🎯 Composition & Visual Flow
Subject is dead center — boring but safe. Too much headroom on top, too tight at the bottom. Use the rule of thirds: place the eyes on the upper third line. Negative space usage = 0.

### 🧍 Pose & Body Language
Shoulders perfectly parallel to the camera — congrats on the passport photo vibe. Have the model turn 45 degrees, cross the front leg slightly, shift weight to the back leg. The shoulder line needs a tilt, or it's just a log.

### 😐 Expression & Eye Contact
Expression is stiff, smile is forced, eyes are dead. Chat with the model before shooting to help them relax. Or have them look away then quickly look back — capture that natural moment.

### 🎨 Color & Tone
Color temp is too cool, skin looks gray. Adjust white balance +200-300K warmer. Overall color grading is flat and lacks stylistic post-processing.

### 🏞️ Background & Props
Background is cluttered — was that trash can intentional? Portrait backgrounds should be minimal or thematic. The current background is a major distraction.

### 🔭 Focal Length & Depth of Field
Looks like a phone wide-angle shot with slight facial distortion. Use 2x or 3x lens (50-85mm equivalent) to compress the background and reduce distortion.

---

## 📐 Camera Settings Suggestion
- **Aperture**: F2.8 - F4 (bokeh while keeping face sharp)
- **Shutter**: 1/200s (prevent shake and micro-motion)
- **ISO**: 100-400 (keep noise minimal)
- **Focal Length**: 85mm (portrait sweet spot)
- **White Balance**: 5500-6000K (warm)

---

## 🎨 Style Recommendations
This photo hints at **Natural Outdoor** style but fails in execution. Try:
1. **Japanese Fresh** — Soft light + low saturation + airy feel, suits this scene
2. **Moody Film** — Add grain + vintage tones, masks technical flaws while adding atmosphere

---

## 💯 Overall Score: 45/100

**One-liner**: Weak technical foundation, some aesthetic vision but zero execution. Go practice your fundamentals — filters won't save you.

---

> 💬 *Want to know more about Japanese Fresh style shooting tips? Or tell me if you used a phone or camera — I can give more targeted advice.*`
    );

    setMessages((prev) => [...prev, { role: "assistant", content: critique }]);
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() && !isLoading) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Simulate response
    await new Promise((r) => setTimeout(r, 1500));
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: t(
          "好问题！这个我得好好说说你——\n\n具体回答需要接入AI后端，当前为演示模式。请启用 Lovable Cloud 来激活完整的AI点评功能。",
          "Good question! Let me tell you something—\n\nDetailed answers require the AI backend. This is currently in demo mode. Enable Lovable Cloud to activate full AI critique capabilities."
        ),
      },
    ]);
    setIsLoading(false);
  };

  const handleNewPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string;
      setImageData(img);
      const userMsg: Message = {
        role: "user",
        content: t("请点评这张新照片", "Please critique this new photo"),
        imageData: img,
      };
      setMessages((prev) => [...prev, userMsg]);
      simulateCritique(img);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen pt-14 flex flex-col">
      {/* Zoom modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setZoomedImage(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-up flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary/10 border border-primary/20 text-foreground"
                  : "glass-card text-foreground"
              }`}
            >
              {msg.imageData && (
                <div className="relative mb-3 group cursor-pointer" onClick={() => setZoomedImage(msg.imageData!)}>
                  <img src={msg.imageData} alt="Uploaded" className="rounded-lg max-h-60 object-cover w-full" />
                  <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-foreground" />
                  </div>
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap prose prose-invert prose-sm max-w-none [&_h2]:text-primary [&_h3]:text-foreground [&_strong]:text-foreground [&_hr]:border-border/30">
                {msg.content.split("\n").map((line, j) => {
                  if (line.startsWith("## ")) return <h2 key={j} className="text-base font-bold mt-4 mb-2 text-primary">{line.replace("## ", "")}</h2>;
                  if (line.startsWith("### ")) return <h3 key={j} className="text-sm font-semibold mt-3 mb-1">{line.replace("### ", "")}</h3>;
                  if (line.startsWith("---")) return <hr key={j} className="my-3 border-border/30" />;
                  if (line.startsWith("- **")) {
                    const parts = line.replace("- **", "").split("**:");
                    return <p key={j} className="text-sm my-0.5"><strong className="text-foreground">{parts[0]}</strong>:{parts[1]}</p>;
                  }
                  if (line.startsWith("> ")) return <blockquote key={j} className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">{line.replace("> ", "")}</blockquote>;
                  if (line.startsWith("1. ") || line.startsWith("2. ")) return <p key={j} className="text-sm ml-2 my-0.5">{line}</p>;
                  if (line.trim() === "") return <br key={j} />;
                  return <p key={j} className="text-sm my-0.5">{line.replace(/\*\*(.*?)\*\*/g, (_, m) => m)}</p>;
                })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-fade-up">
            <div className="glass-card px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">
                {t("正在审判中...", "Judging your photo...")}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleNewPhoto} className="hidden" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={t("输入你的问题...", "Ask a question...")}
            className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Critique;
