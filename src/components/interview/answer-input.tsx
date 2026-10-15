"use client";

import { cn } from "@/lib/utils";
import { controlClass } from "@/components/ui/input";

/**
 * 답변 입력. 현재는 텍스트만 지원한다.
 * 음성 입력(M9 이후)은 mode="voice" 로 같은 인터페이스(value/onChange)를 구현해 교체한다.
 */
export function AnswerInput({
  mode = "text",
  value,
  onChange,
  disabled,
  id,
}: {
  mode?: "text" | "voice";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id: string;
}) {
  if (mode !== "text") {
    return <p className="text-sm text-muted-foreground">음성 답변은 아직 지원하지 않습니다.</p>;
  }
  return (
    <textarea
      id={id}
      lang="ja"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={7}
      maxLength={2000}
      disabled={disabled}
      placeholder="面接で話すつもりで、日本語で答えてみましょう。"
      className={cn(controlClass, "py-3 leading-7")}
    />
  );
}
