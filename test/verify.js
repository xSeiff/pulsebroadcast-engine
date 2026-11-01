/**
 * Test & Verification Suite for Discord Broadcast Bot v3
 * Made by xseif
 */

const assert = require("assert");
const path = require("path");

console.log("==========================================");
console.log("🧪 Running Broadcast Bot v3 Verification");
console.log("==========================================");

// 1. Verify Storage & Database Operations
console.log("\n[Test 1] Verifying Storage & Atomic Writes...");
const storage = require("../src/database/storage");
storage.initialize();

const initialSettings = storage.settings.get();
assert(Array.isArray(initialSettings.adminRoles), "adminRoles should be an array");
assert(Array.isArray(initialSettings.adminUserIds), "adminUserIds should be an array");
assert(typeof initialSettings.defaultSpeed === "string", "defaultSpeed should be string");

// Test Token Store
const testToken = {
    id: "999888777666",
    username: "TestWorkerBot",
    tag: "TestWorkerBot#1234"
};
storage.tokens.add("mock_token_string_12345", testToken);
let savedToken = storage.tokens.getById("999888777666");
assert(savedToken !== undefined, "Token should be saved");
assert.strictEqual(savedToken.username, "TestWorkerBot");

storage.tokens.updateStatus("999888777666", "ready");
savedToken = storage.tokens.getById("999888777666");
assert.strictEqual(savedToken.status, "ready");

// Cleanup test token
storage.tokens.remove("999888777666");
assert.strictEqual(storage.tokens.getById("999888777666"), undefined);
console.log("✅ Storage engine passed.");

// 2. Verify Error Classifier
console.log("\n[Test 2] Verifying Error Classifier & Taxonomy...");
const errorTracker = require("../src/handlers/errorTracker");

const err50007 = errorTracker.classifyError({ code: 50007 });
assert.strictEqual(err50007.category, errorTracker.ERROR_CATEGORIES.DMS_CLOSED);

const err429 = errorTracker.classifyError({ status: 429, retryAfter: 3.5 });
assert.strictEqual(err429.category, errorTracker.ERROR_CATEGORIES.RATE_LIMITED);

const botTargetErr = errorTracker.classifyError(null, { bot: true });
assert.strictEqual(botTargetErr.category, errorTracker.ERROR_CATEGORIES.IS_BOT);

const summaryText = errorTracker.formatErrorSummary({
    dmsClosed: 5,
    blocked: 1,
    isBot: 3,
    rateLimited: 2,
    tokenInvalid: 0,
    other: 0
});
assert(summaryText.includes("5"), "Summary should include dmsClosed count");
console.log("✅ Error classification passed.");

// 3. Verify Progress Bar & Metric Estimator
console.log("\n[Test 3] Verifying Progress Bar & Calculations...");
const progressBar = require("../src/ui/progressBar");

const barEmpty = progressBar.renderProgressBar(0, 100);
assert(barEmpty.includes("0.0%"), "Empty bar should report 0.0%");

const barHalf = progressBar.renderProgressBar(50, 100);
assert(barHalf.includes("50.0%"), "Half bar should report 50.0%");

const barFull = progressBar.renderProgressBar(100, 100);
assert(barFull.includes("100.0%"), "Full bar should report 100.0%");

const metrics = progressBar.calculateMetrics(50, 100, Date.now() - 5000);
assert(metrics.elapsed !== undefined, "Elapsed metric should be present");
assert(metrics.speed !== undefined, "Speed metric should be present");
assert(metrics.eta !== undefined, "ETA metric should be present");
console.log("✅ Progress bar engine passed.");

// 4. Verify Target Filtering Service (No-Roles, Roles, Bots)
console.log("\n[Test 4] Verifying Target Filter (No-Roles, Whitelist, Blacklist)...");
const filterService = require("../src/services/filterService");

// Create mock guild
const mockGuild = {
    id: "guild_123",
    members: {
        fetch: async () => mockGuild.members.cache,
        cache: new Map([
            // Member 1: Has role A
            ["user_1", {
                id: "user_1",
                user: { bot: false },
                roles: { cache: new Map([["guild_123", {}], ["role_A", {}]]) }
            }],
            // Member 2: Has role B
            ["user_2", {
                id: "user_2",
                user: { bot: false },
                roles: { cache: new Map([["guild_123", {}], ["role_B", {}]]) }
            }],
            // Member 3: Has NO roles (only @everyone / guild_123)
            ["user_3", {
                id: "user_3",
                user: { bot: false },
                roles: { cache: new Map([["guild_123", {}]]) }
            }],
            // Member 4: Is a BOT
            ["user_4", {
                id: "user_4",
                user: { bot: true },
                roles: { cache: new Map([["guild_123", {}], ["role_bot", {}]]) }
            }]
        ])
    }
};

