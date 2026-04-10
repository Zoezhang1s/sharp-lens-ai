import { useState, useEffect, useCallback } from "react";

export interface HistoryRecord {
  id: string;
  imageData: string; // base64 thumbnail
  summary: string;
  score: number;
  timestamp: number;
  messages: Array<{ role: string; content: string }>;
}

const STORAGE_KEY = "photo-critique-history";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function loadRecords(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const records: HistoryRecord[] = JSON.parse(raw);
    const cutoff = Date.now() - SEVEN_DAYS;
    return records.filter((r) => r.timestamp > cutoff);
  } catch {
    return [];
  }
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

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRecord = useCallback(
    (id: string) => records.find((r) => r.id === id) ?? null,
    [records]
  );

  return { records, addRecord, deleteRecord, getRecord };
}
