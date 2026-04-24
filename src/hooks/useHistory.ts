import { useState, useEffect, useCallback } from "react";

export interface HistoryRecord {
  id: string;
  imageData: string; // base64 thumbnail
  summary: string;
  title: string;
  score: number;
  timestamp: number;
  messages: Array<{ role: string; content: string; imageData?: string; generatedImage?: string; detectedStyleId?: string }>;
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

/** Strip generatedImage from messages before persisting (keep imageData for resume) */
function lightenForStorage(records: HistoryRecord[]): any[] {
  return records.map((r) => ({
    ...r,
    messages: r.messages.map((m) => ({
      role: m.role,
      content: m.content,
      imageData: m.imageData,
      detectedStyleId: m.detectedStyleId,
      // drop generatedImage to save space
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
  const fullText = text.replace(/\*\*/g, "").replace(/[#🔥📊💯（）()🎨📱📝📐✨🔧💡❌>]/g, "");

  // Extract score
  const scoreMatch = text.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

  // Funny snarky titles based on score
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
