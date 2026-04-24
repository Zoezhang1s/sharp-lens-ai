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
    const personas: Persona[] = [];

    // Detect photo themes
    const isOutdoor = text.includes("户外") || text.includes("室外") || text.includes("大自然");
    const isPortrait = text.includes("人像") || text.includes("肖像") || text.includes("自拍");
    const isStreet = text.includes("街头") || text.includes("街拍") || text.includes("城市");
    const isIndoor = text.includes("室内") || text.includes("家居") || text.includes("咖啡");
    const isNight = text.includes("夜景") || text.includes("夜晚") || text.includes("灯光");
    const isFood = text.includes("美食") || text.includes("食物") || text.includes("餐厅");
    const isPet = text.includes("宠物") || text.includes("猫") || text.includes("狗");
    const isKid = text.includes("儿童") || text.includes("小孩") || text.includes("宝宝");
    const isNature = text.includes("森林") || text.includes("花草") || text.includes("植物") || text.includes("海边") || text.includes("沙滩");
    const isTravel = text.includes("旅行") || text.includes("旅游") || text.includes("风景");
    const isCute = text.includes("可爱") || text.includes("萌") || text.includes("小清新");

    // Theme-specific persona pools
    const themePersonas: { theme: string; personas: Persona[] }[] = [
      {
        theme: "户外",
        personas: [
          { name: "丁真", avatar: "", style: "理塘旅游大使", critique: "这个背景太普通了嘛，我们理塘的蓝天白云不比这好看？下次来拍，我给你当导游！", lang: "zh" },
          { name: "贝爷", avatar: "", style: "野外生存专家", critique: "户外摄影最重要的是和自然互动，你这背景跟游客打卡照没区别。找到那个让人'哇'的瞬间！", lang: "zh" },
        ]
      },
      {
        theme: "人像",
        personas: [
          { name: "旺财", avatar: "", style: "专业舔狗", critique: "汪！这个人看起来心情不错，但拍照表情太僵了！主人说笑容要发自内心，你这个假笑太明显了！", lang: "zh" },
          { name: "石原里美", avatar: "", style: "日系女神", critique: "自拍角度很重要呢～这个光线把脸拍大了哦。下次试试从上面斜着拍，会更显脸小呢！", lang: "zh" },
        ]
      },
      {
        theme: "街头",
        personas: [
          { name: "森山大道", avatar: "", style: "街头摄影大师", critique: "ストリート写真は決意だ。この作品はうーん、もう少し空気感があればな。", translation: "街头摄影需要决心。这张嘛...如果再多点氛围感就好了。", lang: "ja" },
          { name: "五条悟", avatar: "", style: "最强法师", critique: "この写真、少しだけ物足りないな。次はもっと大胆に構図を決めてくれ！", translation: "这张照片有点不够味啊。下次构图再大胆一点！", lang: "ja" },
        ]
      },
      {
        theme: "室内",
        personas: [
          { name: "泡澡小黄鸭", avatar: "", style: "浴室哲学家", critique: "嘎嘎！室内拍照最重要的是光线，你这角度让整个人都暗沉了。要向窗户那边靠，让自然光照亮你！", lang: "zh" },
          { name: "二足鸦", avatar: "", style: "室内风水师", critique: "室内摄影讲究的是空间感，你这构图让房间显得逼仄。试试把手机抬高一点，俯拍会显得空间更大！", lang: "zh" },
        ]
      },
      {
        theme: "夜景",
        personas: [
          { name: "赛博朋克2077", avatar: "", style: "夜之城居民", critique: "Night city is dark, but your photo is darker. 夜景需要灯光，你这拍出来黑漆漆一片！找个光源拍会好很多！", lang: "en" },
          { name: "梵高", avatar: "", style: "后印象派画家", critique: "星空的夜晚应该有星星般的点光源。你这张夜景...夜空黑得像我的后期一样。加点灯光层次吧！", lang: "zh" },
        ]
      },
      {
        theme: "宠物",
        personas: [
          { name: "韩寒", avatar: "", style: "作家/赛车手", critique: "拍宠物和写作一样，要有耐心等那个对的表情。你这张狗都拍糊了——对焦点应该在眼睛上啊！", lang: "zh" },
          { name: "喵星人", avatar: "", style: "资深猫奴", critique: "拍猫最重要的是时机！你这张猫耳朵都耷拉下来了，明显是不想拍的状态。等它看你的时候再按快门！", lang: "zh" },
        ]
      },
      {
        theme: "儿童",
        personas: [
          { name: "蜡笔小新", avatar: "", style: "5岁灵魂画家", critique: "妈妈说小孩子拍照要自然！你这个pose太大人了啦～小孩子就要动起来拍才能抓到最真实的表情！", lang: "zh" },
          { name: "龙猫", avatar: "", style: "森林精灵", critique: "小孩子拍照最重要的是安全感和开心。你这表情太紧张了啦！下次买点零食哄一哄再拍～", lang: "zh" },
        ]
      },
      {
        theme: "可爱",
        personas: [
          { name: "可达鸭", avatar: "", style: "呆萌哲学家", critique: "嘎嘎嘎～这个pose太刻意了啦！可爱就是要自然不做作，你看我就往那一站就萌翻了！", lang: "zh" },
          { name: "琳娜贝尔", avatar: "", style: "迪士尼公主", critique: "拍照就是要开心！你这个笑得太用力了啦～自然甜美的笑容才是最美的呢！", lang: "zh" },
        ]
      },
      {
        theme: "美食",
        personas: [
          { name: "孤独的美食家", avatar: "", style: "五郎大叔", critique: "这道菜拍得...让我食欲都减少了三分。美食摄影要突出热气和人味儿，你这冷冰冰的没感觉。", lang: "zh" },
          { name: "悟里", avatar: "", style: "米其林大厨", critique: "摆盘是美食的灵魂，你这张把菜拍得像外卖小哥送的盒饭。从45度角俯拍，光线打在这道菜上！", lang: "zh" },
        ]
      },
      {
        theme: "旅行",
        personas: [
          { name: "徐霞客", avatar: "", style: "明代旅行家", critique: "旅行摄影讲究的是'我在场'。你这是打卡照，不是旅行照！下次试着让人融入风景，而不是站在风景前面。", lang: "zh" },
          { name: "安室透", avatar: "", style: "旅游特工", critique: "旅行照片的背景选择很重要！你这个人融不进风景啦，要找那种能让人一眼认出'啊这是某地'的机位！", lang: "zh" },
        ]
      },
    ];

    // Default personas for any theme
    const defaultPersonas: Persona[] = [
      { name: "张三丰", avatar: "", style: "扫地老僧", critique: "你这照片嘛...构图太满，不够透气。武林高手讲究留白，摄影也是同理。回去再练练吧。", lang: "zh" },
      { name: "小当家", avatar: "", style: "中华一番", critique: "摄影和做菜一样，讲究色香味俱全！你这张照片'卖相'不行，让人看了没胃口。", lang: "zh" },
      { name: "鲁迅", avatar: "", style: "文学巨匠", critique: "我素来不轻易评价图片，但这张嘛...确实是需要再多练习的。进步的秘诀是多看多拍。", lang: "zh" },
    ];

    // Pick personas based on detected themes
    if (isOutdoor || isNature || isTravel) {
      personas.push(...themePersonas.find(tp => tp.theme === "户外")!.personas);
    }
    if (isPortrait || isCute) {
      personas.push(...themePersonas.find(tp => tp.theme === "人像")!.personas);
    }
    if (isStreet) {
      personas.push(...themePersonas.find(tp => tp.theme === "街头")!.personas);
    }
    if (isIndoor) {
      personas.push(...themePersonas.find(tp => tp.theme === "室内")!.personas);
    }
    if (isNight) {
      personas.push(...themePersonas.find(tp => tp.theme === "夜景")!.personas);
    }
    if (isPet) {
      personas.push(...themePersonas.find(tp => tp.theme === "宠物")!.personas);
    }
    if (isKid) {
      personas.push(...themePersonas.find(tp => tp.theme === "儿童")!.personas);
    }
    if (isCute) {
      personas.push(...themePersonas.find(tp => tp.theme === "可爱")!.personas);
    }
    if (isFood) {
      personas.push(...themePersonas.find(tp => tp.theme === "美食")!.personas);
    }

    // Always add some default personas
    personas.push(...defaultPersonas.slice(0, 3));

    // Shuffle and pick 4-5 personas
    const shuffled = personas.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
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

  // Poll for updates when viewing in-progress critique from history
  useEffect(() => {
    if (!historyId) return;

    const pollInterval = setInterval(() => {
      // Check if we have a complete critique now
      if (messages.some(m => m.role === "assistant" && !m.generatedImage)) {
        clearInterval(pollInterval);
        return;
      }

      // Reload from localStorage to check for updates
      const records = JSON.parse(localStorage.getItem("photo-critique-history") || "[]");
      const updatedRecord = records.find((r: any) => r.id === historyId);

      if (updatedRecord && updatedRecord.messages.some((m: any) => m.role === "assistant")) {
        // New content arrived! Update state
        const userMsgWithImage = updatedRecord.messages.find((m: any) => m.role === "user" && m.imageData);
        if (userMsgWithImage) {
          setImageData(userMsgWithImage.imageData);
        }
        setMessages(updatedRecord.messages);

        // If critique just completed, trigger retry to ensure we have the latest
        if (!critiqueStartedRef.current) {
          critiqueStartedRef.current = true;
          triggerCritiqueWithRetry(updatedRecord.messages as Message[], true);
        }
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

  // Extract one-liner critique - brutal, direct, and theme-specific
  const getOneLinerCritique = () => {
    const assistantMsg = messages.find(m => m.role === "assistant" && !m.generatedImage);
    if (!assistantMsg) return "";
    const content = assistantMsg.content.toLowerCase();

    // Detect photo themes for specific roasts
    const themes: { keyword: string; roasts: string[]; good: string[] }[] = [
      {
        keyword: "人像",
        roasts: ["这张人像，表情僵得像游客照", "拍人像最重要的表情，你这个跟证件照似的", "人像摄影讲究神态，你这像个木头人"],
        good: ["人像能拍成这样，算你有点东西", "这表情抓得不错，有点灵魂"]
      },
      {
        keyword: "自拍",
        roasts: ["自拍最重要的是角度，你这角度把自己拍成大饼脸了", "美颜开太大了吧，原相机拍出来估计吓死人", "自拍要的是自然，你这假笑太明显了"],
        good: ["这个自拍角度绝了，很显脸小", "美得刚刚好，不假"]
      },
      {
        keyword: "风景",
        roasts: ["风景照拍成到此一游照了", "这构图，风光大片秒变游客打卡", "风景美但你拍得丑，浪费了"],
        good: ["这风景照有内味了", "大片感出来了"]
      },
      {
        keyword: "美食",
        roasts: ["美食被你拍成剩菜了", "这摆盘这光线，食欲瞬间没了", "拍美食不讲究光线，你这跟拍外卖似的"],
        good: ["这美食拍得让人流口水", "有点东西，食欲被勾起来了"]
      },
      {
        keyword: "夜景",
        roasts: ["夜景拍成夜魇了，黑得瘆人", "灯光呢？全是黑乎乎一片", "夜景没灯光就是黑一片，你这很真实地反映了问题"],
        good: ["夜景氛围感拉满了", "有点霓虹都市那味了"]
      },
      {
        keyword: "宠物",
        roasts: ["狗都拍糊了，对焦点应该在眼睛上", "猫都不看你，拍了个寂寞", "宠物摄影要抓拍，你这全是摆拍"],
        good: ["抓到了！狗狗最可爱的那一瞬", "猫咪灵魂出窍被抓到了"]
      },
      {
        keyword: "儿童",
        roasts: ["小孩子表情管理失败", "抓拍变摆拍，摆拍变僵硬", "拍小孩最重要的是自然，你这像拍证件照"],
        good: ["天真的笑容被记录下来了", "抓到了自然的表情，很真实"]
      },
      {
        keyword: "街头",
        roasts: ["街头摄影要有故事，你这像扫街敷衍", "决定性瞬间没抓到，全是废片", "街拍要有内味，你这个太普通了"],
        good: ["有人文气息了，不错", "扫街扫出品味来了"]
      },
      {
        keyword: "海边",
        roasts: ["海边的浪漫被你拍成阴天了", "沙滩拍成沙坑了，蓝天呢？", "海风、沙滩、夕阳，你这拍成了澡堂"],
        good: ["有海岛度假的感觉了", "海边写真的味道出来了"]
      },
      {
        keyword: "森林",
        roasts: ["森林被你拍得像路边绿化带", "小清新变成了阴间滤镜", "绿植拍得跟背景板似的，没层次"],
        good: ["森林系小姐姐的感觉有了", "氧气感十足"]
      },
      {
        keyword: "校园",
        roasts: ["校园小清新变成了乡土风", "校服照拍成了淘宝风", "青春感全无，像毕业证件照"],
        good: ["青春校园感拿捏了", "有那年的感觉了"]
      },
    ];

    // Find matching theme
    for (const theme of themes) {
      if (content.includes(theme.keyword)) {
        const scoreMatch = content.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

        if (score >= 80) {
          return theme.good[Math.floor(Math.random() * theme.good.length)];
        } else if (score >= 50) {
          return theme.roasts[Math.floor(Math.random() * theme.roasts.length)].replace("这", "这").replace("你", "你");
        } else {
          return theme.roasts[Math.floor(Math.random() * theme.roasts.length)];
        }
      }
    }

    // Fallback to score-based roasts
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

            {/* 2. Score */}
            {score !== null && (
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-bold text-gradient-gold">{score}</span>
                <span className="text-muted-foreground text-sm">/ 100</span>
              </div>
            )}

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
