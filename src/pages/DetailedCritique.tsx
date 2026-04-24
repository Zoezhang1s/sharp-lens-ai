import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { streamChat, type Msg } from "@/lib/streamChat";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  generatedImage?: string;
}

interface CritiqueData {
  imageData: string;
  messages: Message[];
  score: number;
  summary: string;
  title: string;
}

const DetailedCritique = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [critiqueData, setCritiqueData] = useState<CritiqueData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }

    // Try to get from history
    try {
      const records = JSON.parse(localStorage.getItem("photo-critique-history") || "[]");
      const record = records.find((r: any) => r.id === id);
      if (record) {
        setCritiqueData(record);
        setMessages(record.messages || []);
      } else {
        toast.error(t("未找到该点评记录", "Critique record not found"));
        navigate("/history");
      }
    } catch {
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

  // Parse critique content into sections
  const parseCritiqueSections = (content: string) => {
    const sections: { title: string; content: string }[] = [];
    const lines = content.split("\n");
    let currentSection = { title: "", content: "" };

    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (currentSection.title) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("## ", ""), content: "" };
      } else if (line.startsWith("### ")) {
        if (currentSection.title) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace("### ", ""), content: "" };
      } else if (currentSection.title || currentSection.content) {
        currentSection.content += line + "\n";
      }
    }
    if (currentSection.title) {
      sections.push(currentSection);
    }
    return sections;
  };

  if (!critiqueData) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const mainCritique = messages.find(m => m.role === "assistant" && !m.generatedImage);
  const sections = mainCritique ? parseCritiqueSections(mainCritique.content) : [];

  return (
    <div className="min-h-screen pt-14 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gradient-gold">
                {t("详细锐评", "Detailed Critique")}
              </h1>
              <p className="text-sm text-muted-foreground">{critiqueData.title}</p>
            </div>
          </div>

          {/* Original Image */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <img
                src={critiqueData.imageData}
                alt="Critiqued photo"
                className="w-full h-auto object-contain"
              />
            </CardContent>
          </Card>

          {/* Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t("综合评分", "Overall Score")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold text-gradient-gold">{critiqueData.score}/100</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${critiqueData.score}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Critique Sections in Cards */}
          {sections.length > 0 ? (
            sections.map((section, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-primary">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {section.content.trim()}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("暂无详细点评", "No detailed critique available")}
              </CardContent>
            </Card>
          )}

          {/* AI Reference Image */}
          {messages.some(m => m.generatedImage) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {t("AI优化参考图", "AI Optimized Reference")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={messages.find(m => m.generatedImage)?.generatedImage}
                  alt="AI Generated"
                  className="w-full h-auto rounded-lg"
                />
              </CardContent>
            </Card>
          )}

          {/* Continue Chat */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("继续提问", "Continue Chat")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {messages.slice(1).map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary/10 text-foreground"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={t("输入问题...", "Ask a question...")}
                  className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
};

export default DetailedCritique;