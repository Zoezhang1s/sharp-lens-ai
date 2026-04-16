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
  // Match patterns like "评分: 65/100", "Score: 72/100", "💯 评分: 45/100"
  const match = text.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function generateTitle(text: string, lang: string): string {
  const lines = text.split("\n");

  // Try to extract style name as the core subject
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

  // Extract score
  const scoreMatch = text.match(/(?:评分|Score)[:\s]*(\d{1,3})\s*\/\s*100/i);
  const score = scoreMatch ? scoreMatch[1] : "";

  // Build concise descriptive title: "日系小清新 · 62分" or "Korean Minimal · 62pts"
  if (style && score) {
    return lang === "zh" ? `${style} · ${score}分` : `${style} · ${score}pts`;
  }
  if (style) return style;

  // Fallback: try to find a subject description from the critique
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const addRecord = useCallback((record: Omit<HistoryRecord, "id" | "timestamp">) => {
    const newRecord: HistoryRecord = {
      ...record,
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
