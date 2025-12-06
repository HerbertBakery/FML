/*
  Warnings:

  - A unique constraint covering the columns `[templateCode,editionType,serialNumber]` on the table `UserMonster` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserMonster_templateCode_editionType_serialNumber_key" ON "UserMonster"("templateCode", "editionType", "serialNumber");
