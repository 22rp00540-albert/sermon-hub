-- CreateTable
CREATE TABLE `AppSettings` (
    `id` INTEGER NOT NULL,
    `memberVideoSermonsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AppSettings` (`id`, `memberVideoSermonsEnabled`, `updatedAt`) VALUES (1, false, CURRENT_TIMESTAMP(3));
