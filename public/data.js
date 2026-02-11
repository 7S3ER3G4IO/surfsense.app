/* ==========================================================================
   Data.JS - VERSION PROD RENDER (OPTIMISÉE & CORRIGÉE)
   ========================================================================== */

// --- 1. LISTE DES SPOTS (DATABASE) ---
const rawSpots = [
  { name: "Hossegor - La Gravière", region: "Landes", country: "France", coords: [43.6656, -1.4436], facing: 275, type: "beachbreak" },
  { name: "Hossegor - La Nord", region: "Landes", country: "France", coords: [43.6742, -1.4457], facing: 275, type: "beachbreak" },
  { name: "Capbreton - Le Santocha", region: "Landes", country: "France", coords: [43.6429, -1.4498], facing: 270, type: "beachbreak" },
  { name: "Seignosse - Les Estagnots", region: "Landes", country: "France", coords: [43.6921, -1.441], facing: 280, type: "beachbreak" },
  { name: "Seignosse - Le Penon", region: "Landes", country: "France", coords: [43.6992, -1.4441], facing: 280, type: "beachbreak" },
  { name: "Vieux-Boucau", region: "Landes", country: "France", coords: [43.7921, -1.4094], facing: 275, type: "beachbreak" },
  { name: "Ondres", region: "Landes", country: "France", coords: [43.56, -1.4662], facing: 270, type: "beachbreak" },
  { name: "Anglet - Les Cavaliers", region: "Pays basque", country: "France", coords: [43.523, -1.5368], facing: 290, type: "beachbreak" },
  { name: "Biarritz - Côte des Basques", region: "Pays basque", country: "France", coords: [43.4835, -1.5656], facing: 250, type: "beachbreak" },
  { name: "Guéthary - Parlementia", region: "Pays basque", country: "France", coords: [43.4221, -1.6097], facing: 300, type: "reef" },
  { name: "Saint-Jean-de-Luz - Lafitenia", region: "Pays basque", country: "France", coords: [43.4061, -1.6386], facing: 320, type: "pointbreak" },
  { name: "Hendaye", region: "Pays basque", country: "France", coords: [43.37, -1.789], facing: 0, type: "beachbreak" },
  { name: "Lacanau Central", region: "Gironde", country: "France", coords: [44.9774, -1.203], facing: 275, type: "beachbreak" },
  { name: "Carcans Plage", region: "Gironde", country: "France", coords: [45.0862, -1.1325], facing: 275, type: "beachbreak" },
  { name: "Hourtin", region: "Gironde", country: "France", coords: [45.2238, -1.1785], facing: 275, type: "beachbreak" },
  { name: "Biscarrosse", region: "Landes", country: "France", coords: [44.4472, -1.2527], facing: 275, type: "beachbreak" },
  { name: "Mimizan", region: "Landes", country: "France", coords: [44.2132, -1.3028], facing: 275, type: "beachbreak" },
  { name: "Cap Ferret - Truc Vert", region: "Gironde", country: "France", coords: [44.7322, -1.2523], facing: 275, type: "beachbreak" },
  { name: "La Torche", region: "Bretagne", country: "France", coords: [47.8198, -4.3588], facing: 230, type: "pointbreak" },
  { name: "Crozon - La Palue", region: "Bretagne", country: "France", coords: [48.2606, -4.6148], facing: 260, type: "beachbreak" }
];

const spots = rawSpots.map(s => ({...s, lastUpdated: null}));
let map;
let activeMarker;
let markersCluster;
const markersByName = new Map();
let tideInterval = null; 
let camClockInterval = null; 
let deferredPrompt;

// --- 2. CONTENU JURIDIQUE (PROTECTION) ---
const legalTexts = {
    "legal-mentions": {
        title: "Mentions Légales",
        body: `<div class="legal-section"><h3>1. Édition</h3><p>SurfSense Premium. Contact: support@surfsense.io</p></div>`
    },
    "legal-cgu": {
        title: "Conditions Générales d'Utilisation",
        body: `<div class="legal-section"><h3>Avertissement</h3><p>Le surf est un sport à risque. SurfSense décline toute responsabilité.</p></div>`
    },
    "legal-rgpd": {
        title: "Politique de Confidentialité",
        body: `<div class="legal-section"><h3>Données</h3><p>Vos données (email, favoris) sont stockées de manière sécurisée.</p></div>`
    }
};