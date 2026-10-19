(function () {
  const M = window.MoteurPoesie;
  const LANGUE_VOIX = { fr: 'fr-FR', ar: 'ar-SA' };
  const CLE_STOCKAGE = 'poesie-et-rimes:poemes';
  const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;

  const $ = (sel) => document.querySelector(sel);
  const creer = (tag, classe, texte) => {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texte != null) el.textContent = texte;
    return el;
  };

  const etat = {
    filtre: 'tous',
    poeme: null,
    mode: 'tout',
    vers: 0,
    memoire: false,
    reco: null,
    ecoute: false,
    final: '',
    interim: '',
    resultat: null,
  };

  // ---------- Poèmes ajoutés par l'enseignant (stockés dans le navigateur) ----------

  function poemesPerso() {
    try { return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || []; } catch { return []; }
  }
  function sauverPerso(liste) {
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(liste)); } catch { /* stockage indisponible */ }
  }
  const tousLesPoemes = () => POEMES.concat(poemesPerso());

  // ---------- Écran d'accueil ----------

  function afficherListe() {
    const liste = $('#liste');
    liste.innerHTML = '';
    tousLesPoemes()
      .filter((p) => etat.filtre === 'tous' || p.langue === etat.filtre)
      .forEach((p) => {
        const carte = creer('button', 'poeme-carte');
        carte.dir = p.langue === 'ar' ? 'rtl' : 'ltr';
        carte.append(
          creer('span', 'drapeau', p.langue === 'ar' ? 'العربية' : 'Français'),
          creer('h3', p.langue === 'ar' ? 'ar' : '', p.titre),
          creer('p', p.langue === 'ar' ? 'ar' : '', p.auteur || ''),
        );
        if (p.perso) {
          const suppr = creer('span', 'suppr', '🗑');
          suppr.title = 'Supprimer · حذف';
          suppr.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Supprimer « ' + p.titre + ' » ?')) {
              sauverPerso(poemesPerso().filter((x) => x.id !== p.id));
              afficherListe();
            }
          });
          carte.append(suppr);
        }
        carte.addEventListener('click', () => ouvrirPoeme(p));
        liste.append(carte);
      });
  }

  // ---------- Écran de récitation ----------

  const lignesNonVides = () => etat.poeme.vers.map((v, i) => (v.trim() ? i : -1)).filter((i) => i >= 0);
  const segment = () => (etat.mode === 'tout' ? lignesNonVides() : [etat.vers]);

  function ouvrirPoeme(p) {
    etat.poeme = p;
    etat.vers = lignesNonVides()[0];
    $('#accueil').hidden = true;
    $('#lecture').hidden = false;
    const titre = $('#titre');
    titre.textContent = p.titre;
    titre.className = p.langue === 'ar' ? 'ar' : '';
    $('#auteur').textContent = p.auteur || '';
    $('#lecture .carte').dir = p.langue === 'ar' ? 'rtl' : 'ltr';
    reinitialiser();
    window.scrollTo(0, 0);
  }

  function fermerPoeme() {
    arreterEcoute(true);
    speechSynthesis.cancel();
    $('#lecture').hidden = true;
    $('#accueil').hidden = false;
  }

  function reinitialiser() {
    etat.final = '';
    etat.interim = '';
    etat.resultat = null;
    $('#saisie').value = '';
    cacherAlerte();
    afficherTexte();
    afficherTranscription();
    afficherResultat();
  }

  function afficherTexte() {
    const p = etat.poeme;
    const boite = $('#texte');
    boite.dir = p.langue === 'ar' ? 'rtl' : 'ltr';
    boite.className = 'texte lang-' + p.langue
      + (etat.mode === 'vers' ? ' mode-vers' : '')
      + (etat.memoire && !etat.resultat ? ' masque' : '');
    boite.innerHTML = '';
    const actifs = new Set(segment());
    const r = etat.resultat;

    p.vers.forEach((ligne, i) => {
      if (!ligne.trim()) { boite.append(creer('div', 'strophe')); return; }
      const div = creer('div', 'vers' + (actifs.has(i) ? ' actif' : ''));
      if (etat.mode === 'vers') div.addEventListener('click', () => allerAuVers(i));
      if (r && i === segment()[0]) r.ajoutesAuDebut.forEach((a) => div.append(creer('span', 'ajout', a), ' '));

      M.decouper(ligne, p.langue).forEach((mot, j) => {
        if (mot.affiche === '/') { div.append(creer('span', 'sep')); return; }
        const span = creer('span', 'mot');
        span.append(creer('span', '', mot.affiche));
        const info = r && actifs.has(i) && r.mots[i + ':' + j];
        if (info) {
          span.dataset.etat = info.etat;
          if (info.entendu.length) {
            span.append(creer('span', 'dit', info.entendu.join(' ')));
            span.title = 'Entendu · سُمِع : ' + info.entendu.join(' ');
          }
          if (info.etat === 'oublie') span.title = 'Oublié · نُسِي';
        }
        div.append(span, ' ');
        if (info) info.ajoutes.forEach((a) => div.append(creer('span', 'ajout', a), ' '));
      });
      boite.append(div);
    });
  }

  function allerAuVers(i) {
    if (etat.ecoute) return;
    etat.vers = i;
    reinitialiser();
  }

  function versSuivant() {
    const lignes = lignesNonVides();
    const k = lignes.indexOf(etat.vers);
    if (k < lignes.length - 1) allerAuVers(lignes[k + 1]);
  }

  function texteDuSegment() {
    return segment().map((i) => etat.poeme.vers[i].replace(/\s\/\s/g, ', ')).join('\n');
  }

  // ---------- Synthèse vocale ----------

  function parler(texte, langue, vitesse) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = LANGUE_VOIX[langue];
    u.rate = vitesse || 0.85;
    const voix = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith(langue));
    if (voix) u.voice = voix;
    speechSynthesis.speak(u);
  }

  // ---------- Reconnaissance vocale ----------

  function demarrerEcoute() {
    if (!Reconnaissance) {
      montrerAlerte('Ce navigateur ne sait pas écouter. Utilise Google Chrome ou Safari, ou écris le poème ci-dessous. · هذا المتصفح لا يدعم الميكروفون، استعمل Chrome.');
      return;
    }
    speechSynthesis.cancel();
    reinitialiser();

    const reco = new Reconnaissance();
    reco.lang = LANGUE_VOIX[etat.poeme.langue];
    reco.continuous = true;
    reco.interimResults = true;

    reco.onresult = (e) => {
      let interim = '';
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const t = e.results[k][0].transcript;
        if (e.results[k].isFinal) etat.final += ' ' + t;
        else interim += t;
      }
      etat.interim = interim;
      afficherTranscription();
    };
    reco.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        etat.ecoute = false;
        montrerAlerte('Le micro est bloqué. Autorise le micro dans le navigateur. · الميكروفون غير مسموح، فعّله في المتصفح.');
      } else if (e.error === 'network') {
        etat.ecoute = false;
        montrerAlerte('Pas de connexion internet : la reconnaissance vocale en a besoin. · خاص الأنترنيت باش يخدم الميكروفون.');
      }
    };
    // Le navigateur coupe l'écoute après un silence : on relance tant que l'enfant n'a pas fini.
    reco.onend = () => {
      if (etat.ecoute) {
        try { reco.start(); return; } catch { etat.ecoute = false; }
      }
      terminerAnalyse(reco);
    };

    etat.reco = reco;
    etat.ecoute = true;
    reco.start();
    majBoutonMicro();
  }

  function arreterEcoute(annuler) {
    const reco = etat.reco;
    etat.ecoute = false;
    majBoutonMicro();
    if (!reco) return;
    if (annuler) { etat.reco = null; reco.abort(); return; }
    reco.stop();
    // Filet de sécurité si le navigateur ne déclenche pas « onend ».
    setTimeout(() => terminerAnalyse(reco), 2500);
  }

  function terminerAnalyse(reco) {
    if (etat.reco !== reco) return;
    etat.reco = null;
    etat.ecoute = false;
    majBoutonMicro();
    analyser((etat.final + ' ' + etat.interim).trim());
  }

  function majBoutonMicro() {
    const b = $('#btn-micro');
    b.classList.toggle('ecoute', etat.ecoute);
    b.textContent = etat.ecoute ? '⏹ J\'ai fini · انتهيت' : '🎤 Réciter · سمّع';
  }

  // ---------- Correction ----------

  function analyser(texte) {
    etat.interim = '';
    if (!texte) {
      if ($('#alerte').hidden) montrerAlerte('Je n\'ai rien entendu. Parle plus fort et réessaie ! · لم أسمع شيئا، تكلّم بصوت أعلى.');
      afficherTranscription();
      return;
    }
    etat.final = texte;
    etat.resultat = M.comparer(etat.poeme.vers, segment(), texte, etat.poeme.langue);
    afficherTexte();
    afficherTranscription();
    afficherResultat();
    const msg = messagePour(etat.resultat.score, etat.poeme.langue);
    parler(msg.replace(/[^\p{L}\p{N}\s!,.'’]/gu, ''), etat.poeme.langue, 1);
  }

  function messagePour(score, langue) {
    const ar = langue === 'ar';
    if (score >= 95) return ar ? 'ممتاز! أحسنت 🌟' : 'Bravo ! C\'est parfait ! 🌟';
    if (score >= 80) return ar ? 'جيد جدا! بقيت أخطاء صغيرة.' : 'Très bien ! Il reste quelques petites erreurs.';
    if (score >= 50) return ar ? 'لا بأس! انظر إلى الكلمات الحمراء وأعد المحاولة.' : 'Pas mal ! Regarde les mots en rouge et réessaie.';
    return ar ? 'حاول مرة أخرى! استمع إلى القصيدة أولا.' : 'Courage ! Écoute le poème puis réessaie.';
  }

  function afficherResultat() {
    const boite = $('#resultat');
    const r = etat.resultat;
    boite.hidden = !r;
    if (!r) return;
    boite.innerHTML = '';
    boite.dir = etat.poeme.langue === 'ar' ? 'rtl' : 'ltr';

    const etoiles = r.score >= 95 ? 3 : r.score >= 75 ? 2 : r.score >= 40 ? 1 : 0;
    const score = creer('div', 'score', r.score + ' %');
    score.dir = 'ltr';
    boite.append(
      creer('div', 'etoiles', '★'.repeat(etoiles) + '☆'.repeat(3 - etoiles)),
      score,
      creer('p', 'message' + (etat.poeme.langue === 'ar' ? ' ar' : ''), messagePour(r.score, etat.poeme.langue)),
    );

    const c = r.compte;
    const legende = creer('div', 'legende');
    legende.dir = 'ltr';
    legende.append(creer('span', 'l-ok', '✓ ' + c.ok + ' justes · صحيح'));
    if (c.proche) legende.append(creer('span', 'l-proche', '≈ ' + c.proche + ' presque · تقريبا'));
    if (c.faux) legende.append(creer('span', 'l-faux', '✗ ' + c.faux + ' faux · خطأ'));
    if (c.oublie) legende.append(creer('span', 'l-oublie', '… ' + c.oublie + ' oubliés · منسي'));
    if (c.ajoute) legende.append(creer('span', 'l-ajout', '+ ' + c.ajoute + ' en trop · زائد'));
    boite.append(legende);

    const actions = creer('div', 'actions');
    const rejouer = creer('button', 'btn secondaire', '↻ Réessayer · أعد');
    rejouer.addEventListener('click', reinitialiser);
    actions.append(rejouer);
    const lignes = lignesNonVides();
    if (etat.mode === 'vers' && etat.vers !== lignes[lignes.length - 1]) {
      const suivant = creer('button', 'btn', 'Vers suivant · البيت التالي →');
      suivant.addEventListener('click', versSuivant);
      actions.append(suivant);
    }
    boite.append(actions);
  }

  function afficherTranscription() {
    const p = $('#transcription');
    const texte = (etat.final + ' ' + etat.interim).trim();
    p.hidden = !texte;
    p.className = 'transcription lang-' + etat.poeme.langue;
    p.dir = etat.poeme.langue === 'ar' ? 'rtl' : 'ltr';
    p.textContent = '🗣 ' + texte;
  }

  function montrerAlerte(msg) {
    const a = $('#alerte');
    a.textContent = msg;
    a.hidden = false;
  }
  function cacherAlerte() { $('#alerte').hidden = true; }

  // ---------- Ajout d'un poème ----------

  function ouvrirAjout() {
    $('#form-ajout').reset();
    $('#fenetre-ajout').showModal();
  }

  function enregistrerAjout(form) {
    const d = new FormData(form);
    const vers = String(d.get('texte')).replace(/\r/g, '').split('\n').map((l) => l.trim());
    while (vers.length && !vers[vers.length - 1]) vers.pop();
    while (vers.length && !vers[0]) vers.shift();
    if (!vers.length) return;
    const poeme = {
      id: 'perso-' + Date.now(),
      titre: String(d.get('titre')).trim(),
      auteur: String(d.get('auteur')).trim(),
      langue: d.get('langue'),
      vers,
      perso: true,
    };
    sauverPerso(poemesPerso().concat(poeme));
    afficherListe();
  }

  // ---------- Branchements ----------

  document.querySelectorAll('.filtres button').forEach((b) => b.addEventListener('click', () => {
    etat.filtre = b.dataset.filtre;
    document.querySelectorAll('.filtres button').forEach((x) => x.classList.toggle('actif', x === b));
    afficherListe();
  }));

  document.querySelectorAll('.bascule button').forEach((b) => b.addEventListener('click', () => {
    if (etat.ecoute) return;
    etat.mode = b.dataset.mode;
    document.querySelectorAll('.bascule button').forEach((x) => x.classList.toggle('actif', x === b));
    reinitialiser();
  }));

  $('#memoire').addEventListener('change', (e) => { etat.memoire = e.target.checked; afficherTexte(); });
  $('#btn-retour').addEventListener('click', fermerPoeme);
  $('#btn-ecouter').addEventListener('click', () => parler(texteDuSegment(), etat.poeme.langue));
  $('#btn-micro').addEventListener('click', () => (etat.ecoute ? arreterEcoute(false) : demarrerEcoute()));
  $('#btn-verifier').addEventListener('click', () => { cacherAlerte(); analyser($('#saisie').value.trim()); });
  $('#btn-ajouter').addEventListener('click', ouvrirAjout);
  $('#form-ajout').addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'ok') enregistrerAjout(e.target);
  });

  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  afficherListe();
})();
