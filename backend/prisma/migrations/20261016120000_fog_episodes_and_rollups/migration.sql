-- The `dashboard` table was never written to by any code path, and `piData`
-- could not represent an episode (no duration, no confidence, and an unused
-- `cues_triggered_inrealtime` column for cue hardware that does not exist).
-- Both are replaced by `fog_episode` + `gait_rollup`.

-- DropForeignKey
ALTER TABLE "dashboard" DROP CONSTRAINT IF EXISTS "dashboard_user_id_fkey";

-- DropForeignKey
ALTER TABLE "piData" DROP CONSTRAINT IF EXISTS "piData_pi_cane_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "dashboard";

-- DropTable
DROP TABLE IF EXISTS "piData";

-- CreateTable
CREATE TABLE "fog_episode" (
    "id" TEXT NOT NULL,
    "cane_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "window_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fog_episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gait_rollup" (
    "id" TEXT NOT NULL,
    "cane_id" TEXT NOT NULL,
    "hour_start" TIMESTAMP(3) NOT NULL,
    "normal_ms" INTEGER NOT NULL DEFAULT 0,
    "freeze_ms" INTEGER NOT NULL DEFAULT 0,
    "episode_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gait_rollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fog_episode_cane_id_started_at_idx" ON "fog_episode"("cane_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "fog_episode_cane_id_started_at_key" ON "fog_episode"("cane_id", "started_at");

-- CreateIndex
CREATE INDEX "gait_rollup_cane_id_hour_start_idx" ON "gait_rollup"("cane_id", "hour_start");

-- CreateIndex
CREATE UNIQUE INDEX "gait_rollup_cane_id_hour_start_key" ON "gait_rollup"("cane_id", "hour_start");

-- AddForeignKey
ALTER TABLE "fog_episode" ADD CONSTRAINT "fog_episode_cane_id_fkey" FOREIGN KEY ("cane_id") REFERENCES "user"("cane_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gait_rollup" ADD CONSTRAINT "gait_rollup_cane_id_fkey" FOREIGN KEY ("cane_id") REFERENCES "user"("cane_id") ON DELETE CASCADE ON UPDATE CASCADE;
