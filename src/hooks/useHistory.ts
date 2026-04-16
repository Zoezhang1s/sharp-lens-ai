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
  // Extract the opening roast line as a theme-based title
  const lines = text.split("\n");
  let foundRoast = false;
  for (const line of lines) {
    // Look for the line after "一句话暴击" or "Opening Roast"
    if (line.includes("一句话暴击") || line.includes("Opening Roast")) {
      foundRoast = true;
      continue;
    }
    if (foundRoast) {
      const cleaned = line.replace(/\*\*/g, "").replace(/[#🔥📊💯（）()]/g, "").trim();
      if (cleaned.length > 3 && cleaned.length < 80) {
        return cleaned.slice(0, 40);
      }
    }
  }
  // Fallback: first meaningful content line
  for (const line of lines) {
    const cleaned = line.replace(/\*\*/g, "").replace(/[#🔥📊💯]/g, "").trim();
    if (cleaned.length > 5 && cleaned.length < 80 && !line.startsWith("#") && !line.startsWith("---") && !line.startsWith(">")) {
      return cleaned.slice(0, 40);
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
