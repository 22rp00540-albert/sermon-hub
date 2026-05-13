-- CreateTable
CREATE TABLE `SermonDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sermonId` INTEGER NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SermonDocument` ADD CONSTRAINT `SermonDocument_sermonId_fkey` FOREIGN KEY (`sermonId`) REFERENCES `Sermon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
