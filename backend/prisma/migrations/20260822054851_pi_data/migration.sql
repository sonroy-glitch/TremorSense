/*
  Warnings:

  - You are about to drop the column `cane_id_dashboard` on the `dashboard` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `dashboard` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `dashboard` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "dashboard" DROP CONSTRAINT "dashboard_cane_id_dashboard_fkey";

-- DropIndex
DROP INDEX "dashboard_cane_id_dashboard_key";

-- AlterTable
ALTER TABLE "dashboard" DROP COLUMN "cane_id_dashboard",
ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "piData" (
    "id" TEXT NOT NULL,
    "predicted_event" INTEGER,
    "event_time" TEXT,
    "cues_triggered_inrealtime" TEXT,
    "pi_cane_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "piData_pi_cane_id_key" ON "piData"("pi_cane_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_user_id_key" ON "dashboard"("user_id");

-- AddForeignKey
ALTER TABLE "dashboard" ADD CONSTRAINT "dashboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piData" ADD CONSTRAINT "piData_pi_cane_id_fkey" FOREIGN KEY ("pi_cane_id") REFERENCES "user"("cane_id") ON DELETE RESTRICT ON UPDATE CASCADE;
