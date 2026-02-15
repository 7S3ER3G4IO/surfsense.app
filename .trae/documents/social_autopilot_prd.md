## 1. Product Overview
Social Autopilot est une plateforme SaaS premium qui automatise la création, le montage et la publication de vidéos verticales professionnelles sur les réseaux sociaux. Elle permet aux créateurs et entreprises de maintenir une présence constante sur YouTube Shorts, TikTok et Instagram Reels sans effort manuel.

Le produit résout le problème de la création de contenu chronophage en automatisant le processus complet : sélection de médias, montage vidéo professionnel, publication programmée et analyse des performances. Il s'adresse aux créateurs de contenu, agences marketing et entreprises souhaitant scaler leur présence vidéo courte.

## 2. Core Features

### 2.1 User Roles
| Role | Registration Method | Core Permissions |
|------|---------------------|------------------|
| Workspace Owner | Email/Clerk | Full access, billing, member management |
| Workspace Member | Invitation | Content creation, media management, analytics |

### 2.2 Feature Module
Notre plateforme Social Autopilot comprend les pages essentielles suivantes :

1. **Dashboard**: Vue d'ensemble des projets, statistiques rapides, actions rapides
2. **Projects/Connections**: Gestion des connexions YouTube et autres plateformes
3. **Media Library**: Upload/import de médias, organisation par tags, prévisualisation
4. **Autopilot Settings**: Configuration des règles de publication automatique
5. **Content Timeline**: Suivi des plans de contenu, rendus et publications
6. **Analytics**: Tableaux de bord des performances et recommandations
7. **Settings**: Configuration du workspace et facturation

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|---------------------|
| Dashboard | Overview Stats | Affiche les métriques clés (vues, publications, engagement) avec graphiques simples |
| Dashboard | Quick Actions | Boutons rapides pour créer projet, uploader média, lancer autopilot |
| Projects/Connections | YouTube Connect | OAuth flow pour connecter compte YouTube avec gestion des permissions |
| Projects/Connections | Account Status | Indicateur de statut des connexions avec dernière sync |
| Media Library | Upload Zone | Drag & drop upload vers S3 avec barre de progression |
| Media Library | Import Integration | Boutons pour importer depuis Google Drive/Dropbox via OAuth |
| Media Library | Grid View | Grille de miniatures avec filtres par type, durée, tags |
| Media Library | Preview Player | Lecteur vidéo intégré avec métadonnées (durée, résolution, fps) |
| Autopilot Settings | Rules Configuration | Formulaire pour cadence, fenêtres horaires, style, objectif |
| Autopilot Settings | Toggle Activation | Switch pour activer/désactiver l'autopilot avec confirmation |
| Content Timeline | Plans List | Liste des plans de contenu générés avec statut |
| Content Timeline | Renders Status | Suivi en temps réel des rendus vidéo avec progression |
| Content Timeline | Posts Calendar | Vue calendrier des publications planifiées et effectuées |
| Analytics | Performance Charts | Graphiques d'évolution des vues, watch time, engagement |
| Analytics | Top Content | Tableau des meilleures vidéos avec métriques clés |
| Analytics | Recommendations | Suggestions basées sur les performances historiques |
| Settings | Workspace Config | Gestion du nom, membres, invitations |
| Settings | Billing | Vue des abonnements et usage (stub pour MVP) |

## 3. Core Process

### Flow Utilisateur Principal
1. L'utilisateur crée un workspace et un projet via l'onboarding
2. Il connecte son compte YouTube via OAuth
3. Il upload ou importe ses médias depuis Drive/Dropbox
4. Il configure l'autopilot avec ses préférences (cadence, style, objectif)
5. Le système génère automatiquement des plans de contenu
6. Les vidéos sont rendues automatiquement via FFmpeg
7. Les vidéos sont publiées selon le calendrier défini
8. Les analytics sont collectés et affichés dans le dashboard

### Flow Manuel
L'utilisateur peut à tout moment :
- Créer manuellement un plan de contenu
- Déclencher un rendu vidéo spécifique
- Planifier une publication manuelle
- Re-publier un contenu échoué

```mermaid
graph TD
    A[Dashboard] --> B[Create Project]
    B --> C[Connect YouTube]
    C --> D[Upload/Import Media]
    D --> E[Configure Autopilot]
    E --> F[Content Plans Generated]
    F --> G[Video Rendering]
    G --> H[Auto Publishing]
    H --> I[Analytics Collection]
    I --> A
    
    D --> J[Manual Actions]
    J --> G
    
    H --> K[YouTube Shorts]
    H --> L[TikTok (Mock)]
    H --> M[Instagram Reels (Mock)]
```

## 4. User Interface Design

### 4.1 Design Style
- **Couleurs**: Palette sombre premium - Noir/Charcoal (#0A0A0A, #1A1A1A) avec accents bleu électrique (#00D4FF) et rouge (#FF3366)
- **Boutons**: Style glassmorphism avec bordures subtiles, hover states avec animations fluides
- **Typographie**: Inter pour titres, Inter var pour corps de texte. Tailles: 14px base, 16px pour cards, 24px pour titres
- **Layout**: Structure sidebar + topbar avec cards glassmorphism, grid responsive de 12 colonnes
- **Icônes**: Lucide React avec stroke-width de 2, animations discrètes au hover
- **Animations**: Transitions ease-out 200ms, micro-interactions sur les interactions principales

### 4.2 Page Design Overview
| Page Name | Module Name | UI Elements |
|-----------|-------------|-------------|
| Dashboard | Stats Cards | Cards glass avec gradients subtils, chiffres en gras, icônes colorées |
| Dashboard | Quick Actions | Boutons primary avec hover scale 1.02, shadow elevation |
| Media Library | Upload Zone | Zone avec border dashed animée au drag-over, preview thumbnails 16:9 |
| Media Library | Grid Layout | Grid masonry adaptatif, cards avec overlay info au hover |
| Autopilot Settings | Form Cards | Cards séparées par sections, toggles switches modernes |
| Content Timeline | Status Badges | Badges colorés selon statut (queued: blue, rendering: orange, published: green) |
| Analytics | Charts | Charts minimalistes avec gradients, tooltips stylés |

### 4.3 Responsiveness
- Desktop-first avec breakpoints: 1920px, 1440px, 1024px, 768px, 375px
- Sidebar collapsible en mobile, navigation drawer depuis hamburger
- Grids adaptatives: 4 colonnes desktop → 2 tablette → 1 mobile
- Touch optimisé avec zones cliquables minimales 44x44px

### 4.4 3D Scene Guidance
Non applicable - Interface 2D premium avec glassmorphism et animations subtiles