# La Maison des Souhaits

La liste de Noël de la famille, présentée comme un salon le soir de Noël. Chaque cadeau au pied du sapin peut porter un souhait : un prénom, le nom de l'article et un lien vers la page d'achat. Survoler un cadeau affiche le souhait, cliquer dessus ouvre l'article.

- Site statique (HTML, CSS, JavaScript, sans outil de build), hébergé sur GitHub Pages.
- Souhaits enregistrés dans [Supabase](https://supabase.com) (offre gratuite) et partagés avec toute la famille.
- Accès protégé par un code familial, vérifié côté Supabase : il n'apparaît jamais dans le code du site.
- Chaque souhait peut être modifié ou supprimé (« Libérer ce cadeau »).

Sans Supabase configuré, le site tourne en **mode démo** : les souhaits restent dans le navigateur.

## Mise en route

### 1. Créer la base Supabase

1. Créer un compte sur [supabase.com](https://supabase.com), puis **New project**. Choisir la région la plus proche (par exemple Paris) et noter le mot de passe proposé, même s'il ne servira pas ici.
2. Une fois le projet prêt, ouvrir **SQL Editor**, puis **New query**.
3. Copier tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) dans l'éditeur. **Tout en bas, remplacer `CHANGE-MOI` par le code familial** de votre choix (au moins 4 caractères).
4. Cliquer sur **Run**. Le message « Success. No rows returned » confirme que c'est en place.

### 2. Brancher le site sur la base

Dans Supabase, ouvrir **Project Settings › API** (ou **Connect**) et copier :

- **Project URL** (`https://xxxx.supabase.co`) ;
- la clé **publishable** (`sb_publishable_…`) ou, sur les anciens projets, la clé **anon public**.

Les coller dans [`config.js`](config.js). Ces deux valeurs sont publiques par conception : elles ne permettent que d'appeler les fonctions protégées par le code familial.

⚠️ Ne jamais mettre la clé **secret** / **service_role** dans le site.

### 3. Publier avec GitHub Pages

Dans le dépôt GitHub : **Settings › Pages**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`. Le site est en ligne quelques minutes plus tard à l'adresse `https://<compte>.github.io/maison-des-souhaits/`.

## Au quotidien

- **Changer le code familial** : dans Supabase › SQL Editor, lancer
  `update private.settings set family_code = 'nouveau-code' where id = 1;`
  Chacun devra saisir le nouveau code à sa prochaine visite.
- **Tout vider après Noël** : `delete from public.wishes;`
- **Voir les souhaits** : Supabase › Table Editor › `wishes`.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page |
| `style.css` | La mise en forme |
| `app.js` | Cadeaux cliquables, formulaires, échanges avec Supabase |
| `config.js` | Adresse et clé publique Supabase |
| `assets/salon.jpg` | L'image du salon (2000 × 1200) |
| `assets/scene.js` | Position de chaque cadeau et des lumières dans l'image |
| `supabase/schema.sql` | Table, fonctions et code familial |
| `tools/render-scene.html` | Le générateur de l'image du salon |

## Régénérer l'image du salon

L'image est calculée par `tools/render-scene.html` (canvas 2D, aléatoire avec une graine fixe). Pour la refaire, par exemple avec plus de cadeaux :

```bash
node tools/render.js
```

Le script, qui demande Playwright, écrit `assets/salon.jpg` et `assets/scene.js` avec les nouvelles positions. Les souhaits sont liés à un numéro de cadeau : si le nombre ou l'ordre des cadeaux change, réattribuer les souhaits existants.
