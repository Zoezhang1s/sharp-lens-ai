import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useHistory } from "@/hooks/useHistory";
import { Trash2, Clock, AlertTriangle, MessageCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const History = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { records, deleteRecord } = useHistory();

  const handleClickRecord = (record: any) => {
    // If score is 0, it means critique is in progress or failed
    // Store the historyId in sessionStorage and navigate to critique page
    if (record.score === 0) {
      sessionStorage.setItem("critique-in-progress", JSON.stringify({
        imageData: record.imageData,
        messages: record.messages,
        historyId: record.id,
      }));
    }
    navigate(`/critique?history=${record.id}`);
  };

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
              {t("历史记录保存最近30天，超期自动清除", "Records are kept for 30 days, then auto-deleted")}
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
            {records.map((record) => {
              const isInProgress = record.score === 0;
              const hasNoResponse = !record.messages.some((m: any) => m.role === "assistant");

              return (
                <div
                  key={record.id}
                  className={`glass-card-hover p-4 flex items-start gap-4 cursor-pointer ${isInProgress ? "border-primary/30" : ""}`}
                  onClick={() => handleClickRecord(record)}
                >
                  <img
                    src={record.imageData}
                    alt="Photo"
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{record.title}</p>
                      {isInProgress && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                          {hasNoResponse ? t("进行中", "In Progress") : t("失败", "Failed")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{record.summary}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {isInProgress ? (
                        <>
                          {hasNoResponse ? (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {t("等待AI点评...", "Waiting for AI...")}
                            </span>
                          ) : (
                            <span className="text-xs text-destructive flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" />
                              {t("点击重试", "Click to retry")}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-primary font-semibold">{record.score}/100</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {record.messages.length}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRecord(record.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;