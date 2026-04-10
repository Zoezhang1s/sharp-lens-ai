import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Send, ImagePlus, Loader2, ArrowLeft, ZoomIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamChat, type Msg } from "@/lib/streamChat";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageData?: string;
}

const Critique = () => {
  const { t, lang } = useLanguage();
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
      const userMsg: Message = {
        role: "user",
        content: t("请点评这张照片", "Please critique this photo"),
        imageData: img,
      };
      setMessages([userMsg]);
      triggerCritique([userMsg], img);
    } else {
      navigate("/");
    }
  }, []);

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

  const triggerCritique = async (currentMessages: Message[], _img: string) => {
    setIsLoading(true);
    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: buildApiMessages(currentMessages),
        language: language === "zh" ? "zh" : "en",
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
        if (last?.role === "assistant") {
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
        language: language === "zh" ? "zh" : "en",
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
      triggerCritique(newMessages, img);
    };
    reader.readAsDataURL(file);
  };

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
                  if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ")) return <p key={j} className="text-sm ml-2 my-0.5">{line}</p>;
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
