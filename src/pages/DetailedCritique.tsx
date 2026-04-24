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

// Clean markdown formatting and HTML entities
const cleanContent = (text: string): string => {
  return text
    .replace(/\*\*\*\*/g, "") // Remove *** bold markers
    .replace(/\*\*(.*?)\*\*/g, "$1") // Convert **bold** to plain text
    .replace(/_(.*?)_/g, "$1") // Convert _italic_ to plain text
    .replace(/~~(.*?)~~/g, "$1") // Convert ~~strikethrough~~ to plain text
    .replace(/#{1,6}\s/g, "") // Remove # headers
    .replace(/\|/g, " ") // Replace table pipes with spaces
    .replace(/---/g, "") // Remove horizontal rules
    .replace(/>/g, "") // Remove blockquotes
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .replace(/&amp;/g, "&") // Replace &amp; with &
    .replace(/&lt;/g, "<") // Replace &lt; with <
    .replace(/&gt;/g, ">") // Replace &gt; with >
    .replace(/&quot;/g, "\"") // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\n{3,}/g, "\n\n") // Remove extra newlines
    .trim();
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
      // Skip empty lines, hr lines, and table rows
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

// Extract links from text and return cleaned text with link info
const extractLinks = (text: string): { text: string; links: { text: string; url: string }[] } => {
  const links: { text: string; url: string }[] = [];
  const cleanedText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    links.push({ text: linkText, url });
    return linkText;
  });
  return { text: cleanedText, links };
};

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

  if (!critiqueData) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const mainCritique = messages.find(m => m.role === "assistant" && !m.generatedImage);
  const sections = mainCritique ? parseCritiqueSections(cleanContent(mainCritique.content)) : [];

  return (
    <div className="min-h-screen pt-14 flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center gap-3">
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

          {/* Image Comparison: Original vs AI Reference - at TOP */}
          {messages.some(m => m.generatedImage) ? (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground text-center mb-2">{t("原图", "Original")}</p>
                    <img
                      src={critiqueData.imageData}
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
          ) : (
            <Card className="overflow-hidden">
              <img
                src={critiqueData.imageData}
                alt="Critiqued photo"
                className="w-full h-auto object-contain"
              />
            </Card>
          )}

          {/* Score */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-gradient-gold">{critiqueData.score}</span>
                <span className="text-muted-foreground text-sm">/ 100</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                  {t("综合评分", "Overall Score")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Critique Sections in Cards - Multi-dimensional evaluation */}
          {sections.length > 0 ? (
            sections.map((section, i) => {
              const { text: cleanText, links } = extractLinks(section.content);
              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-primary">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-foreground leading-relaxed space-y-2">
                      <p className="whitespace-pre-wrap">{cleanText}</p>
                      {links.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {links.map((link, j) => (
                            <a
                              key={j}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline hover:text-primary/80"
                            >
                              {link.text}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("暂无详细点评", "No detailed critique available")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky Input Bar */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
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
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
};

export default DetailedCritique;