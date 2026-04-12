-- CreateTable
CREATE TABLE "question_criteria" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "embedding" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "output_formats" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "outputType" TEXT NOT NULL DEFAULT 'TYPE_CLASSIFICATION',
    "config" JSONB NOT NULL DEFAULT '{}',
    "promptTemplate" TEXT,
    "axisWeights" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "output_formats_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "outputFormatIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "question_criteria_questionId_level_key" ON "question_criteria"("questionId", "level");

-- AddForeignKey
ALTER TABLE "question_criteria" ADD CONSTRAINT "question_criteria_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_formats" ADD CONSTRAINT "output_formats_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "evaluation_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
