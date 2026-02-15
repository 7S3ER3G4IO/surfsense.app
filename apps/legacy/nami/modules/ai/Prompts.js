// Prompts.js - AI Templates

export const Prompts = {
    hook_viral: (topic) => `
        Génère 5 accroches (hooks) virales pour une vidéo courte sur le sujet "${topic}".
        Le ton doit être impactant, intrigant, et stopper le scroll.
        Utilise des structures type "Le secret que personne ne vous dit...", "Arrêtez de faire ça...", "Comment X a fait Y...".
    `,
    
    script_short: (topic, hook) => `
        Rédige un script pour une vidéo TikTok/Reel de 30 secondes sur "${topic}".
        Utilise l'accroche suivante : "${hook}".
        Structure :
        1. Hook (3s)
        2. Problème/Situation (5s)
        3. Solution/Conseil (15s)
        4. Call to Action (7s)
        Le ton doit être dynamique et conversationnel.
    `,

    seo_description: (topic, network) => `
        Rédige une description optimisée SEO pour un post ${network} sur "${topic}".
        Inclus 3-5 mots-clés pertinents intégrés naturellement.
        Termine par une question engageante.
    `,

    hashtags: (topic, network) => `
        Génère une liste de 15 hashtags pour ${network} sur le thème "${topic}".
        Mélange des hashtags très populaires (1M+), moyens (100k+) et de niche (10k+).
    `,

    cross_post_adapt: (originalContent, originalNetwork, targetNetwork) => `
        Adapte ce contenu provenant de ${originalNetwork} pour qu'il performe sur ${targetNetwork}.
        Contenu original : "${originalContent}"
        
        Consignes pour ${targetNetwork} :
        - ${targetNetwork === 'linkedin' ? 'Ton professionnel, structuré, valeur ajoutée business.' : ''}
        - ${targetNetwork === 'twitter' ? 'Court, punchy, thread si nécessaire.' : ''}
        - ${targetNetwork === 'instagram' ? 'Visuel, émojis, hashtags en commentaire.' : ''}
    `
};
