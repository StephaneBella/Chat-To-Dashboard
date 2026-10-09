# Tableau de bord BI conversationnel — Chat-to-Dashboard

## 1. Présentation du projet

**Chat-to-Dashboard** est une application de Business Intelligence permettant aux décideurs d'explorer les données commerciales à travers un tableau de bord interactif et une interface conversationnelle.

L'utilisateur peut poser une question en langage naturel, par exemple :

> « Montre-moi les ventes par région sur les deux derniers trimestres. »

L'assistant IA interprète la demande, génère une requête adaptée aux données disponibles, interroge l'API et sélectionne la visualisation la plus pertinente.

L'objectif est de transformer une question métier en **requête analytique puis en visualisation**, sans nécessiter de connaissances techniques en SQL ou en BI.

---

## 2. Contexte métier

Le projet est réalisé dans le contexte fictif de **Atlas Superstore Inc.**, un distributeur et e-commerçant américain opérant sur plusieurs catégories de produits et segments clients.

L'entreprise constate une progression de son chiffre d'affaires alors que sa rentabilité est sous pression. Certaines sous-catégories, régions, commandes et remises peuvent générer peu ou pas de profit.

### Problème métier

Le tableau de bord doit permettre d'identifier les causes de la faible rentabilité et d'aider la direction à prendre des décisions permettant :

* d'augmenter le profit total ;
* d'améliorer la marge bénéficiaire ;
* de réduire les ventes non rentables ;
* d'optimiser les remises ;
* d'améliorer le mix produit, région et segment ;
* de prioriser les actions ayant le plus fort impact sur la rentabilité.

---

## 3. Questions métier principales

Le système doit notamment permettre de répondre aux questions suivantes :

* Quelles sous-catégories et quels produits détruisent la marge ?
* À partir de quel niveau de remise une vente devient-elle non rentable ?
* Quelles régions, villes ou segments clients sont les plus ou les moins profitables ?
* Quels modes d'expédition dégradent le profit ?
* Où faut-il agir en priorité pour augmenter rapidement la rentabilité ?

---

## 4. Dataset

Le projet utilise le dataset **Superstore Dataset Final**, disponible sur Kaggle.

