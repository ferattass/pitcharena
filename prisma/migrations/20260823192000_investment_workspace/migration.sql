-- Data Room kanıtları ve kurucu stres testi cevapları.
CREATE TABLE "AnalysisEvidence" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FounderChallenge" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "FounderChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalysisEvidence_analysisId_createdAt_idx" ON "AnalysisEvidence"("analysisId", "createdAt");
CREATE INDEX "FounderChallenge_analysisId_createdAt_idx" ON "FounderChallenge"("analysisId", "createdAt");

ALTER TABLE "AnalysisEvidence" ADD CONSTRAINT "AnalysisEvidence_analysisId_fkey"
  FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FounderChallenge" ADD CONSTRAINT "FounderChallenge_analysisId_fkey"
  FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
