import socialAutomator from './social_automator.js';

async function checkAll() {
    console.log("Checking Stealth Login Status...");
    
    const networks = ['tiktok', 'instagram', 'facebook', 'twitter', 'youtube'];
    
    for (const net of networks) {
        await socialAutomator.checkLogin(net);
    }
    
    process.exit(0);
}

checkAll();