(async () => {
    // Mode: All Members (excluding bots)
    const resAll = await filterService.resolveTargetMembers(mockGuild, {
        targetMode: "all",
        excludeBots: true
    });
    assert.strictEqual(resAll.members.length, 3, "All humans should be 3");

    // Mode: No Roles
    const resNoRoles = await filterService.resolveTargetMembers(mockGuild, {
        targetMode: "no_roles",
        excludeBots: true
    });
    assert.strictEqual(resNoRoles.members.length, 1, "Only user_3 has no roles");
    assert.strictEqual(resNoRoles.members[0].id, "user_3");

    // Mode: Whitelist role A
    const resWhitelist = await filterService.resolveTargetMembers(mockGuild, {
        targetMode: "whitelist_roles",
        roleIds: ["role_A"],
        excludeBots: true
    });
    assert.strictEqual(resWhitelist.members.length, 1, "Only user_1 has role A");
    assert.strictEqual(resWhitelist.members[0].id, "user_1");

    // Mode: Blacklist role A
    const resBlacklist = await filterService.resolveTargetMembers(mockGuild, {
        targetMode: "blacklist_roles",
        roleIds: ["role_A"],
        excludeBots: true
    });
    assert.strictEqual(resBlacklist.members.length, 2, "user_2 and user_3 should remain");
    console.log("✅ Target filtering passed (including No-Roles mode).");

    // 5. Verify Permissions Service (Strict Bot Owner Model)
    console.log("\n[Test 5] Verifying Permissions & Access Control (Bot Owner Model)...");
    const permissionService = require("../src/services/permissionService");

    // Bot Owner ID: 938056009459576882
    const mockBotOwner = {
        guild: { ownerId: "other_user" },
        user: { id: "938056009459576882" },
        member: { permissions: { has: () => false } }
    };
    assert(permissionService.isAuthorized(mockBotOwner), "Bot Owner must ALWAYS be authorized");
    assert(permissionService.canManagePermissions(mockBotOwner), "Bot Owner must be able to manage permissions");

    // Server Owner should NOT be authorized by default
    const mockServerOwner = {
        guild: { ownerId: "server_owner_999" },
        user: { id: "server_owner_999" },
        member: { permissions: { has: () => false } }
    };
    assert(!permissionService.isAuthorized(mockServerOwner), "Server Owner must NOT have default authorization");
    assert(!permissionService.canManagePermissions(mockServerOwner), "Server Owner must NOT manage bot permissions");

    // Discord Admin should NOT be authorized by default
    const mockDiscordAdmin = {
        guild: { ownerId: "other_user" },
        user: { id: "admin_user" },
        member: { permissions: { has: () => true } }
    };
    assert(!permissionService.isAuthorized(mockDiscordAdmin), "Discord Admin must NOT have default authorization");

    // Random User should NOT be authorized
    const mockRandomUser = {
        guild: { ownerId: "other_user" },
        user: { id: "random_user" },
        member: { permissions: { has: () => false }, roles: { cache: new Map() } }
    };
    assert(!permissionService.isAuthorized(mockRandomUser), "Random user must be denied");

    // Whitelist user (authorized to broadcast, but cannot manage permissions)
    permissionService.setAuthorizedUsers(["random_user"]);
    assert(permissionService.isAuthorized(mockRandomUser), "Whitelisted user should now be authorized");
    assert(!permissionService.canManagePermissions(mockRandomUser), "Whitelisted operator still cannot change permissions");
    permissionService.setAuthorizedUsers([]); // Reset
    console.log("✅ Access control passed (Strict Bot Owner model verified).");

    // 6. Verify UI Builders & Component Serialization
    console.log("\n[Test 6] Verifying Embed & Component Builders...");
    const embeds = require("../src/ui/embeds");
    const components = require("../src/ui/components");

    const pEmbed = embeds.panelEmbed();
    assert(pEmbed.data.title.includes("Broadcast Control Panel v3"));
    assert(pEmbed.data.footer.text.includes("xseif"));

    const pRows = components.panelComponents();
    assert(pRows.length > 0, "Components row should exist");

    const wRows = components.wizardComponents({
        targetMode: "all",
        roleIds: [],
        speedMode: "safe",
        excludeBots: true,
        useAllBots: true,
        message: "Hello World",
        imageUrl: "https://example.com/banner.png"
    });
    const lastRow = wRows[wRows.length - 1];
    const testBtn = lastRow.components.find(c => c.data.custom_id === "btn_wizard_test");
    assert(testBtn !== undefined, "Wizard must include btn_wizard_test button");
    assert.strictEqual(testBtn.data.disabled, false, "Test button should be enabled when message is set");

    const modals = require("../src/ui/modals");
    const msgModal = modals.broadcastMessageModal("Test Message", "https://example.com/image.png");
    assert.strictEqual(msgModal.components.length, 2, "Modal must have 2 action rows (message + image)");
    console.log("✅ Embed, Component, Test Button, and Image Modal generation passed.");

    console.log("\n==========================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (100%)");
    console.log("==========================================");
})().catch(err => {
    console.error("❌ Test failure:", err);
    process.exit(1);
});
