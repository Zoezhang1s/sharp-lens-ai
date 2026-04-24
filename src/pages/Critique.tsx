import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, ImagePlus, Loader2, ArrowLeft, ZoomIn, X, Sparkles, BookOpen, Share2, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { streamChat, type Msg } from "@/lib/streamChat";
import { toast } from "sonner";
import { STYLE_DATA, STYLE_NAME_MAP } from "@/data/styleData";
import { useHistory, extractScoreFromText, generateTitle } from "@/hooks/useHistory";

interface Persona {
  name: string;
  avatar: string;
  style: string;
  critique: string;
  translation?: string; // Chinese translation for foreign personas
  lang?: string; // Original language code
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
  const [showDetailed, setShowDetailed] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [, setFromHistory] = useState(false);
  const critiqueStartedRef = useRef(false);
  const [personas] = useState<Persona[]>([
    {
      name: "陈漫",
      avatar: "",
      style: "时尚摄影师",
      critique: "从时尚摄影角度，这张的构图和用光都有提升空间。建议找到主体最自信的角度，让光线为肤色服务，而不是简单照亮。"
    },
    {
      name: "张艺谋",
      avatar: "",
      style: "电影导演",
      critique: "摄影是光影的艺术，你这张平了。好的照片要有视觉重心，光线要有主次关系。建议研究一下戏剧性用光，让照片有故事感。"
    },
    {
      name: "森山大道",
      avatar: "",
      style: "街头摄影师",
      critique: "ストリート写真は空気感だ。この作品はもう少し生命力があればなお良くなる。",
      translation: "街头摄影讲究氛围感，你这幅作品如果能再多一点生命力会更棒。",
      lang: "ja"
    },
    {
      name: "Annie Leibovitz",
      avatar: "",
      style: "人像摄影大师",
      critique: "The key to portrait photography is capturing the subject's essence. Your subject seems a bit stiff. Try to create a relaxed atmosphere and capture genuine expressions.",
      translation: "人像摄影的关键是捕捉拍摄对象的本质。你的拍摄对象看起来有点僵硬。试着营造轻松的氛围，捕捉自然的表情。",
      lang: "en"
    },
    {
      name: "何炅",
      avatar: "",
      style: "主持人",
      critique: "拍照和主持一样，要有'眼'。你这张照片的问题在于观众（镜头）不知道该看哪里。建议明确视觉焦点，让主体更突出。"
    },
    {
      name: "蔡康永",
      avatar: "",
      style: "主持人/作家",
      critique: "我说一个暴击啊——你这张照片没有记忆点。好的照片看一眼就能记住，这张看三眼都记不住。问题出在：构图太满，没有呼吸感。"
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
        // Get original image from messages first, fallback to compressed thumbnail
        const userMsgWithImage = (record.messages as Message[]).find((m: any) => m.role === "user" && m.imageData);
        setImageData(userMsgWithImage?.imageData || record.imageData);
        setMessages(record.messages as Message[]);
        // Show simplified view when entering from history
        setFromHistory(true);

        // If critique is still in progress (no assistant response yet), resume it
        const hasAssistantResponse = record.messages.some((m: any) => m.role === "assistant");
        if (!hasAssistantResponse && record.score === 0) {
          // Show loading state with retry message
          setIsLoading(true);
          // Resume the critique with auto-retry
          triggerCritiqueWithRetry(record.messages as Message[], true);
        }

        // Auto-expand detailed view if expanded=true in URL
        if (searchParams.get("expanded") === "true") {
          setShowDetailed(true);
        }
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
      addRecord({ imageData: img, summary: t("正在等待AI点评...", "Waiting for AI critique..."), title: t("照片点评中...", "Critique in progress..."), score: 0, messages: [userMsg] }).then((id) => {
        setHistoryId(id);
      });

      triggerCritique([userMsg], true);
    } else {
      navigate("/");
    }
  }, []);

