/* CortUp — abertura interativa do site: fitas de vídeo passam pela "mesa de corte" e o
   visitante corta com a tesoura (arrastar por cima ou tocar). Cada pedaço cortado vira um
   clipe vertical 9:16 que vai para a bandeja. Sem bibliotecas: só Canvas 2D. Sem movimento
   (prefers-reduced-motion), a mesa fica parada e o corte vira clipe na hora. */
(() => {
  "use strict";
  const caixa = document.querySelector(".palco-caixa");
  const canvas = document.getElementById("palco");
  if (!caixa || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const contador = document.getElementById("contador");
  const dica = document.getElementById("dica");
  const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fino = window.matchMedia("(pointer: fine)").matches;

  const COR = { azul: "#64759d", roxo: "#826092", pessego: "#e39986", sol: "#ffe2b8",
                noite: "#120f1c", furo: "#2b2642", texto: "#f2eef6" };
  const CENAS = ["pordosol", "cidade", "estrada", "montanhas"];
  const VOO = 0.75;                 // segundos do pedaço até a bandeja

  let W = 0, H = 0, dpr = 1, larguraMedida = 0;
  let faixas = [];          // pistas: {y, h, dir, vel}
  let fitas = [];           // fitas de vídeo andando
  let voando = [];          // pedaços cortados a caminho da bandeja
  let cartoes = [];         // clipes prontos na bandeja
  let faiscas = [];
  let riscos = [];          // brilho no lugar do corte
  let rastro = [];          // caminho da tesoura enquanto arrasta
  let total = 0;
  let t = 0, ultimo = 0, rodando = false, visivel = true, ociosoDesde = 0;
  const mouse = { x: 0, y: 0, dentro: false, apertado: false, fechar: 0, inicio: null };
  const fantasma = { ativo: false, x: 0, y: 0, alvo: null, de: null, inicio: 0, fechar: 0 };

  // ---------------------------------------------------------------- utilidades
  let semente = 7;
  const aleatorio = () => {           // mulberry32: as mesmas fitas a cada visita
    semente |= 0; semente = (semente + 0x6d2b79f5) | 0;
    let x = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const entre = (a, b) => a + (b - a) * aleatorio();
  const suave = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
  const lerp = (a, b, k) => a + (b - a) * k;

  function arredondado(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- cenas ("vídeos")
  function ceu(h, cores) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    cores.forEach((c, i) => g.addColorStop(i / (cores.length - 1), c));
    return g;
  }

  function cena(tipo, x, y, w, h, tempo, s) {
    if (w <= 1 || h <= 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    if (tipo === "pordosol") {
      ctx.fillStyle = ceu(h, [COR.azul, COR.roxo, COR.pessego]);
      ctx.fillRect(0, 0, w, h);
      const sx = w * (0.2 + 0.6 * ((s * 0.37 + tempo * 0.03) % 1));
      ctx.fillStyle = COR.sol;
      ctx.beginPath();
      ctx.arc(sx, h * 0.68, h * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a1f3a";
      ctx.fillRect(0, h * 0.7, w, h);
      ctx.fillStyle = "rgba(255,226,184,0.55)";
      for (let i = 0; i < 4; i++) {
        const lw = h * (0.34 - i * 0.06) * (1 + 0.15 * Math.sin(tempo * 3 + i));
        ctx.fillRect(sx - lw / 2, h * (0.76 + i * 0.06), lw, Math.max(1, h * 0.018));
      }
    } else if (tipo === "cidade") {
      ctx.fillStyle = ceu(h, ["#2b2642", COR.azul, "#b58a9a"]);
      ctx.fillRect(0, 0, w, h);
      let px = -((tempo * 12 + s * 40) % (h * 0.6));
      let k = Math.floor(s * 3);
      while (px < w) {
        const bw = h * (0.18 + 0.12 * ((k * 7) % 5) / 5);
        const bh = h * (0.32 + 0.42 * ((k * 5) % 7) / 7);
        ctx.fillStyle = "#1b1626";
        ctx.fillRect(px, h - bh, bw - 2, bh);
        ctx.fillStyle = "rgba(255,226,184,0.85)";
        for (let wy = h - bh + 5; wy < h - 4; wy += 7) {
          for (let wx = 3; wx < bw - 6; wx += 6) {
            if (Math.sin(wx * 12.9 + wy * 78.2 + k * 3.1 + Math.floor(tempo * 1.5)) > 0.5) {
              ctx.fillRect(px + wx, wy, 2, 3);
            }
          }
        }
        px += bw;
        k++;
      }
    } else if (tipo === "estrada") {
      ctx.fillStyle = ceu(h * 0.5, [COR.roxo, COR.pessego]);
      ctx.fillRect(0, 0, w, h * 0.5);
      ctx.fillStyle = "#231d33";
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
      const cx = w / 2;
      ctx.fillStyle = "rgba(255,226,184,0.9)";
      ctx.beginPath();
      ctx.arc(cx, h * 0.5, h * 0.12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#3a3150";
      ctx.beginPath();
      ctx.moveTo(cx - h * 0.05, h * 0.5);
      ctx.lineTo(cx + h * 0.05, h * 0.5);
      ctx.lineTo(cx + w * 0.42, h);
      ctx.lineTo(cx - w * 0.42, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COR.sol;
      const fase = (tempo * 1.4 + s) % 1;
      for (let i = 0; i < 5; i++) {
        const p = (i + fase) / 5;
        ctx.fillRect(cx - p * 3 - 1, h * 0.5 + p * p * h * 0.5, p * 6 + 2, Math.max(1, p * h * 0.09));
      }
    } else {                                        // montanhas em camadas
      ctx.fillStyle = ceu(h, [COR.azul, "#a07f9f", COR.pessego]);
      ctx.fillRect(0, 0, w, h);
      [["#7a6a9c", 0.45, 6], ["#4b3a5e", 0.62, 14], ["#2a1f3a", 0.8, 26]].forEach(([cor, base, v], i) => {
        const passo = h * 0.5;
        const desloc = (tempo * v + s * 50 + i * 31) % (passo * 2);
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let mx = -desloc - passo * 2; mx < w + passo * 2; mx += passo) {
          ctx.lineTo(mx, h * base + h * 0.1);
          ctx.lineTo(mx + passo / 2, h * (base - 0.12 * Math.abs(Math.sin(mx * 0.013 + i + s))));
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- fitas
  function novaFita(faixa, x) {
    const pequeno = W < 560;
    return { faixa, x, w: entre(pequeno ? 230 : 300, pequeno ? 420 : 560),
             cena: CENAS[Math.floor(aleatorio() * CENAS.length)], s: entre(0, 10) };
  }

  function desenharFilme(x, y, w, h, tipo, s, tempo) {
    const borda = Math.max(6, h * 0.14);
    ctx.save();
    arredondado(x, y, w, h, 9);
    ctx.fillStyle = COR.noite;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = COR.furo;                       // furos do filme em cima e embaixo
    const passoFuro = Math.max(10, h * 0.13);
    for (let fx = x + 6; fx < x + w - 4; fx += passoFuro) {
      ctx.fillRect(fx, y + borda * 0.3, passoFuro * 0.5, borda * 0.4);
      ctx.fillRect(fx, y + h - borda * 0.7, passoFuro * 0.5, borda * 0.4);
    }
    const ih = h - borda * 2;                       // quadros do vídeo
    const qw = ih * 16 / 9;
    let n = 0;
    for (let qx = x + 4; qx < x + w - 4; qx += qw + 3) {
      cena(tipo, qx, y + borda, Math.min(qw, x + w - 4 - qx), ih, tempo + n * 0.35, s);
      n++;
    }
    ctx.restore();
  }

  function cortar(fita, cx, porQuem) {
    const faixa = faixas[fita.faixa];
    const minimo = faixa.h * 1.1;
    const esq = cx - fita.x;
    const dir = fita.x + fita.w - cx;
    if (esq < minimo * 0.6 || dir < minimo * 0.6) return false;
    // A parte da frente (no sentido em que a fita anda) vira o clipe.
    const frente = faixa.dir > 0 ? { x: cx, w: dir } : { x: fita.x, w: esq };
    if (faixa.dir > 0) fita.w = esq; else { fita.x = cx; fita.w = dir; }
    if (fita.w < minimo) fita.morta = true;
    if (porQuem === "pessoa") {
      mouse.fechar = 1;
      if (dica) dica.classList.add("sumir");
    } else {
      fantasma.fechar = 1;
    }
    if (calmo) {                                    // sem animação: vira clipe na hora
      chegou({ cena: fita.cena, s: fita.s });
      desenhar();
      return true;
    }
    voando.push({ cena: fita.cena, s: fita.s, x: frente.x, y: faixa.y, w: frente.w, h: faixa.h,
                  vx: faixa.vel * faixa.dir, vy: -entre(40, 90), giro: entre(-0.3, 0.3),
                  ang: 0, idade: 0 });
    riscos.push({ x: cx, y: faixa.y, h: faixa.h, idade: 0 });
    for (let i = 0; i < 12; i++) {
      const a = entre(0, Math.PI * 2);
      const v = entre(60, 220);
      faiscas.push({ x: cx, y: faixa.y + faixa.h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                     idade: 0, vida: entre(0.3, 0.6) });
    }
    return true;
  }

  function chegou(v) {
    cartoes.push({ cena: v.cena, s: v.s, nasceu: t });
    total++;
    if (contador) contador.textContent = String(total);
    const max = bandeja().max;
    if (cartoes.length > max) cartoes = cartoes.slice(-max);
  }

  function fitaEm(px, py) {
    for (const f of fitas) {
      const fx = faixas[f.faixa];
      if (!f.morta && py >= fx.y && py <= fx.y + fx.h && px >= f.x && px <= f.x + f.w) return f;
    }
    return null;
  }

  // ---------------------------------------------------------------- bandeja (canto de baixo)
  function bandeja() {
    const ch = Math.min(104, Math.max(64, H * 0.17));
    const cw = ch * 9 / 16;
    const max = Math.max(3, Math.floor((W - 40) / (cw + 10)));
    return { ch, cw, max, y: H - ch - 14 };
  }
  function vaga(posicao) {                          // posicao 0 = mais à direita
    const b = bandeja();
    return { x: W - 20 - b.cw - posicao * (b.cw + 10), y: b.y, w: b.cw, h: b.ch };
  }

  function desenharCartao(c, x, y, w, h, alfa) {
    ctx.save();
    ctx.globalAlpha = alfa;
    arredondado(x, y, w, h, 8);
    ctx.fillStyle = COR.noite;
    ctx.fill();
    ctx.save();
    arredondado(x + 2, y + 2, w - 4, h - 4, 6);
    ctx.clip();
    cena(c.cena, x + 2, y + 2, w - 4, h - 4, t, c.s);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    arredondado(x + 0.5, y + 0.5, w - 1, h - 1, 8);
    ctx.stroke();
    if (h > 50) {
      ctx.fillStyle = "rgba(17,15,26,0.72)";
      arredondado(x + 5, y + h - 18, 30, 13, 4);
      ctx.fill();
      ctx.fillStyle = COR.texto;
      ctx.font = "600 9px 'Segoe UI', system-ui, sans-serif";
      ctx.fillText("0:30", x + 9, y + h - 8);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- tesoura
  function desenharTesoura(x, y, fechar, alfa, escala) {
    const abre = 0.42 * (1 - fechar);
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(x, y);
    ctx.scale(escala, escala);
    ctx.rotate(Math.PI / 2 - 0.25);                 // lâminas para baixo, cortando a fita
    ctx.shadowColor = "rgba(17,15,26,0.45)";
    ctx.shadowBlur = 6;
    for (const lado of [-1, 1]) {
      ctx.save();
      ctx.rotate(lado * abre);
      ctx.fillStyle = "#f2eef6";                    // lâmina
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(32, lado * -3.5);
      ctx.lineTo(32, lado * 1);
      ctx.lineTo(-2, lado * 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COR.pessego;                // cabo
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(-14, lado * 8, 8, 6, lado * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = COR.roxo;
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- tamanho e pistas
  function medir() {
    const r = caixa.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = bandeja();
    const area = b.y - 18;
    const fh = W < 560 ? 64 : 84;
    const n = Math.max(2, Math.min(4, Math.floor(area / (fh + 20))));
    const sobra = area - n * fh;
    const antes = faixas.length;
    faixas = [];
    for (let i = 0; i < n; i++) {
      faixas.push({ y: sobra / (n + 1) * (i + 1) + fh * i, h: fh, dir: i % 2 === 0 ? 1 : -1,
                    vel: (W < 560 ? 34 : 46) + i * 8 });
    }
    // Largura mudou (girar o celular, outra janela): monta as fitas de novo.
    if (W !== larguraMedida || n !== antes) {
      larguraMedida = W;
      semente = 7;
      fitas = [];
      voando = [];
      faixas.forEach((fx, i) => {
        let x = -entre(60, 260);
        while (x < W + 200) {
          const f = novaFita(i, x);
          fitas.push(f);
          x += f.w + entre(60, 130);
        }
      });
    }
    if (cartoes.length > b.max) cartoes = cartoes.slice(-b.max);
  }

  // ---------------------------------------------------------------- quadro a quadro
  function passo(dt) {
    t += dt;
    faixas.forEach((fx, i) => {                     // fitas andando e nascendo
      const daPista = fitas.filter((f) => f.faixa === i);
      for (const f of daPista) f.x += fx.vel * fx.dir * dt;
      if (fx.dir > 0) {
        const primeira = daPista.reduce((m, f) => Math.min(m, f.x), Infinity);
        if (primeira > -40) {
          const f = novaFita(i, 0);
          f.x = (primeira === Infinity ? 0 : primeira) - entre(60, 130) - f.w;
          fitas.push(f);
        }
      } else {
        const ultima = daPista.reduce((m, f) => Math.max(m, f.x + f.w), -Infinity);
        if (ultima < W + 40) fitas.push(novaFita(i, (ultima === -Infinity ? W : ultima) + entre(60, 130)));
      }
    });
    fitas = fitas.filter((f) => !f.morta && f.x < W + 1400 && f.x + f.w > -1400);

    for (const v of voando) {                       // solta, encolhe para 9:16, vai à bandeja
      v.idade += dt;
      if (v.idade < 0.3) {
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.vy += 260 * dt;
        v.ang += v.giro * dt * 2;
      } else {
        if (!v.de) v.de = { x: v.x, y: v.y, w: v.w, h: v.h, ang: v.ang };
        const para = vaga(0);
        const k = suave((v.idade - 0.3) / VOO);
        v.x = lerp(v.de.x, para.x, k);
        v.y = lerp(v.de.y, para.y, k) - Math.sin(k * Math.PI) * 50;
        v.w = lerp(v.de.w, para.w, k);
        v.h = lerp(v.de.h, para.h, k);
        v.ang = lerp(v.de.ang, 0, k);
        v.pronto = k >= 1;
      }
    }
    for (const v of voando) if (v.pronto) chegou(v);
    voando = voando.filter((v) => !v.pronto);

    for (const f of faiscas) {
      f.idade += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 300 * dt;
    }
    faiscas = faiscas.filter((f) => f.idade < f.vida);
    for (const r of riscos) r.idade += dt;
    riscos = riscos.filter((r) => r.idade < 0.35);
    mouse.fechar = Math.max(0, mouse.fechar - dt * 4);
    fantasma.fechar = Math.max(0, fantasma.fechar - dt * 4);
    rastro = rastro.filter((p) => t - p.t < 0.2);

    // Tesoura "fantasma": se ninguém mexe, corta sozinha para mostrar a brincadeira.
    if (!mouse.dentro && t - ociosoDesde > 3.5) {
      if (!fantasma.ativo) {
        const boas = fitas.filter((f) => {
          const meio = f.x + f.w / 2;
          return meio > W * 0.3 && meio < W * 0.75 && f.w > faixas[f.faixa].h * 2.6;
        });
        if (boas.length) {
          const f = boas[Math.floor(aleatorio() * boas.length)];
          Object.assign(fantasma, { ativo: true, alvo: f, inicio: t,
                                    de: { x: fantasma.x || W * 0.8, y: fantasma.y || 20 } });
        }
      } else {
        const f = fantasma.alvo;
        const fx = faixas[f.faixa];
        const k = suave((t - fantasma.inicio) / 0.9);
        const cx = f.x + f.w * 0.55;
        fantasma.x = lerp(fantasma.de.x, cx, k);
        fantasma.y = lerp(fantasma.de.y, fx.y + fx.h / 2, k);
        if (k >= 1 || f.morta) {
          if (!f.morta) cortar(f, cx, "fantasma");
          fantasma.ativo = false;
          ociosoDesde = t - 1.5;
        }
      }
    }
  }

  function desenhar() {
    ctx.clearRect(0, 0, W, H);
    for (const f of fitas) {
      const fx = faixas[f.faixa];
      if (f.x < W + 20 && f.x + f.w > -20) desenharFilme(f.x, fx.y, f.w, fx.h, f.cena, f.s, t);
    }
    // As fitas entram e saem esfumadas nas laterais (a bandeja, embaixo, fica nítida).
    const fundoPistas = bandeja().y - 6;
    const fade = Math.min(70, W * 0.1);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    let g = ctx.createLinearGradient(0, 0, fade, 0);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, fade, fundoPistas);
    g = ctx.createLinearGradient(W - fade, 0, W, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g;
    ctx.fillRect(W - fade, 0, fade, fundoPistas);
    ctx.restore();
    cartoes.forEach((c, i) => {                     // o mais novo fica à direita
      const v = vaga(cartoes.length - 1 - i);
      const k = suave((t - c.nasceu) / 0.25);
      desenharCartao(c, v.x, v.y - (1 - k) * 8, v.w, v.h, 0.55 + 0.45 * k);
    });
    if (!cartoes.length && !voando.length) {        // bandeja vazia: um lugar tracejado
      const v = vaga(0);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      arredondado(v.x, v.y, v.w, v.h, 8);
      ctx.stroke();
      ctx.restore();
    }
    for (const v of voando) {
      ctx.save();
      ctx.translate(v.x + v.w / 2, v.y + v.h / 2);
      ctx.rotate(v.ang);
      ctx.shadowColor = "rgba(227,153,134,0.7)";
      ctx.shadowBlur = 18;
      if (v.de && v.w < v.h * 1.2) desenharCartao(v, -v.w / 2, -v.h / 2, v.w, v.h, 1);
      else desenharFilme(-v.w / 2, -v.h / 2, v.w, v.h, v.cena, v.s, t);
      ctx.restore();
    }
    for (const r of riscos) {
      ctx.fillStyle = `rgba(255,236,214,${1 - r.idade / 0.35})`;
      ctx.fillRect(r.x - 1.5, r.y - 6, 3, r.h + 12);
    }
    for (const f of faiscas) {
      ctx.fillStyle = `rgba(255,214,190,${1 - f.idade / f.vida})`;
      ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
    }
    if (rastro.length > 1) {
      ctx.strokeStyle = "rgba(255,236,214,0.85)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(rastro[0].x, rastro[0].y);
      for (const p of rastro) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    if (fantasma.ativo || fantasma.fechar > 0) desenharTesoura(fantasma.x, fantasma.y, fantasma.fechar, 0.75, 1.4);
    if (fino && mouse.dentro) desenharTesoura(mouse.x, mouse.y, mouse.fechar, 1, 1.5);
  }

  function quadro(agora) {
    if (!rodando) return;
    const dt = Math.min(0.05, (agora - (ultimo || agora)) / 1000);
    ultimo = agora;
    passo(dt);
    desenhar();
    requestAnimationFrame(quadro);
  }
  function ligar() {
    if (rodando || calmo || !visivel || document.hidden) return;
    rodando = true;
    ultimo = 0;
    requestAnimationFrame(quadro);
  }
  function desligar() { rodando = false; }

  // ---------------------------------------------------------------- mouse e toque
  function ponto(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  function cortarNoCaminho(a, b) {
    for (const f of fitas) {
      if (f.morta) continue;
      const fx = faixas[f.faixa];
      const meio = fx.y + fx.h / 2;
      if (a.y === b.y || (a.y - meio) * (b.y - meio) > 0) continue;
      const cx = a.x + (b.x - a.x) * ((meio - a.y) / (b.y - a.y));
      if (cx > f.x && cx < f.x + f.w && cortar(f, cx, "pessoa")) return;
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    const p = ponto(e);
    Object.assign(mouse, { x: p.x, y: p.y, apertado: true, inicio: p });
    rastro = [{ x: p.x, y: p.y, t }];
    ociosoDesde = t;
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = ponto(e);
    const antes = { x: mouse.x, y: mouse.y };
    Object.assign(mouse, { x: p.x, y: p.y, dentro: true });
    ociosoDesde = t;
    if (mouse.apertado) {
      rastro.push({ x: p.x, y: p.y, t });
      cortarNoCaminho(antes, p);
    }
    if (calmo) desenhar();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (mouse.apertado && mouse.inicio) {
      const p = ponto(e);
      if (Math.hypot(p.x - mouse.inicio.x, p.y - mouse.inicio.y) < 8) {   // toque ou clique
        const f = fitaEm(p.x, p.y);
        if (f) cortar(f, p.x, "pessoa");
      }
    }
    mouse.apertado = false;
  });
  canvas.addEventListener("pointercancel", () => { mouse.apertado = false; });
  canvas.addEventListener("pointerleave", () => {
    mouse.dentro = false;
    mouse.apertado = false;
    if (calmo) desenhar();
  });

  // ---------------------------------------------------------------- liga e desliga
  new ResizeObserver(() => { medir(); desenhar(); }).observe(caixa);
  new IntersectionObserver((itens) => {
    visivel = itens[0].isIntersecting;
    if (visivel) ligar(); else desligar();
  }).observe(caixa);
  document.addEventListener("visibilitychange", () => (document.hidden ? desligar() : ligar()));

  // Só para testar (endereço com ?teste): avança a animação à mão e mostra o estado.
  if (/[?&]teste\b/.test(location.search)) {
    window.__corte = {
      passo: (segundos, dt = 1 / 60) => {
        for (let s = 0; s < segundos; s += dt) passo(dt);
        desenhar();
      },
      cortarEm: (x, y) => { const f = fitaEm(x, y); return f ? cortar(f, x, "pessoa") : false; },
      estado: () => ({ t, total, fitas: fitas.length, voando: voando.length, cartoes: cartoes.length,
                       faixas: faixas.map((f) => [Math.round(f.y), f.h, f.dir]), W, H,
                       fantasma: fantasma.ativo }),
    };
  }

  medir();
  if (calmo) {
    t = 3;
    CENAS.forEach((c, i) => chegou({ cena: c, s: i * 2.3 }));
    cartoes.forEach((c) => (c.nasceu = -10));
    desenhar();
  } else {
    ligar();
  }
})();
