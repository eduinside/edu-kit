import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  align?: "center" | "top"; // top: 상단 고정(검색 — 결과가 아래로 확장)
  maxWidth?: number; // 기본 780

  children: ReactNode;
}

/** 접근성 모달: scrim, Esc 닫기, 포커스 진입/복귀, 기본 Tab 트랩. */
export default function Modal({ open, onClose, labelledBy, align = "center", maxWidth = 780, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  // onClose는 부르는 쪽이 렌더마다 새로 만들 수 있다(모음 만들기 창). 효과가 그것에 기대면
  // 글자를 칠 때마다 포커스를 되돌렸다가 첫 단추로 옮겨 입력이 끊겼다(2026-10-03 운영 신고) — 열릴 때 한 번만 돈다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    const el = ref.current;
    const SEL = 'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    el?.querySelector<HTMLElement>(SEL)?.focus();

    function onKey(e: KeyboardEvent) {
      // 내용이 바뀌어도(단추 활성·안내 줄) 지금 있는 것으로 가둔다
      const focusable = el?.querySelectorAll<HTMLElement>(SEL);
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab" && focusable && focusable.length) {
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(15,23,42,.42)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: align === "top" ? "flex-start" : "center",
        justifyContent: "center",
        padding: align === "top" ? "8vh 24px 24px" : 28,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="sk-scroll"
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(15,23,42,.28)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
