import { useState, useEffect, useCallback } from "react";

export interface HistoryRecord {
  id: string;
  imageData: string; // base64 thumbnail
  summary: string;
  title: string;
  score: number;
  timestamp: number;
  messages: Array<{ role: string; content: string; imageData?: string; generatedImage?: string; detectedStyleId?: string }>;
  titleLocked?: boolean; // once AI title is set, never overwrite
}

const STORAGE_KEY = "photo-critique-history";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const MAX_THUMB_SIZE = 150;

function compressImage(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(MAX_THUMB_SIZE / img.width, MAX_THUMB_SIZE / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = () => resolve(base64.slice(0, 500));
    img.src = base64;
  });
}

/** Strip large fields where possible but keep generatedImage so the page can re-render without regenerating */
function lightenForStorage(records: HistoryRecord[]): any[] {
  return records.map((r) => ({
    ...r,
    messages: r.messages.map((m) => ({
      role: m.role,
      content: m.content,
      imageData: m.imageData,
      detectedStyleId: m.detectedStyleId,
      generatedImage: m.generatedImage, // KEEP — needed to avoid regenerating from history
    })),
  }));
}

function saveRecords(records: HistoryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightenForStorage(records)));
  } catch {
    // If still too large, keep only last 10
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightenForStorage(records.slice(0, 10))));
    } catch {
      // give up gracefully
    }
  }
}

function loadRecords(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const records: HistoryRecord[] = JSON.parse(raw);
    const cutoff = Date.now() - THIRTY_DAYS;
    return records.filter((r) => r.timestamp > cutoff);
  } catch {
    return [];
  }
}

