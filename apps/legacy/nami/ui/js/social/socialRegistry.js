// socialRegistry.js - Defines all supported networks, content types, and technical specs.

export const socialRegistry = {
    tiktok: {
        name: "TikTok",
        icon: "🎵",
        types: {
            video_feed: {
                label: "Video Feed (Standard)",
                ratio: "9:16",
                resolution: "1080x1920",
                duration: { min: 3, max: 600, label: "3s - 10min" },
                format: "mp4",
                api_support: "official",
                safe_zones: { top: 15, bottom: 20, right: 10, left: 2 } // % from edge
            },
            story: {
                label: "Story",
                ratio: "9:16",
                resolution: "1080x1920",
                duration: { min: 1, max: 15, label: "Max 15s" },
                api_support: "limited"
            },
            carousel_photo: {
                label: "Photo Mode (Carousel)",
                ratio: "9:16",
                resolution: "1080x1920",
                api_support: "official"
            }
        }
    },
    instagram: {
        name: "Instagram",
        icon: "📸",
        types: {
            feed_square: {
                label: "Post (Carré)",
                ratio: "1:1",
                resolution: "1080x1080",
                format: "jpg/png",
                api_support: "official"
            },
            feed_portrait: {
                label: "Post (Portrait)",
                ratio: "4:5",
                resolution: "1080x1350",
                format: "jpg/png",
                api_support: "official"
            },
            reel: {
                label: "Reel",
                ratio: "9:16",
                resolution: "1080x1920",
                duration: { min: 3, max: 90, label: "Max 90s" },
                format: "mp4",
                api_support: "official",
                safe_zones: { bottom: 25, right: 15 }
            },
            story: {
                label: "Story",
                ratio: "9:16",
                resolution: "1080x1920",
                duration: { max: 60, label: "Max 60s" },
                api_support: "official" // Content Publishing API supports stories now
            }
        }
    },
    facebook: {
        name: "Facebook",
        icon: "📘",
        types: {
            feed: {
                label: "Post (Feed)",
                ratio: "1.91:1",
                resolution: "1200x630",
                api_support: "official"
            },
            reel: {
                label: "Reel",
                ratio: "9:16",
                resolution: "1080x1920",
                api_support: "official"
            },
            story: {
                label: "Story",
                ratio: "9:16",
                resolution: "1080x1920",
                api_support: "official"
            }
        }
    },
    youtube: {
        name: "YouTube",
        icon: "📺",
        types: {
            video: {
                label: "Video (Long)",
                ratio: "16:9",
                resolution: "1920x1080", // Can be 4K
                duration: { min: 0, max: 43200, label: "Unlimited" },
                format: "mp4/mov",
                api_support: "official"
            },
            short: {
                label: "Shorts",
                ratio: "9:16",
                resolution: "1080x1920",
                duration: { max: 60, label: "Max 60s" },
                api_support: "official"
            }
        }
    },
    twitter: { // X
        name: "X (Twitter)",
        icon: "🐦",
        types: {
            tweet_image: {
                label: "Image",
                ratio: "16:9", // Flexible but optimized
                resolution: "1200x675",
                api_support: "official"
            },
            tweet_video: {
                label: "Video",
                ratio: "16:9", // Or 1:1
                resolution: "1280x720",
                duration: { max: 140, label: "Max 2m20s" },
                api_support: "official"
            }
        }
    },
    linkedin: {
        name: "LinkedIn",
        icon: "💼",
        types: {
            post_image: {
                label: "Image Post",
                ratio: "1.91:1", // Or 1:1
                resolution: "1200x627",
                api_support: "official"
            },
            post_video: {
                label: "Video Post",
                ratio: "16:9", // Or 1:1
                resolution: "1920x1080",
                duration: { min: 3, max: 600, label: "Max 10min" },
                api_support: "official"
            },
             document: {
                label: "Document (PDF)",
                ratio: "4:5", // Often portrait
                format: "pdf",
                api_support: "official" // via UGC API
            }
        }
    },
    pinterest: {
        name: "Pinterest",
        icon: "📌",
        types: {
            pin_standard: {
                label: "Standard Pin",
                ratio: "2:3",
                resolution: "1000x1500",
                api_support: "official"
            },
            idea_pin: {
                label: "Idea Pin (Video)",
                ratio: "9:16",
                resolution: "1080x1920",
                api_support: "official"
            }
        }
    },
    snapchat: {
        name: "Snapchat",
        icon: "👻",
        types: {
            spotlight: {
                label: "Spotlight",
                ratio: "9:16",
                resolution: "1080x1920",
                duration: { min: 5, max: 60 },
                api_support: "official" // via Creative Kit
            },
            story: {
                label: "Story",
                ratio: "9:16",
                resolution: "1080x1920",
                api_support: "official"
            }
        }
    },
    threads: {
        name: "Threads",
        icon: "🧵",
        types: {
            post_text: {
                label: "Text Post",
                type: "text",
                char_limit: 500,
                api_support: "official"
            },
            post_image: {
                label: "Image / Carousel",
                ratio: "flexible", // 1:1 to 9:16
                resolution: "1080x1080", // flexible
                api_support: "official"
            },
            post_video: {
                label: "Video",
                ratio: "flexible",
                duration: { max: 300, label: "Max 5min" },
                api_support: "official"
            }
        }
    },
    outlook: {
        name: "Outlook",
        icon: "📧",
        types: {
            email: {
                label: "Email",
                type: "text",
                api_support: "official"
            }
        }
    },
    discord: {
        name: "Discord",
        icon: "💬",
        types: {
            message: {
                label: "Channel Message",
                type: "text",
                api_support: "official"
            }
        }
    },
    telegram: {
        name: "Telegram",
        icon: "✈️",
        types: {
            message: {
                label: "Message",
                type: "text",
                api_support: "official"
            }
        }
    }
};
