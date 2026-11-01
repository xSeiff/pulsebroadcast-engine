const storage = require("../database/storage");
const tokenService = require("./tokenService");
const errorTracker = require("../handlers/errorTracker");
const progressBar = require("../ui/progressBar");

/**
 * High-Performance Distributed Multi-Bot Broadcast Engine
 * Features:
 * - Sharded member distribution across all workers (parallel execution)
 * - Decoupled non-blocking UI update ticker (zero embed lag or 429 webhook limits)
 * - Detailed real-time console logging for every success, error, and rate-limit event
 * - Live Pause, Resume, and Cancel state machine
 * Made by xseif
 */

// Active broadcasts map: id -> BroadcastJob
const activeBroadcasts = new Map();

class BroadcastJob {
    constructor(options) {
        this.id = Date.now().toString();
        this.guildId = options.guildId;
        this.authorId = options.authorId;
        this.authorTag = options.authorTag;
        this.message = options.message;
        this.imageUrl = options.imageUrl ? options.imageUrl.trim() : null;
        this.targets = options.targets || [];
        this.totalTargets = this.targets.length;
        this.delayMs = options.delayMs || 1500;
        this.speedLabel = options.speedLabel || "Safe";
        this.selectedTokens = options.selectedTokens || null;
        this.updateCallback = options.updateCallback || null;

        this.status = "idle"; // idle, running, paused, cancelled, completed
        this.workers = [];
        this.startTime = 0;
        this.pausedAt = 0;
        this.totalPausedDuration = 0;
        
        this.successCount = 0;
        this.failureCount = 0;
        this.errorSummary = {
            dmsClosed: 0,
            blocked: 0,
            isBot: 0,
            rateLimited: 0,
            tokenInvalid: 0,
            other: 0
        };

        // Decoupled UI timer state
        this.uiTimer = null;
        this.isUiUpdating = false;
        this.uiUpdateInterval = 2500; // 2.5s safe interval for Discord webhook message edits
    }

    async start() {
        if (this.status === "running") return;
        this.status = "running";
        this.startTime = Date.now();
        activeBroadcasts.set(this.id, this);

        console.log(`\n======================================================`);
        console.log(`📢 [BROADCAST #${this.id}] STARTING`);
        console.log(`👤 Initiator: ${this.authorTag} (${this.authorId})`);
        console.log(`👥 Total Targets: ${this.totalTargets} members`);
        console.log(`⏱️ Speed Mode: ${this.speedLabel} (${this.delayMs}ms delay per bot)`);
        console.log(`======================================================`);

        // Record in database
        storage.broadcasts.create({
            id: this.id,
            guildId: this.guildId,
            authorId: this.authorId,
            authorTag: this.authorTag,
            message: this.message,
            speedMode: this.speedLabel,
            delayMs: this.delayMs,
            totalTargets: this.totalTargets
        });

        // Spin up worker clients
        console.log(`[BROADCAST #${this.id}] Initializing bot worker pool...`);
        this.workers = await tokenService.createWorkerPool(this.selectedTokens);

        if (this.workers.length === 0) {
            this.status = "cancelled";
            console.error(`❌ [BROADCAST #${this.id}] FAILED: No valid bot tokens available.`);
            await this.notifyUi(true, "❌ No valid bot tokens available in the Token Hub to execute broadcast.");
            return;
        }

        console.log(`✅ [BROADCAST #${this.id}] ${this.workers.length} active bot worker(s) online: ${this.workers.map(w => w.name).join(", ")}`);

        // Shard members evenly among workers
        const workerCount = this.workers.length;
        const shards = Array.from({ length: workerCount }, () => []);

        for (let i = 0; i < this.targets.length; i++) {
            shards[i % workerCount].push(this.targets[i]);
        }

        shards.forEach((shard, idx) => {
            console.log(`[SHARD ${idx + 1}] Worker "${this.workers[idx].name}" assigned ${shard.length} members.`);
        });

        // Start decoupled UI timer to update Discord embed smoothly without blocking workers
        this.startUiTicker();

        // Immediate first render
        await this.notifyUi(false);

        // Run worker loops concurrently
        const workerPromises = this.workers.map((worker, index) => {
            const assignedMembers = shards[index];
            return this.runWorkerShard(worker, assignedMembers, index + 1);
        });

        await Promise.all(workerPromises);

        // Stop UI timer
        this.stopUiTicker();

        // Cleanup workers
        console.log(`[BROADCAST #${this.id}] Cleaning up worker client connections...`);
        await tokenService.destroyWorkerPool(this.workers);
        this.workers = [];

        if (this.status !== "cancelled") {
            this.status = "completed";
        }

        const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`\n======================================================`);
        console.log(`🏁 [BROADCAST #${this.id}] ${this.status.toUpperCase()}`);
        console.log(`⏱️ Elapsed: ${elapsedSec}s`);
        console.log(`✅ Sent: ${this.successCount} / ${this.totalTargets}`);
        console.log(`❌ Failed: ${this.failureCount}`);
        console.log(`📊 Errors:`, this.errorSummary);
        console.log(`======================================================\n`);

