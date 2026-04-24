import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, ImagePlus, Loader2, ArrowLeft, ZoomIn, X, Sparkles, BookOpen, Share2, Download, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [fromHistory, setFromHistory] = useState(false);
  const critiqueStartedRef = useRef(false);
  const [personas] = useState<Persona[]>([
    {
      name: "陈漫",
      avatar: "",
      style: "时尚摄影师",
      critique: "从摄影角度看，这张的构图和用光还有提升空间。好的时尚摄影要让人一眼记住，你这张太平淡了。试着找一个有趣的角度，让光线为你的主体服务，而不是简单地照亮。"
    },
    {
      name: "韩寒",
      avatar: "",
      style: "作家/导演",
      critique: "拍照这事儿，个性比技术重要。你这张感觉太安全了，没有自己的态度。下次拍摄前先问问自己：我想表达什么？想要什么情绪？带着问题按快门，而不是机械地记录。"
    },
    {
      name: "刘雯",
      avatar: "",
      style: "国际超模",
      critique: "作为模特，我太懂一个好的拍摄状态有多重要了。你这张表情有点僵，肩膀也太紧。放松下来，找到自己最自信的角度。好的照片是摄影师和模特一起完成的，互相信任才能出好片。"
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
        if (record.score > 0) {
          setShowSimplified(true);
        }

        // If critique is still in progress (no assistant response yet), resume it
        const hasAssistantResponse = record.messages.some((m: any) => m.role === "assistant");
        if (!hasAssistantResponse && record.score === 0) {
          // Show loading state with retry message
          setIsLoading(true);
          // Resume the critique with auto-retry
          triggerCritiqueWithRetry(record.messages as Message[], true);
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

  // Download critique as image - complete long page
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

      // Create a complete long page container
      const captureDiv = document.createElement("div");
      captureDiv.style.cssText = `
        width: 800px;
        padding: 40px;
        background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%);
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-height: 100vh;
      `;

      // Header with logo text
      const headerEl = document.createElement("div");
      headerEl.style.cssText = "text-align: center; margin-bottom: 30px;";
      headerEl.innerHTML = `
        <div style="font-size: 14px; color: #f59e0b; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 5px;">你拍的啥</div>
        <div style="font-size: 28px; font-weight: bold; color: white;">照片锐评报告</div>
      `;
      captureDiv.appendChild(headerEl);

      // Original Photo
      const photoSection = document.createElement("div");
      photoSection.style.cssText = "margin-bottom: 30px;";
      photoSection.innerHTML = `
        <div style="font-size: 12px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px;">原图</div>
        <img src="${imageData}" style="width: 100%; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);" />
      `;
      captureDiv.appendChild(photoSection);

      // Score Card
      if (score !== null) {
        const scoreSection = document.createElement("div");
        scoreSection.style.cssText = "background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05)); border: 1px solid rgba(245,158,11,0.3); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;";
        scoreSection.innerHTML = `
          <div style="font-size: 48px; font-weight: bold; color: #f59e0b; margin-bottom: 5px;">${score}/100</div>
          <div style="font-size: 14px; color: #888;">综合评分</div>
        `;
        captureDiv.appendChild(scoreSection);
      }

      // One-liner Critique
      if (oneLiner) {
        const oneLinerSection = document.createElement("div");
        oneLinerSection.style.cssText = "background: rgba(255,255,255,0.05); border-radius: 16px; padding: 24px; margin-bottom: 30px;";
        oneLinerSection.innerHTML = `
          <div style="font-size: 12px; color: #f59e0b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px;">💥 一句话暴击</div>
          <div style="font-size: 16px; line-height: 1.8; color: white;">${oneLiner}</div>
        `;
        captureDiv.appendChild(oneLinerSection);
      }

      // Persona Critiques (Group Chat)
      const groupSection = document.createElement("div");
      groupSection.style.cssText = "margin-bottom: 30px;";
      groupSection.innerHTML = `<div style="font-size: 12px; color: #888; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">群友锐评</div>`;

      personas.forEach(persona => {
        const personaCard = document.createElement("div");
        personaCard.style.cssText = "background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; gap: 12px; align-items: flex-start;";
        personaCard.innerHTML = `
          <img src="${persona.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-weight: 600; font-size: 14px; color: white;">${persona.name}</span>
              <span style="font-size: 11px; color: #888; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px;">${persona.style}</span>
            </div>
            <div style="font-size: 14px; line-height: 1.6; color: #ccc;">${persona.critique}</div>
          </div>
        `;
        groupSection.appendChild(personaCard);
      });
      captureDiv.appendChild(groupSection);

      // AI Reference Image (if exists) - shown side by side with original
      const generatedImageMsg = messages.find(m => m.generatedImage);
      if (generatedImageMsg?.generatedImage) {
        const aiSection = document.createElement("div");
        aiSection.style.cssText = "margin-bottom: 30px;";
        aiSection.innerHTML = `
          <div style="font-size: 12px; color: #888; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">AI优化参考图</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 8px; text-align: center;">原图</div>
              <img src="${imageData}" style="width: 100%; border-radius: 12px;" />
            </div>
            <div>
              <div style="font-size: 11px; color: #666; margin-bottom: 8px; text-align: center;">AI优化</div>
              <img src="${generatedImageMsg.generatedImage}" style="width: 100%; border-radius: 12px;" />
            </div>
          </div>
        `;
        captureDiv.appendChild(aiSection);
      }

      // Detailed Critique Sections
      if (assistantMsg) {
        const sections = parseCritiqueSections(assistantMsg.content);
        if (sections.length > 0) {
          const detailedSection = document.createElement("div");
          detailedSection.innerHTML = `<div style="font-size: 12px; color: #888; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">详细点评</div>`;

          sections.forEach(section => {
            const sectionCard = document.createElement("div");
            sectionCard.style.cssText = "background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;";
            sectionCard.innerHTML = `
              <div style="font-size: 14px; font-weight: 600; color: #f59e0b; margin-bottom: 12px;">${section.title}</div>
              <div style="font-size: 14px; line-height: 1.8; color: #ccc;">${section.content.trim().replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/\n/g, '<br/>')}</div>
            `;
            detailedSection.appendChild(sectionCard);
          });
          captureDiv.appendChild(detailedSection);
        }
      }

      // Footer
      const footerEl = document.createElement("div");
      footerEl.style.cssText = "text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);";
      footerEl.innerHTML = `
        <div style="font-size: 12px; color: #555;">由 AI 提供 · 你拍的啥</div>
      `;
      captureDiv.appendChild(footerEl);

      document.body.appendChild(captureDiv);

      const canvas = await html2canvas(captureDiv, {
        backgroundColor: null,
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

      {/* Simplified View - shown when critique is complete (from history or after upload) */}
      {(showSimplified || score !== null) && score !== null && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto space-y-5">

            {/* Back to Full Button */}
            <Button variant="ghost" onClick={() => setShowSimplified(false)} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("返回完整点评", "Back to Full Critique")}
            </Button>

            {/* Image Comparison: Original vs AI Reference - at top */}
            {messages.some(m => m.generatedImage) && (
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
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score - smaller, compact */}
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-bold text-gradient-gold">{score}</span>
              <span className="text-muted-foreground text-sm">/ 100</span>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                {t("综合评分", "Overall Score")}
              </span>
            </div>

            {/* One-liner Critique */}
            <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-foreground leading-relaxed">{getOneLinerCritique()}</p>
              </CardContent>
            </Card>

            {/* Persona Critiques - sincere, objective */}
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
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* View Detailed Button */}
            {historyId && (
              <Button
                onClick={() => navigate(`/critique/${historyId}`)}
                className="w-full"
                variant="default"
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
