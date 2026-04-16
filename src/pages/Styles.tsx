import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STYLE_DATA } from "@/data/styleData";

const Styles = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-14 px-4 pb-8">
      <div className="max-w-5xl mx-auto">
        <div className="py-8 flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={() => navigate("/")}>
            <Home className="w-4 h-4" />
          </Button>
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-gradient-gold mb-2">
              {t("风格百科", "Style Encyclopedia")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("探索人像摄影风格，点击查看拍摄攻略", "Explore portrait styles, click for shooting guides")}
            </p>
          </div>
          <div className="w-9 shrink-0" /> {/* spacer for centering */}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {STYLE_DATA.map((style, i) => (
            <button
              key={style.id}
              onClick={() => navigate(`/styles/${style.id}`)}
              className="glass-card-hover p-4 text-left group animate-fade-up"
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
