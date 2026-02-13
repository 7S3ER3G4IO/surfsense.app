import socialAutomator from './social_automator.js';

async function verifyLogins() {
    console.log("🔍 Démarrage de la vérification des logins via Cookies...");
    
    console.log("Cookies loaded for:", Object.keys(socialAutomator.cookies));

    const networks = ['instagram', 'facebook', 'tiktok', 'twitter', 'youtube'];
    
    for (const network of networks) {
        console.log(`\n-----------------------------------`);
        console.log(`Testing ${network.toUpperCase()}...`);
        try {
            const isLoggedIn = await socialAutomator.checkLogin(network);
            if (isLoggedIn) {
                console.log(`✅ ${network.toUpperCase()}: LOGIN RÉUSSI (Cookies valides)`);
            } else {
                console.log(`❌ ${network.toUpperCase()}: ÉCHEC LOGIN (Cookies invalides ou expirés)`);
            }
        } catch (error) {
            console.error(`⚠️ Erreur lors du test de ${network}:`, error.message);
        }
    }

    console.log(`\n-----------------------------------`);
    console.log("🏁 Vérification terminée.");
    process.exit(0);
}

verifyLogins();
