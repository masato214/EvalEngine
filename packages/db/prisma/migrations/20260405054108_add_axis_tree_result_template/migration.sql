-- AlterTable
ALTER TABLE "axes" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "results" ADD COLUMN     "resultType" TEXT,
ADD COLUMN     "typeDetails" JSONB;

-- CreateTable
CREATE TABLE "result_templates" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outputType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "config" JSONB NOT NULL DEFAULT '{}',
    "promptTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "result_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "result_templates_modelId_key" ON "result_templates"("modelId");

-- AddForeignKey
ALTER TABLE "result_templates" ADD CONSTRAINT "result_templates_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "evaluation_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axes" ADD CONSTRAINT "axes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "axes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
