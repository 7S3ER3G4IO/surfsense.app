const spots = [
  {
    name: "Hossegor - La Gravière",
    country: "France",
    coords: [43.6647, -1.4382],
    swell: "2.1m",
    wind: "10kt NE",
    temp: "19°C",
    quality: "Excellente",
    camera: "https://dosurf.example/hossegor-graviere",
  },
  {
    name: "Biarritz - Côte des Basques",
    country: "France",
    coords: [43.4808, -1.5631],
    swell: "1.4m",
    wind: "6kt N",
    temp: "18°C",
    quality: "Bonne",
    camera: "https://dosurf.example/biarritz-cdb",
  },
  {
    name: "Lacanau Central",
    country: "France",
    coords: [44.9804, -1.089],
    swell: "1.9m",
    wind: "12kt NW",
    temp: "17°C",
    quality: "Très bonne",
    camera: "https://dosurf.example/lacanau-central",
  },
  {
    name: "Capbreton - Le Santocha",
    country: "France",
    coords: [43.6426, -1.4462],
    swell: "2.3m",
    wind: "8kt E",
    temp: "19°C",
    quality: "Excellente",
    camera: "https://dosurf.example/capbreton-santocha",
  },
  {
    name: "Seignosse - Les Estagnots",
    country: "France",
    coords: [43.6907, -1.4362],
    swell: "2.0m",
    wind: "9kt NE",
    temp: "19°C",
    quality: "Très bonne",
    camera: "https://dosurf.example/seignosse-estagnots",
  },
  {
    name: "Anglet - Les Cavaliers",
    country: "France",
    coords: [43.5087, -1.5421],
    swell: "1.6m",
    wind: "11kt NE",
    temp: "18°C",
    quality: "Bonne",
    camera: "https://dosurf.example/anglet-cavaliers",
  },
  {
    name: "Mundaka",
    country: "Espagne",
    coords: [43.4074, -2.6984],
    swell: "2.7m",
    wind: "5kt E",
    temp: "16°C",
    quality: "Epic",
    camera: "https://dosurf.example/mundaka",
  },
  {
    name: "Zarautz",
    country: "Espagne",
    coords: [43.2841, -2.171],
    swell: "1.5m",
    wind: "13kt NW",
    temp: "16°C",
    quality: "Bonne",
    camera: "https://dosurf.example/zarautz",
  },
  {
    name: "Ericeira - Ribeira d'Ilhas",
    country: "Portugal",
    coords: [38.9868, -9.4243],
    swell: "2.4m",
    wind: "7kt NE",
    temp: "18°C",
    quality: "Très bonne",
    camera: "https://dosurf.example/ericeira-ribeira",
  },
  {
    name: "Peniche - Supertubos",
    country: "Portugal",
    coords: [39.355, -9.381],
    swell: "2.8m",
    wind: "9kt N",
    temp: "17°C",
    quality: "Excellente",
    camera: "https://dosurf.example/peniche-supertubos",
  },
  {
    name: "Nazare",
    country: "Portugal",
    coords: [39.6029, -9.0702],
    swell: "6.5m",
    wind: "12kt E",
    temp: "16°C",
    quality: "Big Wave",
    camera: "https://dosurf.example/nazare",
  },
  {
    name: "Taghazout - Anchor Point",
    country: "Maroc",
    coords: [30.5422, -9.706],
    swell: "2.9m",
    wind: "6kt E",
    temp: "20°C",
    quality: "Excellente",
    camera: "https://dosurf.example/taghazout-anchor",
  },
  {
    name: "Essaouira",
    country: "Maroc",
    coords: [31.5125, -9.771],
    swell: "2.2m",
    wind: "14kt N",
    temp: "19°C",
    quality: "Bonne",
    camera: "https://dosurf.example/essaouira",
  },
  {
    name: "Jeffreys Bay",
    country: "Afrique du Sud",
    coords: [-34.05, 24.93],
    swell: "2.1m",
    wind: "5kt W",
    temp: "18°C",
    quality: "Excellente",
    camera: "https://dosurf.example/jbay",
  },
  {
    name: "Cape Town - Muizenberg",
    country: "Afrique du Sud",
    coords: [-34.1049, 18.468],
    swell: "1.3m",
    wind: "9kt SE",
    temp: "17°C",
    quality: "Bonne",
    camera: "https://dosurf.example/muizenberg",
  },
  {
    name: "Bali - Uluwatu",
    country: "Indonésie",
    coords: [-8.829, 115.087],
    swell: "2.7m",
    wind: "8kt SE",
    temp: "26°C",
    quality: "Excellente",
    camera: "https://dosurf.example/uluwatu",
  },
  {
    name: "Bali - Canggu",
    country: "Indonésie",
    coords: [-8.6538, 115.133],
    swell: "1.6m",
    wind: "10kt SE",
    temp: "27°C",
    quality: "Bonne",
    camera: "https://dosurf.example/canggu",
  },
  {
    name: "Gold Coast - Snapper Rocks",
    country: "Australie",
    coords: [-28.1628, 153.5506],
    swell: "2.2m",
    wind: "7kt W",
    temp: "24°C",
    quality: "Excellente",
    camera: "https://dosurf.example/snapper",
  },
  {
    name: "Byron Bay",
    country: "Australie",
    coords: [-28.649, 153.612],
    swell: "1.8m",
    wind: "9kt SW",
    temp: "24°C",
    quality: "Bonne",
    camera: "https://dosurf.example/byron",
  },
  {
    name: "Huntington Beach",
    country: "USA",
    coords: [33.6595, -117.9988],
    swell: "1.4m",
    wind: "12kt NW",
    temp: "19°C",
    quality: "Bonne",
    camera: "https://dosurf.example/huntington",
  },
  {
    name: "Santa Cruz - Steamer Lane",
    country: "USA",
    coords: [36.9513, -122.0254],
    swell: "2.0m",
    wind: "6kt N",
    temp: "16°C",
    quality: "Très bonne",
    camera: "https://dosurf.example/steamer",
  },
  {
    name: "Oahu - Pipeline",
    country: "USA",
    coords: [21.665, -158.05],
    swell: "3.1m",
    wind: "5kt NE",
    temp: "25°C",
    quality: "Epic",
    camera: "https://dosurf.example/pipeline",
  },
  {
    name: "Tamarindo",
    country: "Costa Rica",
    coords: [10.299, -85.8406],
    swell: "1.7m",
    wind: "10kt E",
    temp: "28°C",
    quality: "Bonne",
    camera: "https://dosurf.example/tamarindo",
  },
  {
    name: "Playa Hermosa",
    country: "Costa Rica",
    coords: [9.659, -84.636],
    swell: "2.4m",
    wind: "7kt NE",
    temp: "27°C",
    quality: "Excellente",
    camera: "https://dosurf.example/hermosa",
  },
  {
    name: "Mavericks",
    country: "USA",
    coords: [37.495, -122.5],
    swell: "4.8m",
    wind: "11kt E",
    temp: "15°C",
    quality: "Big Wave",
    camera: "https://dosurf.example/mavericks",
  },
];

