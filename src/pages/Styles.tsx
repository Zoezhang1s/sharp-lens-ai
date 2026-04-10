import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

interface StyleItem {
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  keywords: string[];
  emoji: string;
}

const STYLES: StyleItem[] = [
  { nameZh: "日系小清新", nameEn: "Japanese Fresh", descZh: "柔光、低饱和、空气感、干净透亮", descEn: "Soft light, low saturation, airy, clean & bright", keywords: ["柔光", "低饱和", "空气感"], emoji: "🌸" },
  { nameZh: "韩系ins风", nameEn: "Korean Minimal", descZh: "高级灰、精致妆造、干净背景、冷调质感", descEn: "Muted grays, polished styling, clean background", keywords: ["高级灰", "精致", "冷调"], emoji: "🧊" },
  { nameZh: "新中式", nameEn: "Neo-Chinese", descZh: "汉服、国风场景、古典意境、东方美学", descEn: "Hanfu, traditional scenes, classical aesthetics", keywords: ["汉服", "国风", "意境"], emoji: "🏮" },
  { nameZh: "私房写真", nameEn: "Boudoir / Intimate", descZh: "室内软光、亲密感、生活化、自然放松", descEn: "Indoor soft light, intimate, lifestyle, relaxed", keywords: ["室内", "软光", "亲密"], emoji: "🛋️" },
  { nameZh: "自然户外风", nameEn: "Natural Outdoor", descZh: "自然光、环境融合、轻松状态、真实感", descEn: "Natural light, environmental blend, relaxed state", keywords: ["自然光", "户外", "真实"], emoji: "🌿" },
  { nameZh: "情绪胶片风", nameEn: "Moody Film", descZh: "颗粒感、复古色调、故事氛围、情绪张力", descEn: "Grain, vintage tones, narrative mood, emotional tension", keywords: ["颗粒", "复古", "情绪"], emoji: "📽️" },
  { nameZh: "大女主风", nameEn: "Power Woman", descZh: "强势姿态、戏剧光线、高级感、气场全开", descEn: "Powerful pose, dramatic lighting, commanding presence", keywords: ["强势", "戏剧", "高级"], emoji: "👑" },
  { nameZh: "经典肖像", nameEn: "Classic Portrait", descZh: "标准布光、五官立体、永恒感、正式大气", descEn: "Standard lighting, dimensional features, timeless, formal", keywords: ["标准布光", "立体", "永恒"], emoji: "🖼️" },
  { nameZh: "欧美辣妹风", nameEn: "Western Hot Girl", descZh: "高饱和、强对比、张扬姿态、自信大胆", descEn: "High saturation, strong contrast, bold & confident", keywords: ["高饱和", "张扬", "大胆"], emoji: "🔥" },
  { nameZh: "酷炫暗黑风", nameEn: "Dark & Edgy", descZh: "低调暗光、冷色系、硬朗线条、神秘感", descEn: "Low-key dark light, cool tones, hard lines, mysterious", keywords: ["暗光", "冷色", "硬朗"], emoji: "🖤" },
  { nameZh: "清冷禁欲风", nameEn: "Cold & Aloof", descZh: "冷光、疏离感、极简构图、高冷气质", descEn: "Cold light, distant feel, minimal composition", keywords: ["冷光", "疏离", "极简"], emoji: "❄️" },
  { nameZh: "故事感叙事风", nameEn: "Narrative Story", descZh: "环境叙事、人物状态自然、画面有情节感", descEn: "Environmental storytelling, natural states, cinematic feel", keywords: ["叙事", "情节", "自然"], emoji: "📖" },
  { nameZh: "复古胶片风", nameEn: "Retro Film", descZh: "漏光、颗粒、70-90年代色调、怀旧感", descEn: "Light leaks, grain, 70s-90s tones, nostalgic", keywords: ["漏光", "颗粒", "怀旧"], emoji: "📷" },
  { nameZh: "森系仙气风", nameEn: "Forest Ethereal", descZh: "自然植被、柔光、飘逸感、仙气十足", descEn: "Natural foliage, soft light, flowing, ethereal", keywords: ["植被", "柔光", "飘逸"], emoji: "🧚" },
  { nameZh: "城市街拍风", nameEn: "Urban Street", descZh: "街头环境、自然抓拍、纪实感、都市气息", descEn: "Street environment, candid shots, documentary feel", keywords: ["街头", "抓拍", "纪实"], emoji: "🏙️" },
  { nameZh: "高奢时尚风", nameEn: "High Fashion", descZh: "硬光、高对比、杂志质感、奢华感", descEn: "Hard light, high contrast, magazine quality, luxury", keywords: ["硬光", "杂志", "奢华"], emoji: "💎" },
  { nameZh: "糖水人像风", nameEn: "Sweet Portrait", descZh: "甜美、柔焦、暖色调、小清新进阶", descEn: "Sweet, soft focus, warm tones, enhanced fresh look", keywords: ["甜美", "柔焦", "暖色"], emoji: "🍬" },
  { nameZh: "极简留白风", nameEn: "Minimalist", descZh: "大面积负空间、简洁背景、主体突出", descEn: "Large negative space, clean background, subject focus", keywords: ["负空间", "简洁", "突出"], emoji: "⬜" },
  { nameZh: "赛博朋克风", nameEn: "Cyberpunk", descZh: "霓虹灯光、城市夜景、科技感、未来风", descEn: "Neon lights, city nights, tech feel, futuristic", keywords: ["霓虹", "夜景", "科技"], emoji: "🌆" },
  { nameZh: "田园乡村风", nameEn: "Pastoral Rural", descZh: "自然光、乡村场景、质朴感、温暖治愈", descEn: "Natural light, rural scenes, rustic, warm & healing", keywords: ["乡村", "质朴", "治愈"], emoji: "🌾" },
];

const Styles = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-14 px-4 pb-8">
      <div className="max-w-5xl mx-auto">
        <div className="py-8 text-center">
          <h1 className="text-3xl font-bold text-gradient-gold mb-2">
            {t("风格百科", "Style Encyclopedia")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("探索20+人像摄影风格，点击了解拍摄技巧", "Explore 20+ portrait photography styles, click to learn shooting tips")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {STYLES.map((style, i) => (
            <button
              key={i}
              onClick={() => {
                sessionStorage.setItem("style-query", lang === "zh" ? style.nameZh : style.nameEn);
                navigate("/critique");
              }}
              className="glass-card-hover p-4 text-left group"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{style.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                    {lang === "zh" ? style.nameZh : style.nameEn}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {lang === "zh" ? style.descZh : style.descEn}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {style.keywords.map((kw, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Styles;
