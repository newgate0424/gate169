/*
  Warnings:

  - You are about to drop the column `facebookAccessToken` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `user` DROP COLUMN `facebookAccessToken`,
    ADD COLUMN `facebookAdToken` TEXT NULL,
    ADD COLUMN `facebookPageToken` TEXT NULL;
