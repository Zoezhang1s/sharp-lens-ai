import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, ImagePlus, Loader2, ArrowLeft, ZoomIn, X, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamChat, type Msg } from "@/lib/streamChat";
import { toast } from "sonner";
import { STYLE_DATA, STYLE_NAME_MAP } from "@/data/styleData";
import { useHistory, extractScoreFromText, generateTitle } from "@/hooks/useHistory";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        content: t("请点评这张照片", "Please critique this photo"),
        imageData: img,
      };
      setMessages([userMsg]);
      triggerCritique([userMsg], true);
    } else {
      navigate("/");
    }
  }, []);

  // Save to history whenever messages change (after initial load)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (messages.length === 0 || !imageData) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const assistantMsgs = messages.filter(m => m.role === "assistant" && !m.generatedImage);
      const lastAssistant = assistantMsgs[0]?.content || "";
      const score = extractScoreFromText(assistantMsgs.map(m => m.content).join("\n"));
      const title = generateTitle(lastAssistant, lang);
      const summary = lastAssistant.replace(/[#*>\n]/g, " ").trim().slice(0, 100);

      if (historyId) {
        updateRecord(historyId, { messages, score, title, summary });
      } else if (assistantMsgs.length > 0) {
        const id = addRecord({ imageData, summary, title, score, messages });
        setHistoryId(id);
      }
    }, 1000);
  }, [messages]);

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

  const generateOptimizedImage = async (critiqueText: string) => {
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
          imageData: imageData,
          language: lang === "zh" ? "zh" : "en",
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Unknown error" }));
        console.error("Image gen error:", data.error);
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
            generateOptimizedImage(assistantSoFar);
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
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      triggerCritique(newMessages, true);
    };
    reader.readAsDataURL(file);
  };

  const renderMarkdownLine = (line: string, j: number) => {
    if (line.startsWith("## ")) return <h2 key={j} className="text-base font-bold mt-4 mb-2 text-primary">{line.replace("## ", "")}</h2>;
    if (line.startsWith("### ")) return <h3 key={j} className="text-sm font-semibold mt-3 mb-1">{line.replace("### ", "")}</h3>;
    if (line.startsWith("---")) return <hr key={j} className="my-3 border-border/30" />;
    if (line.startsWith("> ")) return <blockquote key={j} className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">{line.replace("> ", "")}</blockquote>;
    if (line.trim() === "") return <br key={j} />;

    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={j} className="text-sm my-0.5">
        {parts.map((part, k) =>
          k % 2 === 1 ? (
            <strong key={k} className="text-primary font-semibold">{part}</strong>
          ) : (
            <span key={k}>{part}</span>
          )
        )}
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
            <img src={msg.generatedImage} alt="AI Generated" className="rounded-lg max-h-80 object-cover w-full border border-primary/30" />
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

      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
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
