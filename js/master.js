// Teló Final — panell del màster
(function () {
  const { rpc, escoltaEstat, FASES, esc, $, $$ } = window.Telo;
  let pwd = null; let dades = null; let creant = false;

  const ORDRE_FASES = [
    ['preparacio', 'Preparació'], ['aperitiu', 'Aperitiu'], ['acte1', '1r acte'], ['entreacte', 'Entreacte (informe forense)'],
    ['acte2', '2n acte (rumor)'], ['votacio', 'Obrir votació'], ['tancat', 'Tancar votació']
  ];

  const base = location.origin + location.pathname.replace(/master(\.html)?$/, '');
  const urlJugador = (codi) => base + (codi ? '?c=' + codi : '');

  function qrSvg(text, cell) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: cell || 4, margin: 2, scalable: true });
  }

  function error(msg) { const e = $('#error-general'); e.textContent = msg; e.hidden = !msg; if (msg) setTimeout(() => { e.hidden = true; }, 6000); }

  async function crida(nom, params) {
    try {
      const r = await rpc(nom, Object.assign({ p_pwd: pwd }, params || {}));
      if (r && r.jugadors) { dades = r; pinta(); }
      return r;
    } catch (e) { error(e.message); throw e; }
  }

  // ---------- Login ----------
  async function iniciLogin() {
    const existeix = await rpc('master_existeix');
    creant = !existeix;
    $('#login-titol').textContent = creant ? 'Crea la contrasenya de màster' : 'Entra com a màster';
    $('#login-text').textContent = creant ? 'És la primera vegada. Tria una contrasenya (mínim 6 caràcters) i no la comparteixis amb els jugadors.' : 'Escriu la contrasenya de màster.';
    $('#camp-pwd2').hidden = !creant;
    $('#login-boto').textContent = creant ? 'Crea i entra' : 'Entra';
    let guardada = null; try { guardada = sessionStorage.getItem('telo-master'); } catch (e) {}
    if (guardada && !creant && await rpc('master_entrar', { p_pwd: guardada })) { pwd = guardada; return entra(); }
    $('#vista-login').hidden = false;
  }

  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#login-error'); err.hidden = true;
    const p = $('#pwd').value;
    try {
      if (creant) {
        if (p !== $('#pwd2').value) throw new Error('Les dues contrasenyes no coincideixen.');
        await rpc('master_init', { p_pwd: p });
      } else if (!(await rpc('master_entrar', { p_pwd: p }))) {
        throw new Error('Contrasenya incorrecta.');
      }
      pwd = p; try { sessionStorage.setItem('telo-master', p); } catch (e) {}
      entra();
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  });

  async function entra() {
    $('#vista-login').hidden = true;
    $('#vista-panell').hidden = false;
    await carrega();
    escoltaEstat(() => carrega(), 4000);
  }

  async function carrega() {
    try { dades = await rpc('master_estat', { p_pwd: pwd }); pinta(); } catch (e) { error(e.message); }
  }

  // ---------- Pintar ----------
  function pinta() {
    if (!dades) return;
    const e = dades.estat; const js = dades.jugadors;
    $('#fase-actual').textContent = (FASES[e.fase] || {}).nom || e.fase;
    $('#fase-text').textContent = (FASES[e.fase] || {}).text || '';
    $('#fases').innerHTML = ORDRE_FASES.map(([k, n]) =>
      '<button class="boto-sec' + (e.fase === k ? ' actual' : '') + '" data-fase="' + k + '">' + esc(n) + '</button>').join('');
    $('#n-jugadors').textContent = js.length;
    $('#n-vots').textContent = e.fase === 'preparacio' || e.fase === 'aperitiu'
      ? js.filter(j => j.obert).length + '/' + js.length : js.filter(j => j.ha_votat).length + '/' + js.length;
    $('#n-vots').nextElementSibling.textContent = e.fase === 'preparacio' || e.fase === 'aperitiu' ? 'han entrat' : 'han votat';
    $('#n-missions').textContent = js.filter(j => j.missio_feta).length;
    $('#rev-pantalla').checked = e.revelat_pantalla;
    $('#rev-mobils').checked = e.revelat_mobils;

    const urlP = base + 'pantalla.html?k=' + (dades.pantalla_token || '');
    $('#url-pantalla').textContent = urlP; $('#url-pantalla').href = urlP;
    $('#url-jugadors').textContent = urlJugador(); $('#url-jugadors').href = urlJugador();

    // Peticions
    let h = '';
    dades.validacions.forEach(v => {
      h += '<div class="avis"><b>' + esc(v.nom_real) + '</b> (' + esc(v.personatge) + ') demana validació:<br><span class="petit">' + esc(v.missio) + '</span>' +
        '<div class="fila" style="margin-top:8px"><button class="boto mini" data-validar="' + v.id + '" data-si="1">Validar</button><button class="boto-sec mini" data-validar="' + v.id + '" data-si="0">Rebutjar</button></div></div>';
    });
    dades.rumors.filter(r => r.estat === 'pendent').forEach(r => {
      h += '<div class="avis" style="border-color:var(--corall)"><b>Rumor anònim de l\'assassina</b> (pendent):' +
        '<textarea data-rumor-text="' + r.id + '" maxlength="140" style="min-height:70px;margin-top:6px">' + esc(r.text) + '</textarea>' +
        '<div class="fila" style="margin-top:8px"><button class="boto mini" data-rumor="' + r.id + '" data-si="1">Publicar</button><button class="boto-sec mini" data-rumor="' + r.id + '" data-si="0">Rebutjar</button></div></div>';
    });
    const aprovat = dades.rumors.find(r => r.estat === 'aprovat');
    if (aprovat) h += '<p class="petit suau">Rumor publicat: «' + esc(aprovat.text) + '»</p>';
    $('#peticions').innerHTML = h || '<p class="petit suau">No hi ha res pendent.</p>';

    // Jugadors
    $('#sense-jugadors').hidden = js.length > 0;
    $('#amb-jugadors').hidden = js.length === 0;
    $('#taula-jugadors').innerHTML = js.map(j =>
      '<tr><td><b>' + esc(j.nom_real) + '</b></td>' +
      '<td>' + j.num + '. ' + esc(j.personatge) + ' <span class="suau petit">· ' + esc(j.rol) + '</span>' +
      (j.paper !== 'innocent' ? ' <span class="paper-dolent">' + (j.paper === 'assassi' ? 'assassina' : 'còmplice') + '</span>' : '') + '</td>' +
      '<td><span class="codi">' + esc(j.codi) + '</span></td>' +
      '<td>' + (j.obert ? '<span class="ok-si">✓</span> <button class="boto-sec mini" data-alliberar="' + j.codi + '" data-nom="' + esc(j.nom_real) + '" title="Permet tornar a obrir aquest nom en un altre mòbil">Desbloqueja</button>' : '<span class="ok-no">—</span>') + '</td>' +
      '<td>' + (j.missio_tipus === 'vot' ? '<span class="ok-no" title="Es comprova al final">al final</span>' : (j.missio_feta ? '<span class="ok-si">✓</span>' : '<span class="ok-no">' + (j.missio_progres || '—') + '</span>')) + '</td>' +
      '<td>' + (j.ha_votat ? '<span class="ok-si">✓</span>' : '<span class="ok-no">—</span>') + '</td>' +
      '<td class="fila" style="flex-wrap:nowrap"><button class="boto-sec mini" data-qr="' + j.codi + '" data-nom="' + esc(j.nom_real) + '">QR</button>' +
      '<button class="boto-sec mini" data-renom="' + j.codi + '" data-nom="' + esc(j.nom_real) + '">Canvia nom</button>' +
      (j.paper === 'innocent' ? '<button class="boto-sec mini" data-treure="' + j.codi + '" data-nom="' + esc(j.nom_real) + '">Treu</button>' : '') + '</td></tr>').join('');
    const sols = js.filter(j => j.coartada_sola).map(j => j.personatge);
    $('#avis-coartades').textContent = sols.length ? 'Sense testimoni de coartada (avui no hi ha la seva parella): ' + sols.join(', ') + '. És normal amb menys de 22 jugadors.' : '';
  }

  // ---------- Accions ----------
  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.fase) {
        const f = t.dataset.fase;
        if (f === 'preparacio' && !confirm('Tornar a «Preparació»? Els jugadors no podran fer missions.')) return;
        await crida('master_fase', { p_fase: f });
      } else if (t.dataset.validar) {
        await crida('master_validar', { p_id: +t.dataset.validar, p_si: t.dataset.si === '1' });
      } else if (t.dataset.rumor) {
        const text = $('[data-rumor-text="' + t.dataset.rumor + '"]').value;
        await crida('master_rumor', { p_id: +t.dataset.rumor, p_aprovar: t.dataset.si === '1', p_text: text });
      } else if (t.dataset.qr) {
        const url = urlJugador(t.dataset.qr);
        obreModal('<h2 style="font-family:var(--font-display);color:var(--daurat);margin:0">' + esc(t.dataset.nom) + '</h2>' + qrSvg(url, 6) +
          '<p class="codi-personal">' + esc(t.dataset.qr) + '</p><p class="petit enllac">' + esc(url) + '</p><button class="boto boto-ample" data-tanca>Tanca</button>');
      } else if (t.dataset.renom) {
        const nou = prompt('Nou nom per a aquest personatge (' + t.dataset.nom + '):', t.dataset.nom);
        if (nou && nou.trim()) await crida('master_canviar_nom', { p_codi: t.dataset.renom, p_nom: nou.trim() });
      } else if (t.dataset.alliberar) {
        if (confirm('Desbloquejar ' + t.dataset.nom + '? Podrà tornar a triar el seu nom des d\'un altre mòbil.')) await crida('master_alliberar', { p_codi: t.dataset.alliberar });
      } else if (t.dataset.treure) {
        if (confirm('Treure ' + t.dataset.nom + ' de la partida? El seu personatge quedarà lliure.')) await crida('master_treure', { p_codi: t.dataset.treure });
      } else if (t.dataset.tanca !== undefined) {
        $('#modal').hidden = true;
      } else if (t.id === 'repartir') {
        const noms = $('#noms').value.split('\n').map(s => s.trim()).filter(Boolean);
        if (new Set(noms.map(n => n.toLowerCase())).size !== noms.length && !confirm('Hi ha noms repetits. Continuar igualment?')) return;
        await crida('master_preparar', { p_noms: noms });
      } else if (t.id === 'afegir') {
        const n = $('#nou-nom').value.trim(); if (!n) return;
        await crida('master_afegir', { p_nom: n }); $('#nou-nom').value = '';
      } else if (t.id === 'reiniciar') {
        if (!confirm('Segur que vols reiniciar? S\'esborraran els jugadors, els vots i les missions.')) return;
        if (!confirm('Segur del tot? No es pot desfer.')) return;
        await crida('master_reiniciar');
      } else if (t.id === 'imprimir') {
        imprimeix();
      } else if (t.id === 'qr-general') {
        obreModal('<h2 style="font-family:var(--font-display);color:var(--daurat);margin:0">Web dels jugadors</h2>' + qrSvg(urlJugador(), 6) + '<p class="petit enllac">' + esc(urlJugador()) + '</p><button class="boto boto-ample" data-tanca>Tanca</button>');
      }
    } catch (e) { /* ja s'ha mostrat */ }
  });

  $('#rev-pantalla').addEventListener('change', () => revela());
  $('#rev-mobils').addEventListener('change', () => revela());
  async function revela() {
    const p = $('#rev-pantalla').checked, m = $('#rev-mobils').checked;
    if ((p || m) && dades && dades.estat.fase !== 'tancat' && dades.estat.fase !== 'revelacio') {
      if (!confirm('La votació encara no està tancada. Vols revelar igualment?')) { pinta(); return; }
    }
    try { await crida('master_revelar', { p_pantalla: p, p_mobils: m }); } catch (e) { pinta(); }
  }

  $('#noms').addEventListener('input', () => {
    const n = $('#noms').value.split('\n').map(s => s.trim()).filter(Boolean).length;
    $('#compta-noms').textContent = n + ' noms' + (n && n < 8 ? ' (en calen almenys 8)' : n > 28 ? ' (màxim 28)' : '');
  });

  $('#det-resultats').addEventListener('toggle', async (ev) => {
    if (!ev.target.open) return;
    try {
      const r = await rpc('master_resultats', { p_pwd: pwd });
      $('#resultats-prov').innerHTML = '<p>Vots: ' + r.vots_totals + '</p>' +
        r.recompte.map(x => '<div>' + esc(x.nom) + ': <b>' + x.vots + '</b></div>').join('') +
        '<p style="margin-top:8px"><b>Top 5</b></p>' + r.ranking.slice(0, 5).map((x, i) => '<div>' + (i + 1) + '. ' + esc(x.nom_real) + ' — ' + x.punts + ' punts</div>').join('');
    } catch (e) { error(e.message); }
  });

  function obreModal(html) { const m = $('#modal'); m.innerHTML = '<div class="modal">' + html + '</div>'; m.hidden = false; }

  function imprimeix() {
    if (!dades || !dades.jugadors.length) return;
    $('#impressio').innerHTML = dades.jugadors.map(j => {
      const url = urlJugador(j.codi);
      return '<div class="tiquet"><div class="t-nom">' + esc(j.nom_real) + '</div><div class="t-pers">Teló Final · ' + esc(j.personatge) + '</div>' +
        qrSvg(url, 3) + '<div class="t-codi">' + esc(j.codi) + '</div><div class="t-url">' + esc(urlJugador()) + '</div></div>';
    }).join('');
    window.print();
  }

  iniciLogin().catch(e => error(e.message));
})();
