import { useLanguage } from "@/contexts/LanguageContext";
import { useHistory } from "@/hooks/useHistory";
import { Trash2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const History = () => {
  const { t } = useLanguage();
  const { records, deleteRecord } = useHistory();

  return (
    <div className="min-h-screen pt-14 px-4 pb-8">
      <div className="max-w-3xl mx-auto">
        <div className="py-8 text-center">
          <h1 className="text-3xl font-bold text-gradient-gold mb-2">
            {t("历史记录", "History")}
          </h1>
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mt-3">
            <AlertTriangle className="w-3 h-3" />
            <span>
              {t("历史记录仅保存最近7天，超期自动清除", "Records are kept for 7 days only, then auto-deleted")}
            </span>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {t("暂无历史记录", "No history yet")}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {t("上传一张照片开始你的第一次锐评", "Upload a photo to start your first critique")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="glass-card-hover p-4 flex items-start gap-4">
                <img
                  src={record.imageData}
                  alt="Photo"
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{record.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-primary font-semibold">{record.score}/100</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteRecord(record.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
