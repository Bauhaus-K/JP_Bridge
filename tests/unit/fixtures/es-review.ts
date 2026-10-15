export const sampleReview = {
  overall_comment_ko: "결론이 명확합니다.",
  scores: {
    structure: { score: 4, comment_ko: "a" },
    specificity: { score: 3, comment_ko: "b" },
    naturalness: { score: 4, comment_ko: "c" },
    company_fit: { score: 2, comment_ko: "d" },
  },
  revised_text_ja: "私の強みは粘り強さです。",
  changes: [
    {
      before_ja: "私は頑張ります。",
      after_ja: "私の強みは粘り強さです。",
      reason_ko: "결론 우선",
      category: "structure",
    },
  ],
  questions_ko: ["구체적인 수치가 있나요?"],
};