export function extractScoreFromText(text: string): number {
  const match = text.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function generateTitle(text: string, lang: string): string {
  const lines = text.split("\n");
  const fullText = text.replace(/\*\*/g, "");
  const lower = fullText.toLowerCase();

  // Extract score
  const scoreMatch = text.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

  // Theme detection with multiple aliases — picks the FIRST matching theme by AI critique content
  const themeAliases: { theme: string; emoji: string; aliases: string[] }[] = [
    { theme: "自拍", emoji: "🤳", aliases: ["自拍", "selfie"] },
    { theme: "人像", emoji: "👤", aliases: ["人像", "肖像", "portrait", "人物照"] },
    { theme: "美食", emoji: "🍜", aliases: ["美食", "食物", "菜品", "餐厅", "food", "dish", "蛋糕", "饮料", "咖啡", "甜品"] },
    { theme: "夜景", emoji: "🌃", aliases: ["夜景", "夜拍", "night", "霓虹", "夜晚"] },
    { theme: "宠物", emoji: "🐾", aliases: ["宠物", "猫咪", "狗子", "pet", "cat", "dog"] },
    { theme: "儿童", emoji: "🧒", aliases: ["儿童", "小孩", "孩子", "宝宝", "child", "kid"] },
    { theme: "海边", emoji: "🌊", aliases: ["海边", "海滩", "海岸", "beach", "ocean"] },
    { theme: "森林", emoji: "🌲", aliases: ["森林", "树林", "森系", "forest"] },
    { theme: "校园", emoji: "🎒", aliases: ["校园", "教室", "校服", "campus"] },
    { theme: "街拍", emoji: "🚶", aliases: ["街拍", "扫街", "街头", "street"] },
    { theme: "风景", emoji: "🏞️", aliases: ["风景", "山景", "landscape", "scenery"] },
    { theme: "建筑", emoji: "🏛️", aliases: ["建筑", "城市", "architecture"] },
    { theme: "旅行", emoji: "✈️", aliases: ["旅行", "旅游", "travel", "打卡"] },
    { theme: "穿搭", emoji: "👗", aliases: ["穿搭", "outfit", "ootd", "搭配"] },
    { theme: "花卉", emoji: "🌸", aliases: ["花", "花卉", "flower", "花朵"] },
    { theme: "天空", emoji: "☁️", aliases: ["天空", "云", "晚霞", "日落", "sunset", "sky"] },
    { theme: "婚纱", emoji: "👰", aliases: ["婚纱", "婚礼", "wedding"] },
    { theme: "证件照", emoji: "🪪", aliases: ["证件照", "id photo", "工牌"] },
  ];

  let detectedTheme = "";
  let detectedEmoji = "";
  for (const { theme, emoji, aliases } of themeAliases) {
    if (aliases.some(a => lower.includes(a.toLowerCase()))) {
      detectedTheme = theme;
      detectedEmoji = emoji;
      break;
    }
  }

  if (detectedTheme) {
    const roastByTier = (s: number): string[] => {
      if (s >= 90) return ["原地封神", "神图就位", "封面级出片", "杀疯了", "直接出道"];
      if (s >= 75) return ["稳的可以发圈", "有点东西", "在线水平", "能打", "审美在线"];
      if (s >= 55) return ["勉强能看", "凑合及格", "中规中矩", "再练练", "差点意思"];
      if (s >= 35) return ["拍了个寂寞", "废片预警", "翻车现场", "审美告急", "灵魂歪了"];
      return ["建议删除", "灾难现场", "辣眼睛预警", "毁图一张", "已被判死刑"];
    };
    const pool = roastByTier(score || 50);
    const tag = pool[Math.floor(Math.random() * pool.length)];
    return `${detectedEmoji} ${detectedTheme} · ${tag}`;
  }

  // Detect photo themes
  const themes: { keyword: string; titles: { low: string[]; mid: string[]; high: string[] } }[] = [
    {
      keyword: "人像",
      titles: {
        low: ["人像翻车现场", "表情管理失败的人像", "证件照水平的人像"],
        mid: ["能看的人像照", "有点人像味了", "人像有待提高"],
        high: ["绝美人像", "有灵魂的人像", "大片人像"]
      }
    },
    {
      keyword: "自拍",
      titles: {
        low: ["自拍翻车大赏", "大饼脸自拍", "美颜过度自拍"],
        mid: ["及格的自拍", "角度还行", "凑合能发"],
        high: ["神仙角度自拍", "原生相机也绝美", "点赞收割机自拍"]
      }
    },
    {
      keyword: "风景",
      titles: {
        low: ["游客打卡照", "风景拍成阴间风", "浪费了好风景"],
        mid: ["及格的风景照", "有点意境了", "普通风景记录"],
        high: ["壁纸级风景", "大片风景", "让人想去旅行的风景"]
      }
    },
    {
      keyword: "美食",
      titles: {
        low: ["美食拍成剩菜", "外卖照片既视感", "食欲杀手美食"],
        mid: ["能看的美食照", "拍出了点食欲", "及格美图"],
        high: ["让人流口水的美食", "米其林级别美食", "美食博主既视感"]
      }
    },
    {
      keyword: "夜景",
      titles: {
        low: ["夜景拍成夜魇", "全是黑乎乎", "灯光呢？"],
        mid: ["有点夜景氛围了", "凑合的夜拍", "能看的夜景"],
        high: ["霓虹都市大片", "夜景绝了", "有电影感了"]
      }
    },
    {
      keyword: "宠物",
      titles: {
        low: ["糊成一片的宠物", "对焦失败的宠物照", "狗子看了会沉默"],
        mid: ["能看的宠物照", "抓到了点神态", "及格的宠物记录"],
        high: ["狗子天使颜", "猫咪灵魂出窍", "宠物大片"]
      }
    },
    {
      keyword: "儿童",
      titles: {
        low: ["童年阴影照片", "小孩表情管理失败", "抓拍变摆拍失败"],
        mid: ["凑合的儿童照", "有点童真感了", "及格的成长记录"],
        high: ["天真的笑容绝了", "抓到了！童年感", "儿童摄影范本"]
      }
    },
    {
      keyword: "海边",
      titles: {
        low: ["海边拍成澡堂", "浪漫变土味", "蓝天没了只剩人"],
        mid: ["有海边feel了", "凑合的海边照", "及格的海岸线"],
        high: ["海边大片", "蓝天白云绝了", "度假感满满"]
      }
    },
    {
      keyword: "森林",
      titles: {
        low: ["小清新变阴间风", "绿植拍成背景板", "氧气感为零"],
        mid: ["有点森林感了", "凑合的小森林", "及格的绿植照"],
        high: ["森林精灵风", "氧气感十足", "小清新大片"]
      }
    },
    {
      keyword: "校园",
      titles: {
        low: ["校园小清新变土味", "校服照像淘宝风", "青春感为零"],
        mid: ["有点校园感了", "凑合的校园照", "及格的学生照"],
        high: ["青春校园感拿捏", "那年mv既视感", "校园大片"]
      }
    },
    {
      keyword: "街头",
      titles: {
        low: ["街拍变路人记录", "扫街敷衍了事", "决定性瞬间为零"],
        mid: ["有点街拍味了", "凑合的街头摄影", "及格的街拍"],
        high: ["有人文气息", "街头大片感", "扫街高手"]
      }
    },
  ];

  // Find matching theme
  for (const theme of themes) {
    if (fullText.toLowerCase().includes(theme.keyword)) {
      let pool: string[];
      if (score >= 75) pool = theme.titles.high;
      else if (score >= 45) pool = theme.titles.mid;
      else pool = theme.titles.low;

      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // Fallback to score-based titles
  if (score > 0) {
    if (score < 30) {
      const badTitles = [
        "烂片鉴定完毕，建议删除",
        "这照片...我选择沉默",
        "摄影师看了会沉默",
        "建议设为手机壁纸提醒自己进步",
        "拍了个寂寞",
      ];
      return badTitles[Math.floor(Math.random() * badTitles.length)];
    }
    if (score < 50) {
      const okTitles = [
        "有进步空间，真的",
        "比游客照强一点",
        "勉强能发朋友圈",
        "摄影师的痛你不懂",
        "下次会更好的",
      ];
      return okTitles[Math.floor(Math.random() * okTitles.length)];
    }
    if (score < 70) {
      const midTitles = [
        "及格线上的选手",
        "有点东西但不多",
        "潜力股，了解一下",
        "普通但不算烂",
        "继续加油吧",
      ];
      return midTitles[Math.floor(Math.random() * midTitles.length)];
    }
    if (score < 85) {
      const goodTitles = [
        "不错不错，能看！",
        "朋友圈点赞收割机",
        "有点审美在线",
        "可以给朋友炫耀了",
        "摄影师小有成就",
      ];
      return goodTitles[Math.floor(Math.random() * goodTitles.length)];
    }
    // 85-100
    const greatTitles = [
      "大片既视感！",
      "这水平可以接单了",
      "绝绝子！",
      "摄影师天赋异禀",
      "原地出道吧",
    ];
    return greatTitles[Math.floor(Math.random() * greatTitles.length)];
  }

  // Fallback if no score found
  for (const line of lines) {
    if (line.includes("构图") && line.includes("问题")) return "构图有问题";
    if (line.includes("光线")) return "光线不太行";
    if (line.includes("表情")) return "表情管理失败";
    if (line.includes("背景")) return "背景太乱";
  }

  return lang === "zh" ? "一张照片的命运" : "Photo Destiny";
}

export function useHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>(loadRecords);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  const addRecord = useCallback(async (record: Omit<HistoryRecord, "id" | "timestamp">) => {
    // Compress thumbnail before storing
    const compressedImage = await compressImage(record.imageData);
    const newRecord: HistoryRecord = {
      ...record,
      imageData: compressedImage,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setRecords((prev) => [newRecord, ...prev]);
    return newRecord.id;
  }, []);

  const updateRecord = useCallback((id: string, updates: Partial<HistoryRecord>) => {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRecord = useCallback(
    (id: string) => records.find((r) => r.id === id) ?? null,
    [records]
  );

  return { records, addRecord, updateRecord, deleteRecord, getRecord };
}
