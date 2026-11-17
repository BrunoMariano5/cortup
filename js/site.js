/* CortUp — títulos, cartões e figuras aparecem suavemente ao rolar a página. Sem JavaScript
   ou com "reduzir movimento" no sistema, tudo aparece normalmente, sem animação. */
(() => {
  "use strict";
  const itens = document.querySelectorAll(".revelar");
  const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || calmo) return;
  document.documentElement.classList.add("anima");
  const olho = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        e.target.classList.add("visto");
        olho.unobserve(e.target);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  itens.forEach((el) => {
    // Em grades, um item depois do outro (efeito cascata).
    const irmaos = el.parentElement ? [...el.parentElement.children] : [];
    el.style.transitionDelay = `${(irmaos.indexOf(el) % 4) * 80}ms`;
    olho.observe(el);
  });
})();