        // Final database update
        storage.broadcasts.update(this.id, {
            status: this.status,
            successCount: this.successCount,
            failureCount: this.failureCount,
            errorSummary: this.errorSummary,
            completedAt: new Date().toISOString()
        });

        await this.notifyUi(true);
        activeBroadcasts.delete(this.id);
    }

    async runWorkerShard(worker, memberList, shardNum) {
        console.log(`🚀 [SHARD ${shardNum}] Starting worker "${worker.name}" (${memberList.length} members)...`);

        for (let i = 0; i < memberList.length; i++) {
            const member = memberList[i];

            // Handle Pause state
            while (this.status === "paused") {
                await new Promise(r => setTimeout(r, 1000));
            }

            // Handle Cancel state
            if (this.status === "cancelled") {
                console.log(`⏹️ [SHARD ${shardNum}] Worker "${worker.name}" stopped due to broadcast cancellation.`);
                break;
            }

            // If this worker is in rate limit backoff, wait
            if (worker.isRateLimited && Date.now() < worker.rateLimitReleaseAt) {
                const waitTime = worker.rateLimitReleaseAt - Date.now();
                console.warn(`⏳ [RATE-LIMIT] [${worker.name}] Waiting ${Math.ceil(waitTime / 1000)}s for rate limit release...`);
                await new Promise(r => setTimeout(r, Math.max(waitTime, 500)));
                worker.isRateLimited = false;
                console.log(`▶️ [RATE-LIMIT] [${worker.name}] Rate limit released. Resuming deliveries.`);
            }

            // Deliver DM
            const memberTag = member.user ? (member.user.tag || member.user.username) : member.id;
            try {
                const user = await worker.client.users.fetch(member.id);
                if (user.bot) {
                    this.failureCount++;
                    this.errorSummary.isBot++;
                    console.log(`🤖 [SKIP] [${worker.name}] Skipped bot account: @${user.tag} (${member.id})`);
                } else {
                    const finalContent = `${this.message.trim()}\n\n<@${user.id}>`;
                    const sendPayload = { content: finalContent };
                    if (this.imageUrl) sendPayload.files = [this.imageUrl];

                    try {
                        await user.send(sendPayload);
                    } catch (attachmentErr) {
                        // If Discord failed to download or attach file, fallback to text + URL
                        if (this.imageUrl) {
                            console.warn(`[IMAGE FALLBACK] [${worker.name}] Could not attach file directly, falling back to text with link.`);
                            await user.send(`${finalContent}\n${this.imageUrl}`);
                        } else {
                            throw attachmentErr;
                        }
                    }
                    this.successCount++;
                    console.log(`✅ [SENT] [${worker.name}] (${i + 1}/${memberList.length}) Delivered DM to @${user.tag} (${member.id}) [Mention: <@${user.id}>]${this.imageUrl ? " (with image)" : ""}`);
                }
            } catch (err) {
                this.failureCount++;
                const classified = errorTracker.classifyError(err, member.user);

                if (classified.category === errorTracker.ERROR_CATEGORIES.RATE_LIMITED) {
                    this.errorSummary.rateLimited++;
                    worker.isRateLimited = true;
                    const backoffMs = Math.max((classified.retryAfter || 2) * 1000, 2500);
                    worker.rateLimitReleaseAt = Date.now() + backoffMs;
                    console.warn(`⚠️ [RATE-LIMIT 429] [${worker.name}] Pausing worker for ${backoffMs}ms. Error: ${err.message}`);
                } else if (classified.category === errorTracker.ERROR_CATEGORIES.DMS_CLOSED) {
                    this.errorSummary.dmsClosed++;
                    console.warn(`🚫 [DMS CLOSED] [${worker.name}] Cannot DM @${memberTag} (${member.id}): Privacy settings disabled.`);
                } else if (classified.category === errorTracker.ERROR_CATEGORIES.BLOCKED) {
                    this.errorSummary.blocked++;
                    console.warn(`🛑 [BLOCKED] [${worker.name}] Cannot DM @${memberTag} (${member.id}): Blocked or no mutual server.`);
                } else if (classified.category === errorTracker.ERROR_CATEGORIES.TOKEN_INVALID) {
                    this.errorSummary.tokenInvalid++;
                    console.error(`❌ [TOKEN INVALID] [${worker.name}] Worker token invalidated or banned! Stopping this shard.`);
                    break;
                } else {
                    this.errorSummary.other++;
                    console.error(`❓ [ERROR] [${worker.name}] Failed to DM @${memberTag} (${member.id}): ${err.message} (Code: ${classified.code})`);
                }
            }

            // Respect configured per-bot delay
            await new Promise(r => setTimeout(r, this.delayMs));
        }

        console.log(`✨ [SHARD ${shardNum}] Worker "${worker.name}" completed all assigned members.`);
    }

    startUiTicker() {
        this.stopUiTicker();
        this.uiTimer = setInterval(async () => {
            if (this.isUiUpdating) return;
            if (this.status !== "running" && this.status !== "paused") {
                this.stopUiTicker();
                return;
            }
            this.isUiUpdating = true;
            try {
                await this.notifyUi(false);
            } catch (e) {
                // Ignore transient edit errors
            } finally {
                this.isUiUpdating = false;
            }
        }, this.uiUpdateInterval);
    }

    stopUiTicker() {
        if (this.uiTimer) {
            clearInterval(this.uiTimer);
            this.uiTimer = null;
        }
    }

    pause() {
        if (this.status === "running") {
            this.status = "paused";
            this.pausedAt = Date.now();
            console.log(`⏸️ [BROADCAST #${this.id}] Paused by operator.`);
            this.notifyUi(false);
            return true;
        }
        return false;
    }

    resume() {
        if (this.status === "paused") {
            this.status = "running";
            if (this.pausedAt > 0) {
                this.totalPausedDuration += (Date.now() - this.pausedAt);
                this.pausedAt = 0;
            }
            console.log(`▶️ [BROADCAST #${this.id}] Resumed by operator.`);
            this.notifyUi(false);
            return true;
        }
        return false;
    }

    async cancel() {
        if (this.status === "running" || this.status === "paused") {
            this.status = "cancelled";
            this.stopUiTicker();
            console.log(`⏹️ [BROADCAST #${this.id}] Cancelled by operator.`);
            await tokenService.destroyWorkerPool(this.workers);
            await this.notifyUi(true);
            return true;
        }
        return false;
    }

    getStateSnapshot() {
        const processed = this.successCount + this.failureCount;
        const effectiveStartTime = this.startTime + this.totalPausedDuration;
        const metrics = progressBar.calculateMetrics(
            processed,
            this.totalTargets,
            effectiveStartTime,
            this.status === "completed" || this.status === "cancelled"
        );

        return {
            id: this.id,
            status: this.status,
            total: this.totalTargets,
            processed,
            success: this.successCount,
            failure: this.failureCount,
            workerCount: this.workers.length,
            delayMs: this.delayMs,
            speedLabel: this.speedLabel,
            metrics,
            progressBar: progressBar.renderProgressBar(processed, this.totalTargets),
            errorSummary: this.errorSummary
        };
    }

    async notifyUi(force = false, customNote = null) {
        if (!this.updateCallback) return;
        const state = this.getStateSnapshot();
        try {
            await this.updateCallback(state, force, customNote);
        } catch (err) {
            // Ignore minor Discord webhook rate-limit race conditions
        }
    }
}

function getActiveBroadcast(id) {
    return activeBroadcasts.get(id);
}

function hasRunningBroadcast() {
    for (const job of activeBroadcasts.values()) {
        if (job.status === "running" || job.status === "paused") {
            return true;
        }
    }
    return false;
}

module.exports = {
    BroadcastJob,
    getActiveBroadcast,
    hasRunningBroadcast,
    activeBroadcasts
};
