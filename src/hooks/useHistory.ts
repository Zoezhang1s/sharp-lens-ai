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
  const score = scoreMatch ? scoreMatch[1] : "";

  // Extract style/genre keywords
  const stylePatterns = [
    /风格[:\s]*([^\n，,。！？]{2,10})/,
    /当前风格[:\s]*([^\n，,。！？]{2,10})/,
    /类型[:\s]*([^\n，,。！？]{2,10})/,
    /场景[:\s]*([^\n，,。！？]{2,10})/,
  ];
  let style = "";
  for (const pattern of stylePatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      style = match[1].trim();
      break;
    }
  }

  // Extract most prominent critique keyword (what needs improvement or is noteworthy)
  const negativePatterns = [
    /光[线影]+(太|比较|比较)?([一-龥]{2,8})/,
    /构[图](太|比较|比较)?([一-龥]{2,8})/,
    /曝[光明](太|过|欠)?([一-龥]{2,8})/,
    /色[调彩](太|比较|比较)?([一-龥]{2,8})/,
    /姿[势态](太|比较|僵硬|不自然)?([一-龥]{2,8})/,
    /背[景虚](太|比较)?([一-龥]{2,8})/,
    /表[情达](不自然|僵硬|平淡)?([一-龥]{2,8})/,
    /对[焦清晰度](不|虚)?([一-龥]{2,8})/,
  ];

  let critiqueKeyword = "";
  for (const pattern of negativePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      critiqueKeyword = match[0].slice(0, 12);
      break;
    }
  }

  // If no negative keyword found, look for positive
  if (!critiqueKeyword) {
    const positivePatterns = [
      /光[线影]+[很讲较不错好][一-龥]*/,
      /构[图]+[很讲较不错好][一-龥]*/,
      /表[情达]+[很自然不错好][一-龥]*/,
      /氛[围感]+[很不错好][一-龥]*/,
    ];
    for (const pattern of positivePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        critiqueKeyword = "✓" + match[0].slice(0, 10);
        break;
      }
    }
  }

  // Build title
  if (style && critiqueKeyword && score) {
    return `${style} · ${critiqueKeyword} · ${score}分`;
  }
  if (style && score) {
    return `${style} · ${score}分`;
  }
  if (style && critiqueKeyword) {
    return `${style} · ${critiqueKeyword}`;
  }
  if (critiqueKeyword && score) {
    return `${critiqueKeyword} · ${score}分`;
  }
  if (score) {
    return `综合评分 ${score}分`;
  }

  // Fallback: find first meaningful sentence
  for (const line of lines) {
    const cleaned = line.replace(/\*\*/g, "").replace(/[#🔥📊💯（）()🎨📱📝📐✨🔧💡❌>]/g, "").trim();
    if (cleaned.length > 4 && cleaned.length < 30 && !line.startsWith("#") && !line.startsWith("---") && !line.startsWith("|") && !line.includes("评分") && !line.includes("Score")) {
      return cleaned.slice(0, 20);
    }
  }
  return lang === "zh" ? "照片点评" : "Photo Critique";
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
