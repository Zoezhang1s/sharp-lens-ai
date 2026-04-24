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

  let style = "";
  for (const line of lines) {
    if (line.includes("当前风格") || line.includes("Current Style")) {
      const cleaned = line.replace(/\*\*/g, "").replace(/当前风格[:\s]*/g, "").replace(/Current Style[:\s]*/g, "").trim();
      if (cleaned.length > 1 && cleaned.length < 30) {
        style = cleaned;
        break;
      }
    }
  }

  const scoreMatch = text.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
  const score = scoreMatch ? scoreMatch[1] : "";

  if (style && score) {
    return lang === "zh" ? `${style} · ${score}分` : `${style} · ${score}pts`;
  }
  if (style) return style;

  for (const line of lines) {
    if (line.includes("构图") || line.includes("Composition") || line.includes("姿势") || line.includes("Pose")) {
      continue;
    }
    const cleaned = line.replace(/\*\*/g, "").replace(/[#🔥📊💯（）()🎨📱📝📐✨🔧💡❌>]/g, "").trim();
    if (cleaned.length > 4 && cleaned.length < 30 && !line.startsWith("#") && !line.startsWith("---") && !line.startsWith("|")) {
      return score ? `${cleaned.slice(0, 20)} · ${score}${lang === "zh" ? "分" : "pts"}` : cleaned.slice(0, 25);
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
