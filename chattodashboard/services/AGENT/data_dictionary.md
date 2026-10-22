# Dictionnaire de données - Atlas Superstore Inc.

## Règles globales
- Montants en dollars américains ($). Commandes passées de 2014 à 2017.
- Remise (discount) : taux entre 0 et 1 (0.2 = 20 %).
- Profit négatif = vente à perte.
- Les noms ci-dessous sont les noms SQL réels. Certains sont en français (annee, mois, produit_key, localite_key...) : ne pas les traduire.
- Ne jamais faire AVG(profit / sales) : toujours SUM(profit) / SUM(sales).
- Compter les commandes avec COUNT(DISTINCT order_id), jamais COUNT(*) sur fact_sales (une commande a plusieurs lignes).
- Un ratio ne s'additionne pas et ne se moyenne pas entre groupes : le recalculer avec des sommes.
- Pour une analyse par année, utiliser dim_date jointe sur order_date_key (année de commande).

## Définitions métier
- Taux de marge = SUM(profit) * 100.0 / SUM(sales)
- Remise pondérée = SUM(sales * discount) * 100.0 / SUM(sales)
- Taux de commandes à perte = commandes avec order_profit < 0 / commandes (via fact_orders.is_sold_at_a_loss)
- Vente à perte = ligne de fact_sales avec profit < 0
- Commande à perte = commande dont le profit TOTAL est < 0. Une commande peut contenir des lignes à perte et rester rentable.

## Jointures standard (fact_sales)
- fact_sales.order_date_key = dim_date.date_key
- fact_sales.ship_date_key = dim_date.date_key (date d'expédition, à n'utiliser que pour les délais)
- fact_sales.client_key = dim_client.client_key
- fact_sales.product_key = dim_produit.produit_key
- fact_sales.location_key = dim_localite.localite_key
- fact_sales.ship_mode_key = dim_shipping_mode.ship_mode_key
- fact_orders se joint à dim_date, dim_client et dim_shipping_mode avec les mêmes clés. fact_orders se relie à fact_sales par order_id.

## Exemples de requêtes correctes
-- Profit par tranche de remise
SELECT discount_tranche, SUM(profit) AS profit, SUM(sales) AS ca
FROM fact_sales GROUP BY discount_tranche;

-- Marge par sous-catégorie
SELECT p.sub_category, SUM(f.profit) * 100.0 / SUM(f.sales) AS marge
FROM fact_sales f
JOIN dim_produit p ON f.product_key = p.produit_key
GROUP BY p.sub_category ORDER BY marge;

## Erreurs fréquentes à éviter
- Écrire product_key côté dim_produit : la clé primaire s'appelle produit_key.
- Écrire location_key côté dim_localite : la clé primaire s'appelle localite_key.
- Moyenne de ratios au lieu d'un ratio de sommes.
- Compter les lignes au lieu des commandes distinctes.
- Joindre dim_date sur ship_date_key pour une analyse par année : ce serait l'année d'expédition.

