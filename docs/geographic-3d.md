# Carte 3D géographique

La vue 3D utilise les contours OpenStreetMap, chargés autour de l'itinéraire
Google Maps (marge de 350 mètres), avec la même projection métrique pour les
bâtiments, les rues, les points de livraison et le livreur.

- Les bâtiments sont extrudés à partir de leurs polygones, y compris les cours
  intérieures des multipolygones. Les bâtiments ne sont plus placés aléatoirement.
- `height` est utilisé lorsqu'il est renseigné, sinon `building:levels × 3 m`,
  sinon une estimation de 6 m. Les hauteurs estimées sont affichées en gris.
  `min_height` est préservé. Il n'y a pas d'exagération verticale.
- Les rues, plans d'eau, parcs et forêts proviennent des géométries OSM.
  Les largeurs de rues non renseignées sont estimées selon la catégorie.
  Le littoral est un tracé ; aucun océan ni lagune rectangulaire n'est inventé.
- Les repères de livraison sont des annotations, pas des bâtiments réels.
- Le sol est neutre : cette version n'utilise pas d'images satellite Google
  ni de textures de façades reconstruites. Elle ne promet pas une couverture
  complète ou un rendu photoréaliste. Le relief est plat.

Le client interroge Overpass (overpass-api.de, puis private.coffee en secours),
avec un délai maximum de 35 secondes par instance. Les requêtes sont annulées
au changement de trajet ou à la fermeture de la vue. Six zones au maximum sont
gardées en mémoire pour la session. Une réponse partielle ou en erreur ne
remplace jamais les données par un décor inventé. L'utilisateur peut relancer
le chargement ou revenir à Maps 2D. Les zones dépassant 250 km² sont refusées.
Les serveurs publics peuvent être saturés ; cette dépendance doit être prise
en compte pour un déploiement à grande échelle.

## Exécution et vérification

Utiliser une version de Bun compatible avec `bun.lock` version 2 (validation
effectuée avec Bun 1.4.5). Configurer `VITE_GOOGLE_MAPS_API_KEY` comme indiqué
dans `.env.example` pour les itinéraires et la carte 2D.

```sh
bun install --frozen-lockfile
bun run lint
bun run build
bun x tsx --test src/utils/*.test.ts
```

Les tests couvrent les unités et hauteurs, l'alignement géographique, les cours
intérieures, les réponses vides/incomplètes, les limites de requête et le cache.

Sources : [OpenStreetMap / ODbL](https://www.openstreetmap.org/copyright),
[Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API),
[hauteurs OSM](https://wiki.openstreetmap.org/wiki/Key:height).
