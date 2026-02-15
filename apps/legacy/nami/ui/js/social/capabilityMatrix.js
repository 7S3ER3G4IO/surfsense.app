// capabilityMatrix.js - Maps actions to support level (official, limited, manual)

export const capabilityMatrix = {
    tiktok: {
        publish_post: "official",
        delete_post: "official",
        analytics_fetch: "official",
        edit_profile: "not_supported",
        send_dm: "not_supported",
        comment_reply: "official"
    },
    instagram: {
        publish_post: "official", // Graph API
        delete_post: "limited", // Depends on media type
        analytics_fetch: "official",
        edit_profile: "not_supported",
        send_dm: "restricted", // Only for Business accounts with high limits
        comment_reply: "official"
    },
    facebook: {
        publish_post: "official",
        delete_post: "official",
        analytics_fetch: "official",
        edit_profile: "not_supported",
        send_dm: "not_supported",
        comment_reply: "official"
    },
    youtube: {
        publish_post: "official", // Data API v3
        delete_post: "official",
        analytics_fetch: "official",
        edit_profile: "official", // Can update title/desc of channel sometimes
        send_dm: "not_supported", // No DMs
        comment_reply: "official"
    },
    twitter: { // X
        publish_post: "official", // v2 API
        delete_post: "official",
        analytics_fetch: "official", // Paid tiers mostly
        edit_profile: "not_supported",
        send_dm: "official", // v2 DM API
        comment_reply: "official"
    },
    linkedin: {
        publish_post: "official", // UGC API
        delete_post: "official",
        analytics_fetch: "official",
        edit_profile: "not_supported",
        send_dm: "not_supported",
        comment_reply: "official"
    },
    pinterest: {
        publish_post: "official", // v5 API
        delete_post: "official",
        analytics_fetch: "official",
        edit_profile: "not_supported",
        send_dm: "not_supported",
        comment_reply: "not_supported"
    },
    snapchat: {
        publish_post: "official", // Creative Kit
        delete_post: "not_supported",
        analytics_fetch: "limited",
        edit_profile: "not_supported",
        send_dm: "not_supported",
        comment_reply: "not_supported"
    },
    threads: {
        publish_post: "official", // Threads API
        delete_post: "not_supported", // Not yet
        analytics_fetch: "official",
        edit_profile: "not_supported",
        send_dm: "not_supported",
        comment_reply: "official"
    }
};

export const getCapabilityStatus = (network, action) => {
    if (!capabilityMatrix[network]) return "unknown";
    return capabilityMatrix[network][action] || "not_supported";
};
