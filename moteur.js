// Moteur de comparaison : aligne ce que l'enfant a dit avec le texte du poème.
(function (global) {
  const DIACRITIQUES_AR = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

  function normaliserMot(mot, langue) {
    let m = mot.toLowerCase();
    if (langue === 'ar') {
      m = m.replace(DIACRITIQUES_AR, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[^ء-ي0-9]/g, '');
    } else {
      m = m.replace(/œ/g, 'oe').replace(/æ/g, 'ae')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');
    }
    return m;
  }

  // Découpe un texte en mots affichables ; chaque mot porte ses clés normalisées.
  // L'apostrophe soude (« l'aube » → "laube"), le trait d'union sépare
  // (« dit-elle » → ["dit", "elle"]). La ponctuation seule n'a pas de clé.
  function decouper(texte, langue) {
    return texte.split(/\s+/).filter(Boolean).map((affiche) => ({
      affiche,
      cles: affiche.split(/[\-‑–—]+/).map((p) => normaliserMot(p, langue)).filter(Boolean),
    }));
  }

  // La reconnaissance vocale écrit parfois « l odeur » au lieu de « l'odeur »,
  // ou « و لا » au lieu de « ولا » : on recolle ces morceaux au mot suivant.
  const PREFIXES = {
    fr: new Set(['l', 'd', 'j', 'm', 'n', 's', 't', 'c', 'qu', 'jusqu', 'lorsqu', 'puisqu']),
    ar: new Set(['و']),
  };

  function souderPrefixes(cles, langue) {
    const res = [];
    for (let k = 0; k < cles.length; k++) {
      if (PREFIXES[langue].has(cles[k]) && k + 1 < cles.length) res.push(cles[k] + cles[++k]);
      else res.push(cles[k]);
    }
    return res;
  }

  function levenshtein(a, b) {
    let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cour = [i];
      for (let j = 1; j <= b.length; j++) {
        cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prec = cour;
    }
    return prec[b.length];
  }

  // Coûts entiers pour éviter les erreurs d'arrondi : exact 0, proche 4, faux 10, oubli/ajout 10.
  const COUT_PROCHE = 4;
  const COUT_FAUX = 10;
  const COUT_TROU = 10;

  function coutSubstitution(a, b) {
    if (a === b) return 0;
    const sim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    return sim >= 0.7 && Math.min(a.length, b.length) >= 3 ? COUT_PROCHE : COUT_FAUX;
  }

  function aligner(attendus, entendus) {
    const n = attendus.length;
    const m = entendus.length;
    const D = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = 0; i <= n; i++) D[i][0] = i * COUT_TROU;
    for (let j = 0; j <= m; j++) D[0][j] = j * COUT_TROU;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        D[i][j] = Math.min(
          D[i - 1][j - 1] + coutSubstitution(attendus[i - 1], entendus[j - 1]),
          D[i - 1][j] + COUT_TROU,
          D[i][j - 1] + COUT_TROU,
        );
      }
    }
    const ops = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0) {
        const c = coutSubstitution(attendus[i - 1], entendus[j - 1]);
        if (D[i][j] === D[i - 1][j - 1] + c) {
          ops.push({ type: c === 0 ? 'ok' : c === COUT_PROCHE ? 'proche' : 'faux', i: i - 1, entendu: entendus[j - 1] });
          i--; j--;
          continue;
        }
      }
      if (i > 0 && D[i][j] === D[i - 1][j] + COUT_TROU) {
        ops.push({ type: 'oublie', i: i - 1 });
        i--;
      } else {
        ops.push({ type: 'ajoute', entendu: entendus[j - 1] });
        j--;
      }
    }
    return ops.reverse();
  }

  const GRAVITE = { ok: 0, proche: 1, oublie: 2, faux: 3 };

  // vers : tableau de lignes du poème ; indices : lignes à vérifier.
  // Renvoie l'état de chaque mot, indexé par "ligne:mot".
  function comparer(vers, indices, texteEntendu, langue) {
    const attendus = [];
    indices.forEach((i) => {
      decouper(vers[i], langue).forEach((mot, j) => {
        mot.cles.forEach((cle) => attendus.push({ cle, cleMot: i + ':' + j }));
      });
    });
    const entendus = souderPrefixes(decouper(texteEntendu, langue).flatMap((m) => m.cles), langue);
    const ops = aligner(attendus.map((a) => a.cle), entendus);

    const mots = {};
    const ajoutesAuDebut = [];
    const compte = { ok: 0, proche: 0, faux: 0, oublie: 0, ajoute: 0 };
    let dernier = null;
    for (const op of ops) {
      if (op.type === 'ajoute') {
        compte.ajoute++;
        (dernier ? mots[dernier].ajoutes : ajoutesAuDebut).push(op.entendu);
        continue;
      }
      compte[op.type]++;
      const a = attendus[op.i];
      const m = mots[a.cleMot] || (mots[a.cleMot] = { etat: 'ok', entendu: [], ajoutes: [] });
      if (GRAVITE[op.type] > GRAVITE[m.etat]) m.etat = op.type;
      if (op.entendu && op.type !== 'ok') m.entendu.push(op.entendu);
      dernier = a.cleMot;
    }

    const total = attendus.length;
    const points = compte.ok + 0.75 * compte.proche - 0.25 * compte.ajoute;
    const score = total ? Math.round((100 * Math.max(0, points)) / total) : 0;
    return { mots, ajoutesAuDebut, compte, total, score };
  }

  const MoteurPoesie = { normaliserMot, decouper, aligner, comparer };
  if (typeof module !== 'undefined' && module.exports) module.exports = MoteurPoesie;
  else global.MoteurPoesie = MoteurPoesie;
})(typeof window !== 'undefined' ? window : globalThis);