## TABLE fact_sales
Rôle : faits de ventes, une ligne = une ligne de commande (un produit dans une commande).
Grain : une ligne de commande. Une commande (order_id) a plusieurs lignes.
Colonnes :
- `row_id` (entier) - identifiant unique de la ligne.
- `order_id` (texte) - numéro de commande, ex. CA-2016-152156.
- `order_date_key` (entier) - date de commande, clé vers dim_date.date_key.
- `ship_date_key` (entier) - date d'expédition, clé vers dim_date.date_key.
- `client_key` (entier) - clé vers dim_client.client_key.
- `product_key` (entier) - clé vers dim_produit.produit_key.
- `location_key` (entier) - clé vers dim_localite.localite_key.
- `ship_mode_key` (entier) - clé vers dim_shipping_mode.ship_mode_key.
- `sales` (décimal) - chiffre d'affaires de la ligne ($).
- `quantity` (entier) - quantité vendue.
- `discount` (décimal) - taux de remise, de 0 à 1.
- `discount_tranche` (texte) - tranche de remise : '0 %' (remise nulle), '1 à 10 %' (0 < remise <= 0.10), '11 à 20 %' (0.10 < remise <= 0.20), '21 à 30 %' (0.20 < remise <= 0.30), '31 à 50 %' (0.30 < remise <= 0.50), 'plus de 50 %' (remise > 0.50).
- `profit` (décimal) - profit de la ligne ($), négatif si perte.
- `discount_amount` (décimal) - montant de la remise ($) = sales * discount.
- `shipping_time` (entier) - délai de livraison en jours (date d'expédition - date de commande).
- `is_sold_at_a_loss` (booléen) - vrai si profit < 0, au niveau de la ligne.
Jointures : dim_date (order_date_key, ship_date_key), dim_client, dim_produit, dim_localite, dim_shipping_mode (voir jointures standard).

## TABLE fact_orders
Rôle : faits agrégés par commande, pour les analyses au niveau de la commande (commandes à perte).
Grain : une commande entière (order_id est la clé primaire).
Colonnes :
- `order_id` (texte) - numéro de commande, clé primaire.
- `order_date_key` (entier) - clé vers dim_date.date_key.
- `client_key` (entier) - clé vers dim_client.client_key.
- `ship_mode_key` (entier) - clé vers dim_shipping_mode.ship_mode_key.
- `order_sales` (décimal) - chiffre d'affaires total de la commande ($).
- `order_profit` (décimal) - profit total de la commande ($).
- `number_of_products` (entier) - nombre de lignes de la commande.
- `is_sold_at_a_loss` (booléen) - vrai si order_profit < 0 (commande à perte).
Attention : pas de produit ni de localité dans cette table. Pour ces axes, partir de fact_sales.
Jointures : dim_date, dim_client, dim_shipping_mode ; fact_sales via order_id.

## TABLE dim_date
Rôle : calendrier. Sert aux analyses par année, trimestre, mois.
Grain : un jour. Contient aussi quelques jours de début 2018 (dates d'expédition des dernières commandes) : aucune commande n'est passée en 2018.
Colonnes :
- `date_key` (entier) - format AAAAMMJJ, ex. 20161108. Clé primaire.
- `date` (date) - date complète.
- `annee` (entier) - année. Années de commande : 2014 à 2017.
- `trimestre` (entier) - de 1 à 4.
- `annee_trimestre` (texte) - ex. '2016-T4'.
- `mois` (entier) - de 1 à 12.
- `annee_mois` (texte) - ex. '2016-11', à utiliser pour les courbes mensuelles.
- `nom_mois` (texte) - nom du mois en français, sans accent (Fevrier, Aout, Decembre).
- `semaine_iso` (entier) - numéro de semaine ISO.
- `jour_semaine` (entier) - 1 (lundi) à 7 (dimanche).
Jointures : dim_date.date_key = fact_sales.order_date_key (ou ship_date_key), ou fact_orders.order_date_key.

## TABLE dim_client
Rôle : clients et leur segment.
Grain : un client.
Colonnes :
- `client_key` (entier) - clé primaire.
- `customer_id` (texte) - identifiant client, ex. CG-12520.
- `customer_name` (texte) - nom du client.
- `segment` (texte) - segment client. Valeurs : Consumer, Corporate, Home Office.
Jointures : dim_client.client_key = fact_sales.client_key ou fact_orders.client_key.

## TABLE dim_produit
Rôle : produits, sous-catégories et catégories.
Grain : un couple (product_id, product_name). Un même product_id peut porter deux noms.
Colonnes :
- `produit_key` (entier) - clé primaire (écrit en français).
- `product_id` (texte) - identifiant produit, ex. FUR-BO-10001798.
- `product_name` (texte) - nom du produit.
- `sub_category` (texte) - sous-catégorie. Valeurs : Accessories, Appliances, Art, Binders, Bookcases, Chairs, Copiers, Envelopes, Fasteners, Furnishings, Labels, Machines, Paper, Phones, Storage, Supplies, Tables.
- `category` (texte) - catégorie. Valeurs : Furniture, Office Supplies, Technology.
Jointures : dim_produit.produit_key = fact_sales.product_key.

## TABLE dim_localite
Rôle : lieux de livraison aux États-Unis.
Grain : un lieu (pays, région, état, ville, code postal).
Colonnes :
- `localite_key` (entier) - clé primaire (écrit en français).
- `country` (texte) - pays. Valeur : United States.
- `region` (texte) - région commerciale. Valeurs : Central, East, South, West.
- `state` (texte) - état américain.
- `city` (texte) - ville.
- `postal_code` (texte) - code postal sur 5 chiffres, peut commencer par 0.
Jointures : dim_localite.localite_key = fact_sales.location_key.

## TABLE dim_shipping_mode
Rôle : modes d'expédition.
Grain : un mode d'expédition.
Colonnes :
- `ship_mode_key` (entier) - clé primaire.
- `ship_mode` (texte) - mode d'expédition. Valeurs : First Class, Same Day, Second Class, Standard Class.
Jointures : dim_shipping_mode.ship_mode_key = fact_sales.ship_mode_key ou fact_orders.ship_mode_key.
