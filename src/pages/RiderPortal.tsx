// ─────────────────────────────────────────────────────────────────────────────
// RiderPortal.tsx — Britium Express Rider / Deliveryman Portal
// Task list, delivery completion, POD upload, COD collection, failure logging
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef } from "react";
import {
  useRiderTasks,
  useRiderWallet,
  useCompleteDelivery,
  useFailDelivery,
  useUploadPod,
} from "../hooks/useApi";
import { useAuth } from "../contexts/AuthContext";
import { StatusPill } from "../components/PortalLayout";
import type { RiderTask, FailureReason } from "../types";

// ── Alias for internal naming convention ────────────────────────────────────
const useMyTasks = useRiderTasks;

// ── Colour helpers ────────────────────────────────────────────────────────────
const FAILURE_LABELS: Record<FailureReason, string> = {
  recipient_not_available: "Recipient Not Available",
  address_not_found:       "Address Not Found",
  recipient_refused:       "Recipient Refused",
  cod_dispute:             "COD Amount Dispute",
  access_blocked:          "Access Blocked",
  damaged:                 "Parcel Damaged",
  other:                   "Other",
};

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onComplete,
  onFail,
}: {
  task: RiderTask;
  onComplete: (task: RiderTask) => void;
  onFail: (task: RiderTask) => void;
}) {
  const isDone    = task.status === "delivered";
  const isFailed  = task.status === "failed";
  const isActive  = task.status === "in_progress";

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${isDone ? "#d1fae5" : isFailed ? "#fecaca" : "#e2e8f0"}`,
        borderLeft: `4px solid ${isDone ? "#059669" : isFailed ? "#dc2626" : isActive ? "#1a56db" : "#94a3b8"}`,
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ background: "#f1f5f9", color: "#475569", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, marginRight: 8 }}>
            #{task.sequence}
          </span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>{task.tracking_no}</span>
        </div>
        <StatusPill status={task.status} />
      </div>

      {/* Receiver */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{task.receiver_name}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{task.receiver_phone}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>📍 {task.receiver_address}, {task.receiver_township}</div>
      </div>

      {/* COD badge */}
      {task.cod_amount > 0 && (
        <div style={{ display: "inline-block", background: "#fff8ed", border: "1px solid #fbbf24", color: "#92400e", padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
          💰 Collect MMK {task.cod_amount.toLocaleString()}
        </div>
      )}

      {task.notes && (
        <div style={{ fontSize: 12, color: "#7c3aed", background: "#f5f3ff", padding: "5px 10px", borderRadius: 6, marginBottom: 10 }}>
          📝 {task.notes}
        </div>
      )}

      {/* Actions */}
      {(task.status === "assigned" || task.status === "in_progress") && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => onComplete(task)}
            style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            ✅ Mark Delivered
          </button>
          <button
            onClick={() => onFail(task)}
            style={{ background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            ❌ Failed Attempt
          </button>
        </div>
      )}
    </div>
  );
}

// ── Complete Delivery Modal ────────────────────────────────────────────────────
function CompleteModal({
  task,
  onClose,
}: {
  task: RiderTask;
  onClose: () => void;
}) {
  const complete = useCompleteDelivery();
  const uploadPod = useUploadPod();
  const [codCollected, setCodCollected] = useState(task.cod_amount);
  const [notes, setNotes] = useState("");
  const [podUrl, setPodUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("task_id", task.id);
    const res = await uploadPod.mutateAsync(fd);
    setPodUrl((res as any).url);
    setUploading(false);
  };

  const handleSubmit = () => {
    complete.mutate({ task_id: task.id, cod_collected: codCollected, pod_photo_url: podUrl, notes });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>✅ Mark as Delivered</h3>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>{task.tracking_no} → {task.receiver_name}</div>

        {task.cod_amount > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
              COD Collected (MMK)
            </label>
            <input
              type="number"
              value={codCollected}
              onChange={(e) => setCodCollected(Number(e.target.value))}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 14, fontWeight: 700, width: "100%", fontFamily: "inherit" }}
            />
            {codCollected !== task.cod_amount && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#dc2626" }}>
                ⚠️ Expected MMK {task.cod_amount.toLocaleString()} — confirm with supervisor.
              </div>
            )}
          </div>
        )}

        {/* POD photo */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
            Proof of Delivery (Photo / Signature)
          </label>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: "none" }} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: "#f8fafc", border: "1px dashed #94a3b8", borderRadius: 8, padding: "12px 20px", fontSize: 13, cursor: "pointer", width: "100%", fontFamily: "inherit", color: "#475569" }}
          >
            {uploading ? "⏳ Uploading…" : podUrl ? "✅ Photo uploaded — tap to replace" : "📷 Take / Upload Photo"}
          </button>
          {podUrl && <img src={podUrl} alt="POD preview" style={{ marginTop: 8, width: "100%", borderRadius: 8, maxHeight: 200, objectFit: "cover" }} />}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", fontFamily: "inherit", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSubmit} disabled={complete.isPending}
            style={{ flex: 1, background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {complete.isPending ? "Saving…" : "Confirm Delivered"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "11px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#64748b" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Failure Modal ─────────────────────────────────────────────────────────────
function FailModal({ task, onClose }: { task: RiderTask; onClose: () => void }) {
  const fail = useFailDelivery();
  const [reason, setReason] = useState<FailureReason>("recipient_not_available");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    fail.mutate({ task_id: task.id, failure_reason: reason, notes });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>❌ Failed Delivery Attempt</h3>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>{task.tracking_no} → {task.receiver_name}</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Failure Reason</label>
          {(Object.keys(FAILURE_LABELS) as FailureReason[]).map((r) => (
            <label key={r} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
              <span style={{ fontSize: 13 }}>{FAILURE_LABELS[r]}</span>
            </label>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>Additional Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Gate locked, no response to calls…"
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", fontFamily: "inherit", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSubmit} disabled={fail.isPending}
            style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {fail.isPending ? "Saving…" : "Submit Failure"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "11px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#64748b" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Portal ───────────────────────────────────────────────────────────────
export default function RiderPortal() {
  const { user, logout } = useAuth();
  const { data: tasks, isLoading, error } = useMyTasks();
  const { data: wallet } = useRiderWallet();
  const taskList = (tasks as RiderTask[] | undefined) ?? [];

  const [completeTask, setCompleteTask] = useState<RiderTask | null>(null);
  const [failTask, setFailTask] = useState<RiderTask | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const filtered = taskList.filter((t) => {
    if (filter === "pending") return t.status === "assigned" || t.status === "in_progress";
    if (filter === "done") return t.status === "delivered" || t.status === "failed";
    return true;
  });

  const walletData = wallet as { balance?: number; pending_cod?: number; today_deliveries?: number; today_failed?: number } | undefined;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#0f172a", color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>🛵 Britium Express</div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 1 }}>Rider App · {user?.full_name}</div>
        </div>
        <button onClick={logout}
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Sign Out
        </button>
      </header>

      {/* Wallet strip */}
      {walletData && (
        <div style={{ background: "#1e3a8a", color: "#fff", padding: "12px 20px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>MMK {(walletData.balance ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 10, opacity: 0.65 }}>Wallet Balance</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>MMK {(walletData.pending_cod ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 10, opacity: 0.65 }}>Pending COD</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>{walletData.today_deliveries ?? 0}</div>
            <div style={{ fontSize: 10, opacity: 0.65 }}>Delivered Today</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f87171" }}>{walletData.today_failed ?? 0}</div>
            <div style={{ fontSize: 10, opacity: 0.65 }}>Failed Today</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 20px", display: "flex", gap: 4 }}>
        {(["all", "pending", "done"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              background: "none", border: "none",
              borderBottom: filter === f ? "3px solid #1a56db" : "3px solid transparent",
              padding: "13px 16px", fontSize: 13,
              fontWeight: filter === f ? 700 : 500,
              color: filter === f ? "#1a56db" : "#64748b",
              cursor: "pointer", fontFamily: "inherit",
            }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && (
              <span style={{ marginLeft: 6, background: "#1a56db", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>
                {taskList.filter((t) => t.status === "assigned" || t.status === "in_progress").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 60px" }}>
        {isLoading && <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>⏳ Loading tasks…</div>}
        {error && <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", margin: 8 }}>❌ Failed to load tasks.</div>}
        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            {filter === "pending" ? "🎉 All deliveries complete!" : "No tasks."}
          </div>
        )}
        {filtered
          .sort((a, b) => a.sequence - b.sequence)
          .map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => setCompleteTask(task)}
              onFail={() => setFailTask(task)}
            />
          ))}
      </main>

      {/* Modals */}
      {completeTask && <CompleteModal task={completeTask} onClose={() => setCompleteTask(null)} />}
      {failTask && <FailModal task={failTask} onClose={() => setFailTask(null)} />}
    </div>
  );
}
