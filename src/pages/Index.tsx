import { useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Upload, Aperture, Sparkles, ArrowRight } from "lucide-react";
import logoImg from "@/assets/logo.png";

const Index = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imageData = reader.result as string;
        sessionStorage.setItem("critique-image", imageData);
        navigate("/critique");
      };
      reader.readAsDataURL(file);
    },
    [navigate]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-16 pb-8 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[100px]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-lg w-full animate-fade-up">
        {/* Logo area */}
        <div className="flex flex-col items-center gap-3">
          <img src={logoImg} alt="Logo" className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_0_20px_hsl(38_92%_50%/0.3)]" width={512} height={512} />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gradient-gold">
            {t("你拍的啥", "WhatDidYouShoot")}
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg tracking-widest uppercase font-light">
            {t("烂片一张", "Another Bad Shot")}
          </p>
        </div>

        {/* Subtitle */}
        <p className="text-center text-muted-foreground text-sm max-w-sm leading-relaxed">
          {t(
            "上传你的人像照片，接受全网最毒舌、最专业的AI摄影锐评。准备好被骂了吗？",
            "Upload your portrait photo for the most brutally honest AI photography critique. Ready to get roasted?"
          )}
        </p>

        {/* Upload area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full aspect-[3/2] sm:aspect-[4/3] max-w-md rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 sm:gap-4 group ${
            isDragging
              ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
              : "border-border/50 hover:border-primary/40 hover:bg-card/30"
          }`}
        >
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
            isDragging ? "bg-primary/20" : "bg-secondary group-hover:bg-primary/10"
          }`}>
            <Upload className={`w-6 h-6 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
          </div>
          <div className="text-center">
            <p className={`font-medium transition-colors ${isDragging ? "text-primary" : "text-foreground"}`}>
              {t("拖放烂片到这里", "Drop your bad shot here")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("或点击选择文件 · JPG / PNG", "or click to browse · JPG / PNG")}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-md">
          {[
            { icon: Aperture, label: t("专业点评", "Pro Critique"), desc: t("8大维度分析", "8 Dimensions") },
            { icon: Sparkles, label: t("AI优化图", "AI Enhanced"), desc: t("生成参考图", "Reference Photo") },
            { icon: ArrowRight, label: t("风格建议", "Style Guide"), desc: t("20+风格", "20+ Styles") },
          ].map((item, i) => (
            <div key={i} className="glass-card p-3 text-center">
              <item.icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
              <p className="text-xs font-medium text-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