**Source :** [Kaggle — Superstore Dataset Final](https://www.kaggle.com/datasets/vivek468/superstore-dataset-final)

### Caractéristiques

* Environ **9 994 lignes**
* **21 colonnes**
* Données transactionnelles de vente au détail aux États-Unis
* Période : **2014 à 2017**
* Granularité : une ligne correspond à un produit dans une commande
* Régions : **East, West, Central, South**

### Principales dimensions

* **Commande** : `Order ID`, `Order Date`, `Ship Date`, `Ship Mode`
* **Client** : `Customer ID`, `Customer Name`, `Segment`
* **Produit** : `Product ID`, `Category`, `Sub-Category`, `Product Name`
* **Géographie** : `Country`, `Region`, `State`, `City`, `Postal Code`

### Principales mesures

* `Sales`
* `Quantity`
* `Discount`
* `Profit`

> Le dataset ne contient pas les coûts détaillés, les retours ou une marge cible. La rentabilité est donc analysée à partir du ratio `Profit / Sales`.

---

## 5. KPIs

Le projet distingue les **métriques brutes** des **KPIs de pilotage**.

Les métriques telles que `Sales`, `Profit`, `Discount` et `Quantity` servent de base aux analyses. Les KPIs sont construits pour suivre directement l'objectif d'amélioration de la rentabilité.

### KPIs principaux

| KPI                                | Formule                                             | Objectif                               |
| ---------------------------------- | --------------------------------------------------- | -------------------------------------- |
| Taux de marge bénéficiaire globale | `SUM(Profit) / SUM(Sales)`                          | Mesurer la rentabilité globale         |
| Taux de remise moyen pondéré       | `SUM(Sales * Discount) / SUM(Sales)`                | Mesurer l'impact des remises           |
| Taux de commandes à profit négatif | `COUNTD(Order ID où Profit < 0) / COUNTD(Order ID)` | Identifier les commandes non rentables |

Le document de cadrage définit ces KPIs comme les indicateurs à piloter directement pour augmenter la rentabilité.

---

## 6. Objectifs du projet

Le MVP doit permettre :

* de modéliser les données sous la forme d'un **schéma en étoile simplifié** ;
* de construire une API Django REST Framework permettant d'effectuer des agrégations ;
* de proposer un tableau de bord avec des visualisations standards ;
* de permettre à l'utilisateur d'interroger les données en langage naturel ;
* de traduire automatiquement une question utilisateur en requête analytique ;
* de sélectionner et paramétrer automatiquement une visualisation adaptée.

---

## 7. Architecture fonctionnelle

```text
                    ┌────────────────────────┐
                    │      Utilisateur       │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Interface Dashboard    │
                    │ + Chat conversationnel  │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │      Agent IA           │
                    │   Text-to-Query         │
                    └───────────┬────────────┘
                                │
                         Requête analytique
                                │
                                ▼
                    ┌────────────────────────┐
                    │      API Django        │
                    │   Django REST Framework│
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Data Warehouse / DB    │
                    │   Schéma en étoile     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Résultats analytiques  │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ Visualisation générée  │
                    └────────────────────────┘
```

---

## 8. Modèle de données

Le système repose sur un **schéma en étoile simplifié** autour d'une table de faits de ventes.

### Table de faits

`FactSales`

Principales mesures :

* `sales`
* `quantity`
* `discount`
* `profit`

### Dimensions

* `DimProduct`
* `DimCustomer`
* `DimRegion`
* `DimTime`

Cette modélisation permet d'effectuer des analyses par produit, client, région et période.

---

## 9. Fonctionnalités du MVP

### Dashboard

Le tableau de bord doit proposer des visualisations standards permettant notamment d'analyser :

* les ventes ;
* le profit ;
* la marge ;
* les remises ;
* les commandes non rentables ;
* les performances par région ;
* les performances par segment ;
* les performances par catégorie et sous-catégorie ;
* les performances par mode d'expédition ;
* l'évolution temporelle des KPIs.

### API

L'API Django REST Framework doit exposer des endpoints permettant les agrégations nécessaires au dashboard.

Exemples :

```text
GET /api/sales/by-region/
GET /api/sales/by-product/
GET /api/sales/by-segment/
GET /api/sales/by-category/
GET /api/sales/by-period/
GET /api/kpis/
```

### Chat-to-Dashboard

L'utilisateur peut poser une question en langage naturel :

```text
Montre-moi les ventes par région en 2017.
```

ou :

```text
Quelles sont les sous-catégories qui ont généré le plus de pertes ?
```

L'agent doit :

1. comprendre l'intention de l'utilisateur ;
2. identifier les dimensions et mesures nécessaires ;
3. construire une requête adaptée ;
4. interroger l'API ;
5. récupérer les résultats ;
6. sélectionner le type de graphique approprié ;
7. paramétrer la visualisation ;
8. afficher le résultat dans le dashboard.

---

## 10. Brique agentique

Le cœur intelligent du projet est l'agent **Text-to-Query / Query-to-Visualization**.

### Entrée

Une question formulée en langage naturel.

### Traitement

```text
Question utilisateur
        ↓
Analyse de l'intention
        ↓
Identification des métriques
        ↓
Identification des dimensions
        ↓
Identification des filtres
        ↓
Construction de la requête
        ↓
Appel de l'API
        ↓
Analyse du résultat
        ↓
Sélection du graphique
        ↓
Configuration du graphique
```

### Sortie

Une visualisation adaptée accompagnée, lorsque nécessaire, d'une réponse textuelle expliquant le résultat.

---

## 12. Stack technique

### Backend

* Python
* Django
* Django REST Framework

### Intelligence artificielle

* LLM
* Agent conversationnel
* Text-to-Query
* Query-to-Visualization

### Base de données

* Base de données relationnelle
* Schéma en étoile simplifié

### Frontend / Dashboard

* Interface web
* Graphiques interactifs
* Interface conversationnelle

---

## 14. Résultat attendu

À terme, l'utilisateur doit pouvoir accéder à un tableau de bord décisionnel dans lequel il peut :

```text
Explorer les KPI
      +
Analyser les données
      +
Poser des questions en langage naturel
      +
Obtenir automatiquement le graphique pertinent
      =
Prendre de meilleures décisions de rentabilité
```

Le projet vise ainsi à rapprocher la **Business Intelligence traditionnelle** de l'**interaction conversationnelle avec les données**.
