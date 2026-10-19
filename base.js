// Accès à la base partagée des poèmes ajoutés par les enseignants.
const Base = (() => {
  const actif = !!(window.supabase && CONFIG_BASE.url && CONFIG_BASE.cle);
  const client = actif ? window.supabase.createClient(CONFIG_BASE.url, CONFIG_BASE.cle) : null;

  async function verifier(requete) {
    const { data, error } = await requete;
    if (error) throw error;
    return data;
  }

  return {
    actif,
    lister: () => verifier(client.from('poemes').select('id, titre, auteur, langue, vers').order('created_at')),
    ajouter: (p) => verifier(client.from('poemes').insert({
      titre: p.titre, auteur: p.auteur, langue: p.langue, vers: p.vers,
    })),
    supprimer: (id) => verifier(client.from('poemes').delete().eq('id', id)),
    connecter: (email, motDePasse) => verifier(client.auth.signInWithPassword({ email, password: motDePasse })),
    deconnecter: () => client.auth.signOut(),
    // Appelle fn(utilisateur ou null) tout de suite, puis à chaque connexion / déconnexion.
    surSession: (fn) => client.auth.onAuthStateChange((_evt, session) => fn(session ? session.user : null)),
  };
})();
