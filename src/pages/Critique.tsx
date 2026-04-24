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
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Generate dynamic personas based on critique theme
  const generateDynamicPersonas = (critiqueText: string): Persona[] => {
    const text = critiqueText.toLowerCase();

    // All persona pools - each with DISTINCT perspective and sharp critique style
    const allPersonas: Persona[] = [
      // === 摄影专业人士 - 技术派 ===
      { name: "陈漫", avatar: "", style: "时尚摄影师", critique: "光打偏了。侧光还是逆光要先想清楚，主光要在模特30-45度角，轮廓光才立体。", lang: "zh" },
      { name: "张艺谋", avatar: "", style: "电影导演", critique: "色彩没有主调。红是红绿是绿，互相打架。定一个氛围色，所有颜色往那边靠。", lang: "zh" },
      { name: "Annie Leibovitz", avatar: "", style: "人像大师", critique: "Stiff. Get them moving, laughing, then shoot in bursts. The best portraits happen when people forget the camera.", translation: "太僵硬了。让他们动起来、笑，然后连拍。最好的肖像发生在人们忘记相机的时候。", lang: "en" },
      { name: "森山大道", avatar: "", style: "街头摄影", critique: "街拍要等。等那个人走到光里，等自行车骑过，等影子拉长。你的照片全是抓拍，没有预判。", lang: "zh" },
      { name: "荒木经惟", avatar: "", style: "日本摄影大师", critique: "被写体を愛してない。撮影前に5分会話しろ。空気が変わると、写りも変わる。", translation: "没有爱被摄体。拍摄前先聊5分钟。空气变了，拍出来也会变。", lang: "ja" },

      // === 搞笑反差 - 毒舌但有道理 ===
      { name: "旺财", avatar: "", style: "吃货狗", critique: "这pose僵得跟我被带去宠物店拍照一样！放松，歪头，看镜头——三连，你照做我看看。", lang: "zh" },
      { name: "米奇妙妙屋", avatar: "", style: "IQ50侦探", critique: "嘿嘿...这张照片构图的问题在于——主体不够突出。就像我永远找不到我的 cheese 一样！", lang: "zh" },
      { name: "蜡笔小新", avatar: "", style: "5岁灵魂", critique: "妈妈说动起来拍才自然！你站那么直干嘛～跑来跑去的时候让爸爸妈妈连拍！", lang: "zh" },
      { name: "海绵宝宝", avatar: "", style: "乐观天才", critique: "我准备好了！我准备好了！——你拍照的时机不对，要在最好玩的那一秒按下去！", lang: "zh" },

      // === 科学家/学者 - 理性分析派 ===
      { name: "爱因斯坦", avatar: "", style: "理论物理学家", critique: "E=mc²，但好照片 = 构图 + 光线 + 时机。你的公式缺了两项。", lang: "zh" },
      { name: "达尔文", avatar: "", style: "生物学家", critique: "适者生存，强者曝光。你这张不是过度曝光就是死黑，自然光用不好就找个窗边。", lang: "zh" },
      { name: "霍金", avatar: "", style: "天体物理学家", critique: "The universe is dark. Your photo is also dark. Coincidence? I think not.", translation: "宇宙是黑的。你的照片也黑。这是巧合吗？我不这么认为。", lang: "en" },

      // === 艺术家/作家 - 感觉派 ===
      { name: "梵高", avatar: "", style: "后印象派", critique: "星空有星月，夜景要有灯光层次！你这黑成一坨，像我割耳朵那天的心情。去找个光源。", lang: "zh" },
      { name: "鲁迅", avatar: "", style: "文学巨匠", critique: "我向来不轻易褒贬。但这张——进步空间的确很大。多拍，多看，少滤镜。", lang: "zh" },
      { name: "宫崎骏", avatar: "", style: "动画大师", critique: "この写真には生命がない。風の音、葉の揺れ、光の粒——それを感じられる瞬間を待て。", translation: "这张照片没有生命。风的声响、树叶的摇曳、光的颗粒——等待能感受到那些的瞬间。", lang: "ja" },

      // === 商业大佬 - 结果派 ===
      { name: "马斯克", avatar: "", style: "SpaceX CEO", critique: "Failed launch. If this were a rocket, we'd say 'needs improvement.' Actually, just delete and retake.", translation: "发射失败。如果这是火箭，我们会说'需要改进'。其实，删了重拍吧。", lang: "en" },
      { name: "马云", avatar: "", style: "商业导师", critique: "格局小了。拍照也是一样，要有人无我有、人有我精的意识。你的照片太普通了。", lang: "zh" },
      { name: "何炅", avatar: "", style: "主持人", critique: "拍照要有观众视角。你这张，焦点乱飘，表情僵硬——先让被拍的人放松下来。", lang: "zh" },

      // === 网红博主 - 内容派 ===
      { name: "李子柒", avatar: "", style: "田园生活家", critique: "你这照片没有'味道'。好的照片能让人闻到香气、听到虫鸣。先想想你要传达什么情绪。", lang: "zh" },
      { name: "papi酱", avatar: "", style: "短视频博主", critique: "信息密度太低了！3秒内讲不完一个故事的画面，不是好画面。", lang: "zh" },

      // === 美食专家 ===
      { name: "孤独的美食家", avatar: "", style: "五郎大叔", critique: "热气！热气没了！食物摄影第一法则：趁热拍。凉了之后光泽感全失。", lang: "zh" },
      { name: "小当家", avatar: "", style: "中华小当家", critique: "这道菜发光的部分呢？！油光、水汽、高光——美食照没有这三样，就是一碗剩饭。", lang: "zh" },

      // === 宠物专家 ===
      { name: "忠犬八公", avatar: "", style: "狗界标杆", critique: "眼睛！焦点要对在眼睛上！狗子眼神光没有，整张照片就失去了灵魂。", lang: "zh" },
      { name: "橘猫", avatar: "", style: "资深猫奴", critique: "等猫看镜头的那一秒再拍。其他时候按的都是废片。相信我，我每天都这样被拍。", lang: "zh" },
    ];

    // Detect themes
    const isPortrait = text.includes("人像") || text.includes("肖像") || text.includes("自拍");
    const isStreet = text.includes("街头") || text.includes("街拍");
    const isNight = text.includes("夜景") || text.includes("夜晚");
    const isFood = text.includes("美食") || text.includes("食物");
    const isPet = text.includes("宠物") || text.includes("猫") || text.includes("狗");
    const isKid = text.includes("儿童") || text.includes("小孩");
    const isNature = text.includes("森林") || text.includes("海边") || text.includes("沙滩");
    const isTravel = text.includes("旅行") || text.includes("风景");
    const isIndoor = text.includes("室内") || text.includes("家居");

    // Theme-specific boost
    let pool = [...allPersonas];
    if (isPortrait || isStreet) {
      // Prioritize portrait/street photographers
      pool = pool.sort((a, b) => {
        const portraitBoost = (name: string) =>
          ["陈漫", "Annie Leibovitz", "森山大道", "张艺谋", "荒木经惟", "旺财", "蜡笔小新", "五条悟"].includes(name) ? -1 : 1;
        return portraitBoost(a.name) - portraitBoost(b.name);
      });
    } else if (isNature || isTravel) {
      pool = pool.sort((a, b) => {
        const natureBoost = (name: string) =>
          ["丁真", "李子柒", "徐霞客", "宫崎骏", "梵高"].includes(name) ? -1 : 1;
        return natureBoost(a.name) - natureBoost(b.name);
      });
    } else if (isFood) {
      pool = pool.sort((a, b) => {
        const foodBoost = (name: string) =>
          ["孤独的美食家", "悟里", "小当家"].includes(name) ? -1 : 1;
        return foodBoost(a.name) - foodBoost(b.name);
      });
    } else if (isPet) {
      pool = pool.sort((a, b) => {
        const petBoost = (name: string) =>
          ["旺财", "喵星人", "韩寒"].includes(name) ? -1 : 1;
        return petBoost(a.name) - petBoost(b.name);
      });
    }

    // Pick 5 personas ensuring diversity:
    // - 2 photography professionals (Chinese)
    // - 1 funny character (anime/meme style)
    // - 1 scientist or artist
    // - 1 business/influencer personality
    // Non-Chinese must have Chinese translations
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 10);

    const result: Persona[] = [];
    const usedNames = new Set<string>();

    // Helper categories
    const professionals = ["陈漫", "张艺谋", "森山大道", "荒木经惟"];
    const funnyChars = ["旺财", "米奇妙妙屋", "蜡笔小新", "海绵宝宝"];
    const scientists = ["爱因斯坦", "达尔文", "霍金"];
    const artists = ["梵高", "鲁迅", "宫崎骏"];
    const business = ["马斯克", "马云", "何炅", "李子柒", "papi酱"];
    const foodPets = ["孤独的美食家", "小当家", "忠犬八公", "橘猫"];

    const pickFrom = (names: string[]) => {
      for (const name of names) {
        if (result.length >= 5) break;
        const p = picked.find(p => p.name === name);
        if (p && !usedNames.has(p.name)) {
          result.push(p);
          usedNames.add(p.name);
        }
      }
    };

    // Order: pros -> funny -> scientists/artists -> business
    pickFrom(professionals);
    pickFrom(funnyChars);
    pickFrom([...scientists, ...artists]);
    pickFrom([...business, ...foodPets]);

    // If not enough, fill from remaining
    if (result.length < 5) {
      for (const p of picked) {
        if (result.length >= 5) break;
        if (!usedNames.has(p.name)) {
          result.push(p);
          usedNames.add(p.name);
        }
      }
    }

    return result.slice(0, 5);
  };

  // Update personas when critique is ready
  useEffect(() => {
    if (messages.some(m => m.role === "assistant" && !m.generatedImage)) {
      const assistantMsg = messages.find(m => m.role === "assistant" && !m.generatedImage);
      if (assistantMsg && personas.length === 0) {
        setPersonas(generateDynamicPersonas(assistantMsg.content));
      }
    }
  }, [messages, personas.length]);
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

        // Check if critique is complete (has assistant with generatedImage) or needs retry
        const hasCompleteResponse = record.messages.some((m: any) => m.role === "assistant" && m.generatedImage);
        const hasPartialResponse = record.messages.some((m: any) => m.role === "assistant" && !m.generatedImage);

        if (hasCompleteResponse) {
          // Critique is complete, nothing to do
        } else if (hasPartialResponse || !record.messages.some((m: any) => m.role === "assistant")) {
          // Partial or no response - need to retry
          // Clear the partial message and retry with just the user message
          const userMsg = record.messages.find((m: any) => m.role === "user");
          if (userMsg) {
            setIsLoading(true);
            // Clear messages to remove partial assistant response
            setMessages([userMsg as Message]);
            // Retry after a short delay to let state update
            setTimeout(() => {
              triggerCritiqueWithRetry([userMsg as Message], true);
            }, 100);
          }
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

  // Poll for updates when viewing in-progress critique from history
  useEffect(() => {
    if (!historyId) return;

    // Stop polling if we already have a complete critique
    if (messages.some(m => m.role === "assistant" && m.generatedImage)) {
      return;
    }

    const pollInterval = setInterval(() => {
      // Re-check - might have completed while polling
      if (messages.some(m => m.role === "assistant" && m.generatedImage)) {
        clearInterval(pollInterval);
        return;
      }

      // Reload from localStorage to check for updates
      const records = JSON.parse(localStorage.getItem("photo-critique-history") || "[]");
      const updatedRecord = records.find((r: any) => r.id === historyId);

      if (updatedRecord && updatedRecord.messages.some((m: any) => m.role === "assistant" && m.generatedImage)) {
        // Complete response arrived in localStorage! Update state
        const userMsgWithImage = updatedRecord.messages.find((m: any) => m.role === "user" && m.imageData);
        if (userMsgWithImage) {
          setImageData(userMsgWithImage.imageData);
        }
        setMessages(updatedRecord.messages);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [historyId, messages]);

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

    // Extract key suggestions from critique for a focused image prompt
    const extractImagePrompt = (critique: string): string => {
      const lines = critique.split("\n");
      const keyTerms: string[] = [];

      // Keywords that indicate actionable suggestions
      const suggestionKeywords = ["光", "角度", "构图", "背景", "姿势", "表情", "服饰", "场地", "时间", "时段", "机位", "构图"];

      for (const line of lines) {
        const trimmed = line.trim();
        // Skip headers and tables
        if (trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith("---")) continue;

        for (const keyword of suggestionKeywords) {
          if (trimmed.includes(keyword) && trimmed.length < 100) {
            // Extract the suggestion part
            const match = trimmed.match(new RegExp(`[^。！？,]*${keyword}[^。！？,]*`));
            if (match) {
              const suggestion = match[0].replace(/\*\*/g, "").replace(/[*#]/g, "").trim();
              if (suggestion.length > 3 && suggestion.length < 80) {
                keyTerms.push(suggestion);
              }
            }
          }
        }
      }

      // Dedupe and limit
      const uniqueTerms = [...new Set(keyTerms)].slice(0, 5);
      return uniqueTerms.join("，");
    };

    const imagePrompt = extractImagePrompt(critiqueText);

    setIsGeneratingImage(true);
    try {
      const resp = await fetch(GENERATE_IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt: imagePrompt || (lang === "zh" ? "更好的拍摄效果，改进构图和光线" : "Better shot with improved composition and lighting"),
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
            "## 🎨 AI优化参考图\n\n基于以下建议生成的优化参考：\n\n> 💡 *AI参考图，实际拍摄请灵活调整*",
            "## 🎨 AI Optimized Reference\n\nBased on key suggestions:\n\n> 💡 *AI reference — adjust based on actual conditions*"
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

    const getSearchLink = (linkText: string): string => {
      // Convert link text to a Google search link
      const searchQuery = encodeURIComponent(linkText + " 摄影");
      return `https://www.google.com/search?q=${searchQuery}`;
    };

    const renderInline = (text: string) => {
      // Decode HTML entities first
      const decoded = decodeHtmlEntities(text);
      // First split by markdown links [text](url)
      const linkParts = decoded.split(/(\[.*?\]\(.*?\))/g);
      return linkParts.map((seg, si) => {
        const linkMatch = seg.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          // Use the actual URL from the markdown link, not a fallback Google search
          return (
            <a key={si} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors no-underline">
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
      .replace(/\*\*(.*?)\*\*/g, "$1"); // Remove bold markers

    // Key phrases to highlight
    const keyPhrases = [
      "建议", "重点", "关键", "必须", "一定", "不要", "避免",
      "提高", "改善", "加强", "注意", "调整", "改变",
      "构图", "光线", "曝光", "对焦", "白平衡", "色彩",
      "姿势", "表情", "背景", "光圈", "快门",
      "ISO", "焦段", "角度", "机位", "时段",
    ];

    // Helper to render a string with markdown links rendered as clickable badges
    const renderWithLinks = (line: string, keyPrefix: string): React.ReactNode => {
      const parts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
      return parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) {
          return (
            <a
              key={`${keyPrefix}-l-${i}`}
              href={m[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors no-underline"
            >
              {m[1]}
            </a>
          );
        }
        // Highlight key phrases
        for (const phrase of keyPhrases) {
          if (part.includes(phrase) && part.length < 200) {
            const regex = new RegExp(`(${phrase}[^，。,.]*)`, "g");
            return part.split(regex).map((seg, k) =>
              k % 2 === 1 ? (
                <strong key={`${keyPrefix}-h-${i}-${k}`} className="text-amber-500 font-semibold">{seg}</strong>
              ) : (
                <span key={`${keyPrefix}-t-${i}-${k}`}>{seg}</span>
              )
            );
          }
        }
        return <span key={`${keyPrefix}-p-${i}`}>{part}</span>;
      });
    };

    // Split by lines and handle tables specially
    const lines = cleaned.split("\n");
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;
    let colCount = 0;

    const flushTable = () => {
      if (tableRows.length > 0) {
        const isHeaderRow = (row: string[]) => row.some(c => c.includes("维度") || c.includes("⭐") || c.includes("评分"));
        elements.push(
          <div key={`table-${elements.length}`} className="border border-border/30 rounded-lg overflow-hidden mb-3">
            {tableRows.map((row, ri) => {
              if (isHeaderRow(row) && ri === 0) {
                return (
                  <div key={ri} className="grid gap-1 text-xs py-2 px-3 bg-secondary/50 font-semibold text-muted-foreground border-b border-border/30"
                    style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
                    {row.map((cell, ci) => (
                      <span key={ci} className={`text-center ${ci === 1 && cell.includes("⭐") ? "text-amber-400" : ""}`}>{cell}</span>
                    ))}
                  </div>
                );
              }
              return (
                <div key={ri} className="grid gap-1 text-xs py-2 px-3 hover:bg-secondary/30"
                  style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
                  {row.map((cell, ci) => (
                    <span key={ci} className={`${ci <= 1 ? "text-center" : "text-left"}`}>{renderWithLinks(cell, `tbl-${ri}-${ci}`)}</span>
                  ))}
                </div>
              );
            })}
          </div>
        );
        tableRows = [];
        inTable = false;
        colCount = 0;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      // Detect table row
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const cells = trimmed.split("|").filter(c => c.trim() !== "").map(c => c.trim());
        // Skip separator row
        if (cells.every(c => /^[\s:-]+$/.test(c))) continue;
        inTable = true;
        colCount = Math.max(colCount, cells.length);
        tableRows.push(cells);
      } else {
        if (inTable) flushTable();
        if (!trimmed) continue;
        // Check if this line is a sentence-ending paragraph
        if (trimmed.includes("。") || trimmed.includes("！") || trimmed.includes("？")) {
          elements.push(
            <p key={elements.length} className="text-sm text-foreground leading-relaxed mb-2">
              {renderWithLinks(trimmed, `p-${elements.length}`)}
            </p>
          );
        } else {
          // Continue building current paragraph
          elements.push(
            <p key={elements.length} className="text-sm text-foreground leading-relaxed mb-1">
              {renderWithLinks(trimmed, `p-${elements.length}`)}
            </p>
          );
        }
      }
    }
    if (inTable) flushTable();

    return elements;
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

  // Extract one-liner critique from the actual AI critique content
  const getOneLinerCritique = () => {
    const assistantMsg = messages.find(m => m.role === "assistant" && !m.generatedImage);
    if (!assistantMsg) return "";

    // Try to find a sharp/funny line from the actual critique content
    // Look for keywords that indicate a punchy summary line
    const lines = assistantMsg.content.split("\n");

    // Find lines that seem like impactful summary statements
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip headers, tables, empty lines
      if (trimmed.startsWith("#") || trimmed.startsWith("|") || !trimmed) continue;

      // Look for lines with 暴击/致命/问题/建议 keywords that are short
      if ((trimmed.includes("暴击") || trimmed.includes("致命") || trimmed.includes("问题") || trimmed.includes("建议")) && trimmed.length < 60) {
        // Clean markdown
        const cleaned = trimmed.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^.*?[：:]\s*/, "");
        if (cleaned.length > 5) return cleaned;
      }
    }

    // Extract the first meaningful sentence from 快速诊断 or similar sections
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.includes("诊断") || trimmed.includes("问题") || trimmed.includes("总结")) && trimmed.length < 80) {
        const cleaned = trimmed.replace(/\*\*/g, "").replace(/^.*?[：:]\s*/, "");
        if (cleaned.length > 10) return cleaned;
      }
    }

    // Fallback: extract first short paragraph
    let paragraph = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith("---") || !trimmed) continue;
      paragraph += trimmed + " ";
      if (trimmed.includes("。") && paragraph.length > 10) {
        return paragraph.replace(/\*\*/g, "").slice(0, 50);
      }
    }

    return "";
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
      } else if (trimmed && !trimmed.startsWith("---")) {
        // Include table rows in content
        if (currentSection.title || currentSection.content) {
          currentSection.content += trimmed + "\n";
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

      {/* Main Content - Show when critique has any content (complete or in-progress) */}
      {(score !== null || messages.some(m => m.role === "assistant")) ? (
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

            {/* 2. Score + One-liner Critique - shown together above 群友锐评 */}
            {(getOneLinerCritique() || score !== null) && (
              <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
                <CardContent className="pt-4 pb-4 space-y-3">
                  {score !== null && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gradient-gold">{score}</span>
                      <span className="text-sm text-muted-foreground">/ 100</span>
                      <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full ml-auto">
                        {t("综合评分", "Overall Score")}
                      </span>
                    </div>
                  )}
                  {getOneLinerCritique() && (
                    <div>
                      <h3 className="text-sm font-bold text-primary mb-2">💥 {t("一句话暴击", "One-liner Roast")}</h3>
                      <p className="text-sm text-foreground leading-relaxed">{getOneLinerCritique()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                {parseCritiqueSections(messages.find(m => m.role === "assistant" && !m.generatedImage)?.content || "")
                  .filter((section) => {
                    // Hide one-liner roast and score sections — they're shown above
                    const t = section.title;
                    return !(
                      t.includes("一句话暴击") ||
                      t.includes("一句话总结") ||
                      t.includes("Opening Roast") ||
                      t.includes("One-liner") ||
                      t.includes("评分") ||
                      t.includes("Score")
                    );
                  })
                  .map((section, i) => {
                    // Check if this is 风格识别 section
                    const isStyleSection = section.title.includes("风格") || section.title.includes("Style");

                    return (
                      <Card key={i}>
                        <CardContent className="pt-4">
                          {isStyleSection ? (
                            <>
                              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <h4 className="text-sm font-semibold text-primary">{section.title}</h4>
                                {messages.find(m => m.detectedStyleId) && (
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="text-primary h-auto p-0"
                                    onClick={() => {
                                      const styleId = messages.find(m => m.detectedStyleId)?.detectedStyleId;
                                      if (styleId) navigate(`/styles/${styleId}`, { state: { fromCritique: true, historyId } });
                                    }}
                                  >
                                    {t("查看风格攻略 →", "View style guide →")}
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1">
                                {renderDetailedContent(section.content.trim())}
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 className="text-sm font-semibold text-primary mb-3">{section.title}</h4>
                              <div className="space-y-1">
                                {renderDetailedContent(section.content.trim())}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Loading states when critique not yet started or no content */
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
