-- CreateTable
CREATE TABLE `VideoListeningSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `videoSermonId` INTEGER NOT NULL,
    `progressSeconds` INTEGER NOT NULL DEFAULT 0,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VideoListeningSession_userId_videoSermonId_key`(`userId`, `videoSermonId`),
    INDEX `VideoListeningSession_videoSermonId_fkey`(`videoSermonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VideoListeningSession` ADD CONSTRAINT `VideoListeningSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoListeningSession` ADD CONSTRAINT `VideoListeningSession_videoSermonId_fkey` FOREIGN KEY (`videoSermonId`) REFERENCES `VideoSermon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
