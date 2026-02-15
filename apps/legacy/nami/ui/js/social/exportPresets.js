// exportPresets.js - Technical export settings for each network/content type

export const exportPresets = {
    // Defaults
    default: {
        video: {
            codec: "h264",
            container: "mp4",
            bitrate_video: "8000k", // 8 Mbps
            bitrate_audio: "192k",
            fps: 30,
            gop: 2 // Keyframe every 2s (approx)
        },
        image: {
            format: "jpg",
            quality: 90
        }
    },
    
    // TikTok specific
    tiktok: {
        video: {
            codec: "h264", // H.265 supported but H.264 safer
            container: "mp4",
            bitrate_video: "15000k", // Higher for quality
            fps: 60, // Preferred for smooth motion
            max_size_mb: 287 // limit
        }
    },
    
    // Instagram Reels
    instagram_reel: {
        video: {
            codec: "h264",
            container: "mp4",
            bitrate_video: "8000k", // Recommend 3-8 Mbps
            fps: 30, // Can do 60 but often compressed
            audio_codec: "aac",
            max_duration: 90
        }
    },
    
    // YouTube
    youtube_4k: {
        video: {
            codec: "vp9", // or h264
            container: "mp4", // or mkv/webm
            bitrate_video: "45000k", // 45 Mbps for 4K
            fps: 60,
            profile: "high"
        }
    },
    
    youtube_1080: {
        video: {
            codec: "h264",
            container: "mp4",
            bitrate_video: "12000k", // 12 Mbps
            fps: 60
        }
    }
};

export const getExportPreset = (network, type) => {
    // Logic to return specific or fallback to default
    if (network === 'tiktok') return exportPresets.tiktok;
    if (network === 'instagram' && type === 'reel') return exportPresets.instagram_reel;
    if (network === 'youtube') return exportPresets.youtube_1080;
    
    return exportPresets.default;
};
