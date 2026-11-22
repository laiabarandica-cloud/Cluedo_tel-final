// Teló Final — pantalla gran
(function () {
  const { rpc, escoltaEstat, FASES, esc, $ } = window.Telo;
  const clau = new URL(location.href).searchParams.get('k') || '';
  let resultats = null; let pas = 0; let revelant = false;

  const TEXTOS = {
    preparacio: 'Prepareu els mòbils: aviat comença la funció.',
    aperitiu: 'Escanegeu el QR, trieu el vostre nom i enganxeu-vos l\'etiqueta del vostre personatge.',
    acte1: 'Interrogueu-vos: coartades, pistes i missions. L\'assassí és entre nosaltres.',
    entreacte: 'Ha arribat l\'informe forense. Mireu-lo al mòbil.',
    acte2: 'Segon acte. Compte amb els rumors…',
    votacio: 'Voteu ara al mòbil: qui, amb què i on.',
    tancat: 'Votació tancada. Que baixi el teló…',
    revelacio: 'Teló final.'
  };

  async function inici() {
    if (!clau || !(await rpc('pantalla_valida', { p_clau: clau }))) {
      $('#escena').hidden = true;
      const e = $('#error'); e.hidden = false;
      e.innerHTML = '<h1 class="titol-joc" style="font-size:3em">TELÓ <span>FINAL</span></h1><p>Aquest enllaç de pantalla no és vàlid. Obre l\'enllaç «Pantalla gran» que trobaràs al panell del màster.</p>';
      return;
    }
    escoltaEstat(onEstat, 5000);
  }

  async function onEstat(e) {
    $('#fase').textContent = (FASES[e.fase] || {}).nom || e.fase;
    $('#text-fase').textContent = TEXTOS[e.fase] || '';
    $('#c-jugadors').textContent = e.jugadors;
    $('#caixa-vots').hidden = !['votacio', 'tancat', 'revelacio'].includes(e.fase);
    $('#c-vots').textContent = e.vots + '/' + e.jugadors;
    $('#rumor').hidden = !e.rumor; $('#rumor-text').textContent = e.rumor ? '«' + e.rumor + '»' : '';
    const ambQr = ['preparacio', 'aperitiu', 'acte1'].includes(e.fase);
    $('#qr-web').hidden = !ambQr;
    if (ambQr && !$('#qr-svg').innerHTML) {
      const url = location.origin + location.pathname.replace(/pantalla(\.html)?$/, '');
      const q = qrcode(0, 'M'); q.addData(url); q.make();
      $('#qr-svg').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      $('#qr-url').textContent = url.replace(/^https?:\/\//, '');
    }
    if (e.revelat_pantalla) {
      if (!revelant) {
        resultats = await rpc('resultats', { p_clau: clau });
        if (resultats) { revelant = true; pas = 0; pintaPas(); }
      } else {
        resultats = await rpc('resultats', { p_clau: clau }) || resultats;
      }
    } else if (revelant) {
      revelant = false; $('#revelacio').hidden = true;
    }
  }

  const PASSOS = 6;
  function pintaPas() {
    const r = resultats; const s = r.solucio; const el = $('#revelacio');
    el.hidden = false;
    let h = '';
    if (pas === 0) {
      const max = Math.max(1, ...r.recompte.map(x => x.vots));
      h = '<h2>Què heu votat?</h2><div class="barres">' + r.recompte.map(x =>
        '<div class="barra"><span>' + esc(x.nom) + '</span><div class="b" style="width:' + (x.vots / max * 100) + '%"></div><span class="n">' + x.vots + '</span></div>').join('') + '</div>';
      if (!r.recompte.length) h += '<p>No ha votat ningú.</p>';
    } else if (pas === 1) {
      h = '<h2>Qui va matar en Max Bambalina?</h2><img class="retrat" src="' + esc(s.assassi.img) + '" alt=""><div class="gran-nom">' + esc(s.assassi.nom) + '</div>' +
        (s.assassi.nom_real ? '<div class="real">' + esc(s.assassi.nom_real) + '</div>' : '');
    } else if (pas === 2) {
      h = '<h2>…i no ho va fer sola</h2><img class="retrat" src="' + esc(s.complice.img) + '" alt=""><div class="gran-nom">' + esc(s.complice.nom) + '</div>' +
        (s.complice.nom_real ? '<div class="real">' + esc(s.complice.nom_real) + '</div>' : '');
    } else if (pas === 3) {
      h = '<h2>Amb què i on</h2><div class="duo"><div><span class="etiqueta">Arma</span><b>' + esc(s.arma) + '</b></div><div><span class="etiqueta">Lloc</span><b>' + esc(s.lloc) + '</b></div></div>';
    } else if (pas === 4) {
      h = '<h2>Què va passar</h2><p class="relat">' + esc(s.relat) + '</p>';
    } else {
      h = '<h2>Classificació</h2><div class="ranking">' + r.ranking.slice(0, 8).map((x, i) =>
        '<div class="fila-r"><span>' + (i + 1) + '. ' + esc(x.nom_real) + ' <span class="suau" style="font-size:.7em">· ' + esc(x.personatge) + '</span></span><b>' + x.punts + '</b></div>').join('') + '</div>' +
        (r.mentider ? '<p style="margin-top:1.2em">Millor mentider: <b style="color:var(--daurat)">' + esc(r.mentider.nom_real) + '</b> (' + esc(r.mentider.personatge) + ')</p>' : '');
    }
    h += '<div class="pista-pas">' + (pas + 1) + ' / ' + PASSOS + ' · clica o prem espai per continuar</div>';
    el.innerHTML = h;
  }

  function avanca(d) {
    if (!revelant) return;
    pas = Math.max(0, Math.min(PASSOS - 1, pas + d));
    pintaPas();
  }
  $('#revelacio').addEventListener('click', () => avanca(1));
  document.addEventListener('keydown', (ev) => {
    if (!revelant) return;
    if (ev.key === ' ' || ev.key === 'ArrowRight' || ev.key === 'Enter' || ev.key === 'PageDown') { ev.preventDefault(); avanca(1); }
    if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); avanca(-1); }
  });

  inici().catch(err => { const e = $('#error'); e.hidden = false; e.textContent = err.message; });
})();