  // Auto-retry critique with exponential backoff
  const triggerCritiqueWithRetry = async (currentMessages: Message[], shouldGenerateImage: boolean, retryCount = 0) => {
    // Guard: don't start if already loaded or no messages
    if (!currentMessages || currentMessages.length === 0) {
      console.error("[Critique] No messages to send");
      return;
    }
    if (messages.some(m => m.role === "assistant" && !m.generatedImage)) {
      console.log("[Critique] Already has assistant response, skipping");
      return;
    }
    if (critiqueStartedRef.current) {
      console.log("[Critique] Critique already started, skipping");
      return;
    }
    critiqueStartedRef.current = true;
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
      const apiMsgs = buildApiMessages(currentMessages);
      console.log("[Critique] Calling API with", apiMsgs.length, "messages, retry:", retryCount);

      await streamChat({
        messages: apiMsgs,
        language: lang === "zh" ? "zh" : "en",
        onDelta: upsertAssistant,
        onDone: () => {
          console.log("[Critique] streamChat done, generating image:", shouldGenerateImage);
          setIsLoading(false);
          if (shouldGenerateImage && assistantSoFar) {
            generateOptimizedImage(assistantSoFar, currentMessages);
          }
        },
        onError: (err) => {
          console.error("[Critique] API error:", err, "retryCount:", retryCount);
          // Auto-retry on failure with delay
          if (retryCount < 3) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log("[Critique] Scheduling retry in", delay, "ms");
            setTimeout(() => {
              triggerCritiqueWithRetry(currentMessages, shouldGenerateImage, retryCount + 1);
            }, delay);
          } else {
            toast.error(t("AI服务出错，请稍后重试", "AI service error, please try again"));
            setIsLoading(false);
          }
        },
      });
    } catch (e) {
      console.error("[Critique] Exception:", e, "retryCount:", retryCount);
      // Auto-retry on exception
      if (retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => {
          triggerCritiqueWithRetry(currentMessages, shouldGenerateImage, retryCount + 1);
        }, delay);
      } else {
        toast.error(t("AI服务出错，请稍后重试", "AI service error, please try again"));
        setIsLoading(false);
      }
    }
  };

  // Check for in-progress critique on mount
  useEffect(() => {
    const inProgress = sessionStorage.getItem("critique-in-progress");
    if (inProgress && !searchParams.get("history") && !critiqueStartedRef.current) {
      const { imageData: storedImage, messages: storedMessages, historyId: storedHid } = JSON.parse(inProgress);
      if (storedImage && storedMessages.length > 0) {
        setImageData(storedImage);
        setMessages(storedMessages);
        setHistoryId(storedHid);
        // Resume the critique if it was interrupted
        if (!storedMessages.some(m => m.role === "assistant")) {
          critiqueStartedRef.current = true;
          triggerCritique(storedMessages, true);
        }
        sessionStorage.removeItem("critique-in-progress");
      }
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

  // Persist in-progress critique to sessionStorage for recovery
  useEffect(() => {
    if (messages.length > 0 && imageData && historyId) {
      const hasAssistantResponse = messages.some(m => m.role === "assistant");
      if (!hasAssistantResponse) {
        sessionStorage.setItem("critique-in-progress", JSON.stringify({
          imageData,
          messages,
          historyId,
        }));
      } else {
        sessionStorage.removeItem("critique-in-progress");
      }
    }
  }, [messages, imageData, historyId]);

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
    if (!currentMessages || currentMessages.length === 0) return;
    if (critiqueStartedRef.current) return;
    critiqueStartedRef.current = true;
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

  // Render detailed section content with links and proper formatting
  const renderDetailedContent = (text: string) => {
    // Clean HTML entities and markdown
    const cleaned = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/\*\*(.*?)\*\*/g, "___MARK___$1___ENDMARK___")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "___LINK___$1|$2___ENDLINK___");

    // Split into lines and render each
    const lines = cleaned.split("\n").filter(l => l.trim());
    return lines.map((line, i) => {
      // Handle links
      const parts = line.split(/(___LINK___.*?___ENDLINK___)/g);
      return (
        <p key={i} className="text-sm text-foreground leading-relaxed mb-2">
          {parts.map((part, j) => {
            if (part.startsWith("___LINK___")) {
              const match = part.match(/___LINK___(.+?)\|(.+?)___ENDLINK___/);
              if (match) {
                const linkText = match[1];
                const linkUrl = match[2];
                let href = linkUrl;
                if (linkUrl.includes("xiaohongshu") || linkUrl.includes("xhslink")) href = linkUrl;
                if (linkUrl.includes("douyin")) href = linkUrl;
                return (
                  <a key={j} href={href} target="_blank" rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80">
                    {linkText}
                  </a>
                );
              }
            }
            // Handle bold markers
            const boldParts = part.split(/___MARK___(.*?)___ENDMARK___/g);
            return boldParts.map((bp, k) =>
              k % 2 === 1
                ? <strong key={`${i}-${j}-${k}`} className="text-primary font-semibold">{bp}</strong>
                : <span key={`${i}-${j}-${k}`}>{bp}</span>
            );
          })}
        </p>
      );
    });
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

  // Extract one-liner critique - brutal and direct
  const getOneLinerCritique = () => {
    const assistantMsg = messages.find(m => m.role === "assistant" && !m.generatedImage);
    if (!assistantMsg) return "";
    const content = assistantMsg.content;
    // Extract score first
    const scoreMatch = content.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

    if (score > 0) {
      if (score < 40) return "烂片一张，没救了。";
      if (score < 55) return "拍得一般，凑合看吧。";
      if (score < 70) return "有点东西，但问题不少。";
      if (score < 85) return "不错，但还能更好。";
      return "可以啊，这水平能看了！";
    }

    const lines = content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("|") && !l.startsWith("---"));
    const firstLine = lines[0] || "";
    // Make it more brutal
    if (firstLine.includes("不错") || firstLine.includes("很好")) return firstLine.slice(0, 30);
    if (firstLine.includes("一般") || firstLine.includes("普通")) return "就...一般吧，没啥亮点。";
    if (firstLine.includes("问题") || firstLine.includes("需要")) return "问题不少，得改。";
    return firstLine.slice(0, 25) || "这照片...自己看吧。";
  };

  // Parse critique into sections by ## headers
  const parseCritiqueSections = (content: string): { title: string; content: string }[] => {
    const sections: { title: string; content: string }[] = [];
    const lines = content.split("\n");
    let currentSection = { title: "", content: "" };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        if (currentSection.title) {
          sections.push(currentSection);
        }
        currentSection = { title: trimmed.replace("## ", ""), content: "" };
      } else if (trimmed.startsWith("### ")) {
        if (currentSection.title) {
          sections.push(currentSection);
        }
        currentSection = { title: trimmed.replace("### ", ""), content: "" };
      } else if (trimmed && !trimmed.startsWith("---") && !trimmed.match(/^\|.*\|$/)) {
        if (currentSection.title || currentSection.content) {
          currentSection.content += trimmed + " ";
        }
      }
    }
    if (currentSection.title) {
      sections.push(currentSection);
    }
    return sections;
  };

  // Share - opens share modal
  const handleShare = () => {
    setShowShareModal(true);
  };

  const getShareUrl = () => {
    return historyId
      ? `${window.location.origin}/critique?history=${historyId}&expanded=true`
      : `${window.location.origin}/critique?expanded=true`;
  };

  const shareToWechat = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("链接已复制，打开微信分享", "Link copied, open WeChat to share"));
    } catch {
      toast.error(t("复制失败", "Copy failed"));
    }
    setShowShareModal(false);
  };

  const shareToXiaohongshu = async () => {
    const url = getShareUrl();
    // Try to open Xiaohongshu web share
    window.open(`https://www.xiaohongshu.com/explore/share?text=${encodeURIComponent(getOneLinerCritique())}&url=${encodeURIComponent(url)}`, "_blank");
    setShowShareModal(false);
  };

  const shareToDouyin = async () => {
    const url = getShareUrl();
    // Try to open Douyin web share
    window.open(`https://www.douyin.com/share?text=${encodeURIComponent(getOneLinerCritique())}&url=${encodeURIComponent(url)}`, "_blank");
    setShowShareModal(false);
  };

  const shareCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("链接已复制", "Link copied"));
    } catch {
      toast.error(t("复制失败", "Copy failed"));
    }
    setShowShareModal(false);
  };

  // Clean text for download - remove HTML entities and markdown
  const cleanForDownload = (text: string): string => {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\|/g, " ")
      .replace(/---/g, "")
      .replace(/>/g, "")
      .trim();
  };

  // Download critique as image - complete long page with all content
  const handleDownload = async () => {
    if (!imageData) {
      toast.error(t("无法生成图片", "Cannot generate image"));
      return;
    }

    try {
      const html2canvas = (await import("html2canvas")).default;

      // Get main critique content
      const assistantMsg = messages.find(m => m.role === "assistant" && !m.generatedImage);
      const score = getScore();
      const oneLiner = getOneLinerCritique();
      const generatedImageMsg = messages.find(m => m.generatedImage);

      // Create a complete long page container with dark background
      const captureDiv = document.createElement("div");
      captureDiv.style.cssText = `
        position: relative;
        width: 800px;
        padding: 40px;
        background: #0a0a0f;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-height: 100vh;
        box-sizing: border-box;
      `;

      // Logo with speech bubble in bottom right
      const logoBubble = document.createElement("div");
      logoBubble.style.cssText = "position: absolute; bottom: 20px; right: 20px; z-index: 10;";
      logoBubble.innerHTML = `
        <div style="background: #f59e0b; color: #000; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 8px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          烂片一张~
        </div>
        <img src="https://raw.githubusercontent.com/Zoezhang1s/sharp-lens-ai/main/src/assets/logo.png" style="width: 60px; height: 60px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" />
      `;
      captureDiv.appendChild(logoBubble);

      // Header with logo text
      const headerEl = document.createElement("div");
      headerEl.style.cssText = "text-align: center; margin-bottom: 30px;";
      headerEl.innerHTML = `
        <div style="font-size: 14px; color: #f59e0b; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 5px;">你拍的啥</div>
        <div style="font-size: 28px; font-weight: bold; color: white;">照片锐评报告</div>
      `;
      captureDiv.appendChild(headerEl);

      // Image Comparison: Original vs AI Reference
      const imageSection = document.createElement("div");
      imageSection.style.cssText = "margin-bottom: 30px;";
      if (generatedImageMsg?.generatedImage) {
        imageSection.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="font-size: 11px; color: #888; margin-bottom: 8px; text-align: center;">原图</div>
              <img src="${imageData}" style="width: 100%; border-radius: 12px;" />
            </div>
            <div>
              <div style="font-size: 11px; color: #888; margin-bottom: 8px; text-align: center;">✨ AI优化参考</div>
              <img src="${generatedImageMsg.generatedImage}" style="width: 100%; border-radius: 12px;" />
            </div>
          </div>
        `;
      } else {
        imageSection.innerHTML = `
          <div style="font-size: 12px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px;">原图</div>
          <img src="${imageData}" style="width: 100%; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);" />
        `;
      }
      captureDiv.appendChild(imageSection);

      // Score Card
      if (score !== null) {
        const scoreSection = document.createElement("div");
        scoreSection.style.cssText = "text-align: center; margin-bottom: 24px;";
        scoreSection.innerHTML = `
          <span style="font-size: 48px; font-weight: bold; color: #f59e0b;">${score}</span>
          <span style="font-size: 20px; color: #888; margin-left: 8px;">/ 100</span>
        `;
        captureDiv.appendChild(scoreSection);
      }

      // One-liner Critique
      if (oneLiner) {
        const oneLinerSection = document.createElement("div");
        oneLinerSection.style.cssText = "background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 20px; margin-bottom: 30px;";
        oneLinerSection.innerHTML = `
          <div style="font-size: 12px; color: #f59e0b; margin-bottom: 8px; font-weight: 600;">💥 一句话暴击</div>
          <div style="font-size: 15px; line-height: 1.8; color: white;">${oneLiner}</div>
        `;
        captureDiv.appendChild(oneLinerSection);
      }

      // Persona Critiques (Group Chat) - no avatars
      const groupSection = document.createElement("div");
      groupSection.style.cssText = "margin-bottom: 30px;";
      groupSection.innerHTML = `<div style="font-size: 12px; color: #888; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">群友锐评</div>`;

      personas.forEach(persona => {
        const personaCard = document.createElement("div");
        personaCard.style.cssText = "background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px;";
        let critiqueHtml = `<div style="font-size: 14px; line-height: 1.6; color: #ccc;">${cleanForDownload(persona.critique)}</div>`;
        if (persona.translation) {
          critiqueHtml += `<div style="font-size: 12px; line-height: 1.6; color: #888; margin-top: 8px; font-style: italic; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">${persona.translation}</div>`;
        }
        personaCard.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 14px; color: white;">${persona.name}</span>
            <span style="font-size: 11px; color: #888; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px;">${persona.style}</span>
          </div>
          ${critiqueHtml}
        `;
        groupSection.appendChild(personaCard);
      });
      captureDiv.appendChild(groupSection);

      // Detailed Critique Sections
      if (assistantMsg) {
        const sections = parseCritiqueSections(assistantMsg.content);
        if (sections.length > 0) {
          const detailedSection = document.createElement("div");
          detailedSection.style.cssText = "margin-top: 20px;";
          detailedSection.innerHTML = `<div style="font-size: 12px; color: #888; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">详细锐评</div>`;

          sections.forEach(section => {
            const sectionCard = document.createElement("div");
            sectionCard.style.cssText = "background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;";
            sectionCard.innerHTML = `
              <div style="font-size: 14px; font-weight: 600; color: #f59e0b; margin-bottom: 12px;">${cleanForDownload(section.title)}</div>
              <div style="font-size: 14px; line-height: 1.8; color: #ccc;">${cleanForDownload(section.content).replace(/\n/g, '<br/>')}</div>
            `;
            detailedSection.appendChild(sectionCard);
          });
          captureDiv.appendChild(detailedSection);
        }
      }

      // Footer
      const footerEl = document.createElement("div");
      footerEl.style.cssText = "text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-bottom: 80px;";
      footerEl.innerHTML = `
        <div style="font-size: 12px; color: #555;">由 AI 提供 · 你拍的啥</div>
      `;
      captureDiv.appendChild(footerEl);

      document.body.appendChild(captureDiv);

      const canvas = await html2canvas(captureDiv, {
        backgroundColor: "#0a0a0f",
        scale: 2,
        useCORS: true,
        allowTaint: true,
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
        <Button variant="ghost" size="icon" onClick={() => historyId ? navigate(-1) : navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="glass-card p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-foreground">{t("分享到", "Share to")}</h3>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={shareToWechat} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white text-xl">微</div>
                <span className="text-xs text-foreground">{t("微信", "WeChat")}</span>
              </button>
              <button onClick={shareToXiaohongshu} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white text-xl">红</div>
                <span className="text-xs text-foreground">{t("小红书", "Red Book")}</span>
              </button>
              <button onClick={shareToDouyin} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white text-xl">抖</div>
                <span className="text-xs text-foreground">{t("抖音", "Douyin")}</span>
              </button>
            </div>
            <button onClick={shareCopyLink} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              {t("复制链接", "Copy Link")}
            </button>
            <Button variant="ghost" onClick={() => setShowShareModal(false)} className="w-full">
              {t("取消", "Cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content - Simplified View (always shown when critique complete) */}
      {score !== null && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto space-y-5">

            {/* 1. Image Comparison */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground text-center mb-2">{t("原图", "Original")}</p>
                    <img
                      src={imageData!}
                      alt="Original"
                      className="w-full rounded-lg object-contain"
                    />
                  </div>
                  {messages.some(m => m.generatedImage) ? (
                    <div>
                      <p className="text-xs text-muted-foreground text-center mb-2 flex items-center justify-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" />
                        {t("AI优化", "AI Optimized")}
                      </p>
                      <img
                        src={messages.find(m => m.generatedImage)?.generatedImage}
                        alt="AI Generated"
                        className="w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center bg-secondary/30 rounded-lg">
                      <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                      <p className="text-xs text-muted-foreground">{t("AI参考图生成中...", "Generating AI reference...")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Score */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-bold text-gradient-gold">{score}</span>
              <span className="text-muted-foreground text-sm">/ 100</span>
            </div>

            {/* 3. One-liner Critique */}
            <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
              <CardContent className="pt-4 pb-4">
                <h3 className="text-sm font-bold text-primary mb-2">💥 {t("一句话暴击", "One-liner Roast")}</h3>
                <p className="text-sm text-foreground leading-relaxed">{getOneLinerCritique()}</p>
              </CardContent>
            </Card>

            {/* 4. Persona Critiques */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("群友锐评", "Group Critique")}
              </h3>
              {personas.map((persona, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-sm text-foreground">{persona.name}</span>
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        {persona.style}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{persona.critique}</p>
                    {persona.translation && (
                      <p className="text-xs text-muted-foreground italic leading-relaxed mt-2 border-t border-border/30 pt-2">
                        {persona.translation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 5. Collapsible Detailed Critique */}
            <Button
              onClick={() => setShowDetailed(!showDetailed)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              variant="default"
            >
              {t("查看详细锐评", "View Detailed Critique")}
              <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${showDetailed ? "rotate-90" : ""}`} />
            </Button>

            {showDetailed && (
              <div className="space-y-4">
                {parseCritiqueSections(messages.find(m => m.role === "assistant" && !m.generatedImage)?.content || "").map((section, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <h4 className="text-sm font-semibold text-primary mb-3">{section.title}</h4>
                      <div className="space-y-1">
                        {renderDetailedContent(section.content.trim())}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading states when critique not yet complete */}
      {score === null && (
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
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary" onClick={() => historyId ? navigate(-1) : navigate("/")}>
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
