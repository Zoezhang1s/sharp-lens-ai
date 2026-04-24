import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, ImagePlus, Loader2, ArrowLeft, ZoomIn, X, Sparkles, BookOpen, Share2, Download, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { streamChat, type Msg } from "@/lib/streamChat";
import { toast } from "sonner";
import { STYLE_DATA, STYLE_NAME_MAP } from "@/data/styleData";
import { useHistory, extractScoreFromText, generateTitle } from "@/hooks/useHistory";

interface Persona {
  name: string;
  avatar: string;
  style: string;
  critique: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  generatedImage?: string;
  detectedStyleId?: string;
}

const GENERATE_IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;

const detectStyleFromText = (text: string): string | undefined => {
  for (const style of STYLE_DATA) {
    if (text.includes(style.nameZh) || text.toLowerCase().includes(style.nameEn.toLowerCase())) {
      return style.id;
    }
  }
  for (const [name, id] of Object.entries(STYLE_NAME_MAP)) {
    if (text.includes(name)) return id;
  }
  return undefined;
};

const Critique = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [showSimplified, setShowSimplified] = useState(false);
  const [personas] = useState<Persona[]>([
    {
      name: "Annie Leibovitz",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      style: "传奇人像摄影师",
      critique: "这张照片的构图有问题，人物应该放在画面的三分线位置，而不是正中间。"
    },
    {
      name: "Trump",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop",
      style: "前美国总统",
      critique: "HUGE mistake! The lighting is terrible, very sad! Should have used natural light from the window."
    },
    {
      name: "Joe McNally",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      style: "国家地理摄影师",
      critique: "The color grading feels off. Try warming up the skin tones a bit, and watch the background clutter."
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const critiqueContentRef = useRef<HTMLDivElement>(null);
  const { addRecord, updateRecord, getRecord } = useHistory();

  useEffect(() => {
    // Check if restoring from history
    const hid = searchParams.get("history");
    if (hid) {
      const record = getRecord(hid);
      if (record) {
        setHistoryId(hid);
        setImageData(record.imageData);
        setMessages(record.messages as Message[]);
        return;
      }
    }

    const img = sessionStorage.getItem("critique-image");
    if (img) {
      setImageData(img);
      sessionStorage.removeItem("critique-image");
      const userMsg: Message = {
        role: "user",
        content: t("请锐评这张照片", "Please critique this photo"),
        imageData: img,
      };
      setMessages([userMsg]);

      // Create history record immediately when photo is uploaded
      const title = t("照片点评中...", "Critique in progress...");
      addRecord({ imageData: img, summary: t("正在等待AI点评...", "Waiting for AI critique..."), title, score: 0, messages: [userMsg] }).then((id) => {
        setHistoryId(id);
      });

      triggerCritique([userMsg], true);
    } else {
      navigate("/");
    }
  }, []);

  // Save to history whenever messages change (after initial load)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (messages.length === 0 || !imageData || !historyId) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const assistantMsgs = messages.filter(m => m.role === "assistant" && !m.generatedImage);
      const lastAssistant = assistantMsgs[assistantMsgs.length - 1]?.content || "";
      const score = extractScoreFromText(assistantMsgs.map(m => m.content).join("\n"));
      const title = generateTitle(lastAssistant, lang);
      const summary = lastAssistant.replace(/[#*>\n]/g, " ").trim().slice(0, 100);

      // Always update the existing record
      updateRecord(historyId, { messages, score, title, summary });
    }, 1000);
  }, [messages, historyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildApiMessages = (msgs: Message[]): Msg[] => {
    return msgs.map((m) => {
      if (m.imageData) {
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: m.imageData } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
  };

  const generateOptimizedImage = async (critiqueText: string, sourceMessages?: Message[]) => {
    const baseMessages = sourceMessages ?? messages;
    // Prefer the current flow's source image to avoid stale React state during first-run generation.
    const refImage =
      [...baseMessages].reverse().find((m) => m.role === "user" && m.imageData)?.imageData ||
      imageData ||
      null;

    if (!refImage) {
      toast.error(
        t("缺少原图，无法生成参考图，请重新上传照片", "Missing original photo. Please upload a new photo to generate a reference.")
      );
      return;
    }

    setIsGeneratingImage(true);
    try {
      const resp = await fetch(GENERATE_IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt: critiqueText,
          imageData: refImage,
          language: lang === "zh" ? "zh" : "en",
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Unknown error" }));
        console.error("Image gen error:", data.error);
        toast.error(
          t("参考图生成失败，请重试", "Failed to generate the reference image. Please try again.")
        );
        return;
      }

      const data = await resp.json();
      if (data.imageUrl) {
        const imgMsg: Message = {
          role: "assistant",
          content: t(
            "## 🎨 AI优化参考图\n\n根据以上点评生成的优化参考，展示理想拍摄效果：\n\n> 💡 *AI参考图，实际拍摄请灵活调整*",
            "## 🎨 AI Optimized Reference\n\nOptimized reference based on the critique above:\n\n> 💡 *AI reference — adjust based on actual conditions*"
          ),
          generatedImage: data.imageUrl,
        };
        setMessages((prev) => [...prev, imgMsg]);
      }
    } catch (e) {
      console.error("Image gen error:", e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const triggerCritique = async (currentMessages: Message[], shouldGenerateImage: boolean) => {
    setIsLoading(true);
    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      const detectedStyleId = detectStyleFromText(assistantSoFar);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.generatedImage) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar, detectedStyleId } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar, detectedStyleId }];
      });
    };

    try {
      await streamChat({
        messages: buildApiMessages(currentMessages),
        language: lang === "zh" ? "zh" : "en",
        onDelta: upsertAssistant,
        onDone: () => {
          setIsLoading(false);
          if (shouldGenerateImage && assistantSoFar) {
            generateOptimizedImage(assistantSoFar, currentMessages);
          }
        },
        onError: (err) => {
          toast.error(err);
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error(t("AI服务出错，请稍后重试", "AI service error, please try again later"));
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.generatedImage) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: buildApiMessages(newMessages),
        language: lang === "zh" ? "zh" : "en",
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (err) => {
          toast.error(err);
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error(t("AI服务出错，请稍后重试", "AI service error, please try again later"));
      setIsLoading(false);
    }
  };

  const handleNewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { fileToDataUrl, downscaleImage } = await import("@/lib/imageUtils");
      const raw = await fileToDataUrl(file);
      const img = await downscaleImage(raw, 1600, 0.85);
      setImageData(img);
      const userMsg: Message = {
        role: "user",
        content: t("请锐评这张新照片", "Please critique this new photo"),
        imageData: img,
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      triggerCritique(newMessages, true);
    } catch (err) {
      console.error(err);
      toast.error(t("图片处理失败", "Image processing failed"));
    }
  };

  const renderMarkdownLine = (line: string, j: number) => {
    if (line.startsWith("## ")) return <h2 key={j} className="text-base font-bold mt-3 mb-1 text-primary">{line.replace("## ", "")}</h2>;
    if (line.startsWith("### ")) return <h3 key={j} className="text-sm font-semibold mt-2 mb-0.5">{line.replace("### ", "")}</h3>;
    if (line.startsWith("---")) return <hr key={j} className="my-2 border-border/30" />;
    if (line.startsWith("> ")) return <blockquote key={j} className="border-l-2 border-primary/40 pl-3 my-1.5 text-muted-foreground italic">{line.replace("> ", "")}</blockquote>;
    if (line.trim() === "") return null;

    // Table row
    if (line.trim().startsWith("|")) {
      const cells = line.split("|").filter(c => c.trim() !== "");
      // Skip separator row
      if (cells.every(c => /^[\s:-]+$/.test(c))) return null;
      const colCount = cells.length;
      const isHeaderRow = cells[0]?.includes("维度") || cells[0]?.includes("Dimension");
      return (
        <div key={j} className={`grid gap-1 text-xs py-1.5 px-2 ${isHeaderRow ? "font-semibold text-muted-foreground border-b border-border/30 mb-1" : "rounded-lg hover:bg-secondary/30"}`}
          style={{ gridTemplateColumns: colCount >= 4 ? "auto 80px 1fr 1fr" : "auto 80px 1fr" }}
        >
          {cells.map((cell, k) => {
            const trimmed = cell.trim();
            const parts = trimmed.split(/\*\*(.*?)\*\*/g);
            return (
              <span key={k} className={`${k <= 1 ? "text-center" : "text-left"} ${k === 1 && trimmed.includes("⭐") ? "text-amber-400" : ""}`}>
                {parts.map((part, pi) =>
                  pi % 2 === 1 ? <strong key={pi} className="text-primary font-semibold">{part}</strong> : <span key={pi}>{part}</span>
                )}
              </span>
            );
          })}
        </div>
      );
    }

    // Render inline content with bold and links
    const decodeHtmlEntities = (text: string): string => {
      return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'");
    };

    const getAppLink = (url: string): { href: string; target: string } => {
      // WeChat links
      if (url.includes("weixin") || url.includes("wechat")) {
        return { href: url, target: "_blank" };
      }
      // Xiaohongshu - try to open in app first, fallback to web
      if (url.includes("xiaohongshu") || url.includes("xhslink")) {
        // Try to use xhslink:// or open in browser with priority to web
        return { href: url, target: "_blank" };
      }
      // Douyin - try to open in app
      if (url.includes("douyin") || url.includes("aweme")) {
        return { href: url, target: "_blank" };
      }
      // Bilibili
      if (url.includes("bilibili")) {
        return { href: url, target: "_blank" };
      }
      return { href: url, target: "_blank" };
    };

    const renderInline = (text: string) => {
      // Decode HTML entities first
      const decoded = decodeHtmlEntities(text);
      // First split by markdown links [text](url)
      const linkParts = decoded.split(/(\[.*?\]\(.*?\))/g);
      return linkParts.map((seg, si) => {
        const linkMatch = seg.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          const appLink = getAppLink(linkMatch[2]);
          return (
            <a key={si} href={appLink.href} target={appLink.target} rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              {linkMatch[1]}
            </a>
          );
        }
        // Then handle bold
        const boldParts = seg.split(/\*\*(.*?)\*\*/g);
        return boldParts.map((part, pi) =>
          pi % 2 === 1 ? <strong key={`${si}-${pi}`} className="text-primary font-semibold">{part}</strong> : <span key={`${si}-${pi}`}>{part}</span>
        );
      });
    };

    return (
      <p key={j} className="text-sm my-0.5">
        {renderInline(line)}
      </p>
    );
  };

  const renderMessageContent = (msg: Message) => (
    <>
      {msg.imageData && (
        <div className="relative mb-3 group cursor-pointer" onClick={() => setZoomedImage(msg.imageData!)}>
          <img src={msg.imageData} alt="Uploaded" className="rounded-lg max-h-60 object-cover w-full" />
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-foreground" />
          </div>
        </div>
      )}
      {msg.generatedImage && (
        <div className="relative mb-3 group cursor-pointer" onClick={() => setZoomedImage(msg.generatedImage!)}>
          <div className="relative">
            <img src={msg.generatedImage} alt="AI Generated" className="rounded-lg w-full h-auto border border-primary/30 object-contain" />
            <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI
            </div>
          </div>
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-foreground" />
          </div>
        </div>
      )}
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {msg.content.split("\n").map((line, j) => renderMarkdownLine(line, j))}
      </div>
      {msg.detectedStyleId && (
        <Link
          to={`/styles/${msg.detectedStyleId}`}
          state={{ fromCritique: true, historyId }}
          className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors group"
        >
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">
            {t("查看该风格的拍摄攻略 →", "View shooting guide for this style →")}
          </span>
        </Link>
      )}
    </>
  );

  // Extract one-liner critique
  const getOneLinerCritique = () => {
    const assistantMsg = messages.find(m => m.role === "assistant" && !m.generatedImage);
    if (!assistantMsg) return "";
    const lines = assistantMsg.content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("---"));
    return lines[0] || "这张照片有点意思...";
  };

  // Share to WeChat/Web
  const handleShare = async () => {
    if (!navigator.share) {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t("链接已复制到剪贴板", "Link copied to clipboard"));
      } catch {
        toast.error(t("分享失败", "Share failed"));
      }
      return;
    }
    try {
      await navigator.share({
        title: t("照片锐评", "Photo Critique"),
        text: getOneLinerCritique(),
        url: window.location.href,
      });
    } catch {
      // User cancelled or error
    }
  };

  // Download critique as image
  const handleDownload = async () => {
    const contentEl = critiqueContentRef.current;
    if (!contentEl) {
      toast.error(t("无法生成图片", "Cannot generate image"));
      return;
    }

    try {
      // Dynamic import html2canvas
      const html2canvas = (await import("html2canvas")).default;

      // Create a container for the capture
      const captureDiv = document.createElement("div");
      captureDiv.style.cssText = `
        width: 600px;
        padding: 40px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
      `;

      // Add title
      const titleEl = document.createElement("div");
      titleEl.style.cssText = "font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center;";
      titleEl.textContent = t("你拍的啥 - 照片锐评", "WhatDidYouShoot - Photo Critique");
      captureDiv.appendChild(titleEl);

      // Add image
      if (imageData) {
        const imgEl = document.createElement("img");
        imgEl.src = imageData;
        imgEl.style.cssText = "width: 100%; border-radius: 12px; margin-bottom: 20px;";
        captureDiv.appendChild(imgEl);
      }

      // Add critique text
      const critiqueText = getOneLinerCritique();
      const critiqueEl = document.createElement("div");
      critiqueEl.style.cssText = "font-size: 16px; line-height: 1.6; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px;";
      critiqueEl.textContent = critiqueText;
      captureDiv.appendChild(critiqueEl);

      // Add score
      const scoreMatch = messages.find(m => m.role === "assistant")?.content.match(/(\d{1,3})\s*\/\s*100/);
      if (scoreMatch) {
        const scoreEl = document.createElement("div");
        scoreEl.style.cssText = "font-size: 36px; font-weight: bold; text-align: center; margin-top: 20px; color: #f59e0b;";
        scoreEl.textContent = `${scoreMatch[1]}/100`;
        captureDiv.appendChild(scoreEl);
      }

      document.body.appendChild(captureDiv);

      const canvas = await html2canvas(captureDiv, {
        backgroundColor: null,
        scale: 2,
      });

      document.body.removeChild(captureDiv);

      const link = document.createElement("a");
      link.download = `critique-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success(t("图片已下载", "Image downloaded"));
    } catch (e) {
      console.error(e);
      toast.error(t("下载失败", "Download failed"));
    }
  };

  // Toggle simplified view
  const toggleSimplified = () => {
    setShowSimplified(!showSimplified);
  };

  // Get current score
  const getScore = () => {
    const assistantMsgs = messages.filter(m => m.role === "assistant" && !m.generatedImage);
    if (assistantMsgs.length === 0) return null;
    const text = assistantMsgs.map(m => m.content).join("\n");
    const match = text.match(/(\d{1,3})\s*\/\s*100/);
    return match ? parseInt(match[1]) : null;
  };

  const score = getScore();

  return (
    <div className="min-h-screen pt-14 flex flex-col">
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" onClick={() => setZoomedImage(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Header with actions */}
      <div className="px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-xl flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          {score !== null && (
            <Button variant="outline" size="sm" onClick={toggleSimplified}>
              <MessageCircle className="w-4 h-4 mr-1" />
              {showSimplified ? t("完整点评", "Full Critique") : t("精简点评", "Simplified")}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Simplified View */}
      {showSimplified && score !== null && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Score Card */}
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
              <CardContent className="pt-6 text-center">
                <div className="text-6xl font-bold text-gradient-gold mb-2">{score}/100</div>
                <p className="text-muted-foreground text-sm">{t("综合评分", "Overall Score")}</p>
              </CardContent>
            </Card>

            {/* One-liner Critique */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold text-primary mb-3">💥 {t("一句话暴击", "One-liner Roast")}</h3>
                <p className="text-foreground leading-relaxed">{getOneLinerCritique()}</p>
              </CardContent>
            </Card>

            {/* Persona Critiques */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("群友锐评", "Group Critique")}
              </h3>
              {personas.map((persona, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={persona.avatar} alt={persona.name} />
                        <AvatarFallback>{persona.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{persona.name}</span>
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {persona.style}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{persona.critique}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* View Detailed Button */}
            {historyId && (
              <Button
                onClick={() => navigate(`/critique/${historyId}`)}
                className="w-full"
                variant="outline"
              >
                {t("查看详细锐评", "View Detailed Critique")}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Full Critique View */}
      {!showSimplified && (
        <div ref={critiqueContentRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`animate-fade-up flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-5 py-4 ${
                  msg.role === "user"
                    ? "bg-primary/10 border border-primary/20 text-foreground"
                    : "glass-card text-foreground"
                }`}
              >
                {renderMessageContent(msg)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-fade-up">
              <div className="glass-card px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {messages.filter(m => m.role === "assistant").length === 0
                    ? t("正在审判中...", "Judging your photo...")
                    : t("正在思考中...", "Thinking...")}
                </span>
              </div>
            </div>
          )}
          {isGeneratingImage && (
            <div className="flex justify-start animate-fade-up">
              <div className="glass-card px-4 py-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">
                  {t("正在生成优化参考图...", "Generating optimized reference...")}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary" onClick={() => navigate("/")}>
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
