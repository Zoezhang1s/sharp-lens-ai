import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, ExternalLink, Camera, Palette, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STYLE_DATA } from "@/data/styleData";

const StyleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  const style = STYLE_DATA.find((s) => s.id === id);

  if (!style) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{t("未找到该风格", "Style not found")}</p>
          <Button variant="ghost" onClick={() => navigate("/styles")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("返回", "Back")}
          </Button>
        </div>
      </div>
    );
  }

  const sections = [
    {
      icon: Camera,
      titleZh: "拍摄指南",
      titleEn: "Shooting Guide",
      content: lang === "zh" ? style.shootingGuideZh : style.shootingGuideEn,
    },
    {
      icon: User,
      titleZh: "姿势引导",
      titleEn: "Pose Guide",
      content: lang === "zh" ? style.poseGuideZh : style.poseGuideEn,
    },
    {
      icon: Palette,
      titleZh: "色调调整",
      titleEn: "Color Grading",
      content: lang === "zh" ? style.colorGuideZh : style.colorGuideEn,
    },
  ];

  return (
    <div className="min-h-screen pt-14 px-4 pb-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="py-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/styles")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <span>{style.emoji}</span>
              {lang === "zh" ? style.nameZh : style.nameEn}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "zh" ? style.descZh : style.descEn}
            </p>
          </div>
        </div>

        {/* Reference Image */}
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            🎨 {t("风格参考图", "Style Reference")}
          </h3>
          <img
            src={style.referenceImageUrl}
            alt={style.nameEn}
            className="rounded-lg w-full aspect-[4/3] object-cover"
            loading="lazy"
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {t("图片来源: Unsplash", "Image source: Unsplash")}
          </p>
        </div>

        {/* Camera Settings */}
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t("推荐参数", "Recommended Settings")}
          </h3>
          <p className="text-sm text-foreground font-mono bg-secondary/50 rounded-lg px-3 py-2">
            {lang === "zh" ? style.settingsZh : style.settingsEn}
          </p>
        </div>

        {/* Guide Sections */}
        <div className="space-y-4 mb-6">
          {sections.map((section, i) => (
            <div key={i} className="glass-card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <section.icon className="w-4 h-4" />
                {lang === "zh" ? section.titleZh : section.titleEn}
              </h3>
              <div className="text-sm text-foreground leading-relaxed space-y-1">
                {section.content.split("\n").map((line, j) => {
                  // Render bold markdown
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  return (
                    <p key={j} className="my-0.5">
                      {parts.map((part, k) =>
                        k % 2 === 1 ? (
                          <strong key={k} className="text-primary">{part}</strong>
                        ) : (
                          <span key={k}>{part}</span>
                        )
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Tutorial Links */}
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            📚 {t("教程推荐", "Tutorial Links")}
          </h3>
          <div className="space-y-2">
            {style.tutorials.map((tut, i) => (
              <a
                key={i}
                href={tut.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-primary/10 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {lang === "zh" ? tut.title : tut.titleEn}
                  </p>
                  <p className="text-xs text-muted-foreground">{tut.platform}</p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            onClick={() => navigate("/")}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("上传照片，体验这个风格的点评", "Upload a photo, get critiqued in this style")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StyleDetail;