const conditions = [
  { label: "Swell (m)", value: 2.1, trend: "↗" },
  { label: "Période (s)", value: 14, trend: "↗" },
  { label: "Vent (kt)", value: 10, trend: "↘" },
  { label: "Temp eau (°C)", value: 19, trend: "↗" },
  { label: "Pression (hPa)", value: 1018, trend: "→" },
  { label: "Marée", value: 1.4, trend: "↘" },
];

const newsItems = [
  {
    title: "Houle solide attendue sur la côte basque",
    tag: "Alerte houle",
    time: "Il y a 3 min",
  },
  {
    title: "Pipeline en mode contest — conditions clean",
    tag: "Live",
    time: "Il y a 8 min",
  },
  {
    title: "Tour d'Europe : top spots du week-end",
    tag: "Report",
    time: "Il y a 12 min",
  },
  {
    title: "Vent offshore prévu pour l'aube",
    tag: "Forecast",
    time: "Il y a 18 min",
  },
];

let map;
let refreshCountdown = 58;

const createConditions = () => {
  const grid = document.getElementById("conditions-grid");
  grid.innerHTML = "";
  conditions.forEach((item) => {
    const card = document.createElement("div");
    card.className = "condition-card";
    card.innerHTML = `
      <h4>${item.label}</h4>
      <p><strong>${item.value}</strong> ${item.trend}</p>
    `;
    grid.appendChild(card);
  });
};

const createNews = () => {
  const grid = document.getElementById("news-grid");
  grid.innerHTML = "";
  newsItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "news-card";
    card.innerHTML = `
      <span>${item.tag}</span>
      <h3>${item.title}</h3>
      <p>${item.time}</p>
    `;
    grid.appendChild(card);
  });
};

const updateHeroStats = () => {
  const swell = document.getElementById("global-swell");
  const wind = document.getElementById("global-wind");
  const temp = document.getElementById("global-temp");
  const quality = document.getElementById("global-qa");

  const rand = (min, max, digits = 1) =>
    (Math.random() * (max - min) + min).toFixed(digits);

  swell.textContent = `${rand(1.2, 3.4)}m`;
  wind.textContent = `${rand(6, 18, 0)}kt`;
  temp.textContent = `${rand(16, 27, 0)}°C`;
  quality.textContent = `${rand(76, 97, 0)}%`;
};

const updateCountdown = () => {
  refreshCountdown -= 1;
  if (refreshCountdown <= 0) {
    refreshCountdown = 58;
    updateHeroStats();
  }
  document.getElementById("next-refresh").textContent = `${refreshCountdown}s`;
};

const initMap = () => {
  map = L.map("surf-map", { zoomControl: false }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  spots.forEach((spot) => {
    const marker = L.circleMarker(spot.coords, {
      radius: 6,
      color: "#4df3ff",
      fillColor: "#4df3ff",
      fillOpacity: 0.8,
    }).addTo(map);

    marker.on("click", () => selectSpot(spot));
  });
};

const selectSpot = (spot) => {
  const details = document.getElementById("spot-details");
  details.innerHTML = `
    <h4>${spot.name}</h4>
    <p>${spot.country}</p>
    <div class="detail-row">
      <strong>Swell:</strong> ${spot.swell}
    </div>
    <div class="detail-row">
      <strong>Vent:</strong> ${spot.wind}
    </div>
    <div class="detail-row">
      <strong>Température:</strong> ${spot.temp}
    </div>
    <div class="detail-row">
      <strong>Qualité:</strong> ${spot.quality}
    </div>
    <div class="detail-row">
      <strong>Caméra:</strong> <a href="${spot.camera}" target="_blank">Accéder</a>
    </div>
  `;
};

createConditions();
createNews();
updateHeroStats();
setInterval(updateCountdown, 1000);

window.addEventListener("load", () => {
  initMap();
  selectSpot(spots[0]);
});
