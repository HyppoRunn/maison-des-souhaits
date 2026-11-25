// Connexion à Supabase (Project Settings > API dans Supabase).
// Ces deux valeurs sont publiques par conception : elles ne donnent accès
// qu'aux fonctions protégées par le code familial (voir supabase/schema.sql).
// Laissées vides, le site tourne en « mode démo » : les souhaits restent
// sur l'appareil, rien n'est partagé.
window.MDS_CONFIG = {
  supabaseUrl: "https://ujkkgvqgeincacttpnoc.supabase.co",
  supabaseAnonKey: "sb_publishable_lg487NpS30h9OJPxXpz1hA_bXXocP2N"
};
