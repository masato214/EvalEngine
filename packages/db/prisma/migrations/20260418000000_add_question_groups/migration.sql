-- CreateEnum
CREATE TYPE "QuestionGroupType" AS ENUM ('FULL', 'COMPRESSED', 'BASELINE', 'DAILY', 'FINAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "question_groups" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupType" "QuestionGroupType" NOT NULL DEFAULT 'CUSTOM',
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_group_items" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "displayText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "block" TEXT,
    "shuffleGroup" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "contributionWeight" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_group_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "questionGroupId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "question_groups_modelId_name_key" ON "question_groups"("modelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "question_group_items_groupId_questionId_key" ON "question_group_items"("groupId", "questionId");

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "evaluation_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_group_items" ADD CONSTRAINT "question_group_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "question_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_group_items" ADD CONSTRAINT "question_group_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "question_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
