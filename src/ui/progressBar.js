/**
 * Overhauled Progress Bar & Metric Estimator for Discord Broadcast Bot v3
 * Made by xseif
 */

function formatDuration(ms) {
    if (!ms || isNaN(ms) || ms < 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}

function renderProgressBar(current, total, length = 18) {
    if (!total || total <= 0) return "`" + "░".repeat(length) + "` 0.0%";
    const clampedCurrent = Math.min(Math.max(current, 0), total);
    const ratio = clampedCurrent / total;
    const filledBlocks = Math.round(ratio * length);
    const emptyBlocks = Math.max(0, length - filledBlocks);

    const percentage = (ratio * 100).toFixed(1);
    const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
    return `\`${bar}\` **${percentage}%**`;
}

function calculateMetrics(current, total, startTime, isCompleted = false) {
    const now = Date.now();
    const elapsedMs = Math.max(now - startTime, 1000);
    const elapsedStr = formatDuration(elapsedMs);

    const speedPerSec = (current / (elapsedMs / 1000));
    const speedStr = speedPerSec >= 10 ? speedPerSec.toFixed(1) : speedPerSec.toFixed(2);

    let etaStr = "Calculating...";
    if (isCompleted || current >= total) {
        etaStr = "00:00";
    } else if (speedPerSec > 0.01) {
        const remaining = total - current;
        const etaMs = (remaining / speedPerSec) * 1000;
        etaStr = formatDuration(etaMs);
    } else {
        etaStr = "Unknown";
    }

    return {
        elapsed: elapsedStr,
        eta: etaStr,
        speed: `${speedStr} DMs/s`
    };
}

module.exports = {
    renderProgressBar,
    calculateMetrics,
    formatDuration
};
