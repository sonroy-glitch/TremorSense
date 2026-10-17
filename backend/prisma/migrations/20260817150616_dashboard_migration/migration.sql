-- CreateTable
CREATE TABLE "dashboard" (
    "id" TEXT NOT NULL,
    "fog_episodes_today" INTEGER,
    "avg_lead_time" DOUBLE PRECISION,
    "steps_today" BIGINT,
    "gait_stability" INTEGER,
    "cues_triggered" TEXT,
    "cane_id_dashboard" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_cane_id_dashboard_key" ON "dashboard"("cane_id_dashboard");

-- AddForeignKey
ALTER TABLE "dashboard" ADD CONSTRAINT "dashboard_cane_id_dashboard_fkey" FOREIGN KEY ("cane_id_dashboard") REFERENCES "user"("cane_id") ON DELETE RESTRICT ON UPDATE CASCADE;
