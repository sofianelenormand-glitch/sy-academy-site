/* =============================================================================
 * Diagnostic IA · Front handler — SY Academy · Brand.SYS v1.0
 *
 * Capture UTM, valide les 12 réponses + identité + RGPD, vérifie le
 * honeypot, POST vers n8n avec retry x2 et timeout 30s, redirige vers
 * /diagnostic-merci en cas de succès.
 *
 * Backend (n8n + Supabase) : Session 4B.
 * ========================================================================== */

(function () {
  'use strict';

  const ENDPOINT = 'https://n8n.sole-solution.fr/webhook/sy-diagnostic';
  const TIMEOUT_MS = 30000;
  const RETRY_DELAYS = [2000, 5000];
  const REDIRECT_ON_SUCCESS = '/diagnostic-merci';
  const QUESTION_NAMES = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12'];
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const form = document.getElementById('diagnostic-form');
    if (!form) return;

    captureUTM();
    form.addEventListener('submit', handleSubmit);
  }

  /* === UTM CAPTURE ====================================================== */

  function captureUTM() {
    const params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => {
      const value = params.get(key);
      if (!value) return;
      const input = document.getElementById(key);
      if (input) input.value = value.slice(0, 80);
    });
  }

  /* === VALIDATION ======================================================= */

  function validate(form) {
    clearErrors(form);
    const errors = [];

    const requiredText = ['prenom', 'nom', 'fonction', 'taille_entreprise'];
    requiredText.forEach((name) => {
      const field = form.elements[name];
      if (!field || !field.value.trim()) {
        markError(field, 'Champ obligatoire.');
        errors.push(name);
      }
    });

    const email = form.elements['email'];
    if (!email || !email.value.trim()) {
      markError(email, 'Email obligatoire.');
      errors.push('email');
    } else if (!EMAIL_REGEX.test(email.value.trim())) {
      markError(email, 'Format d\u2019email invalide.');
      errors.push('email');
    }

    QUESTION_NAMES.forEach((name) => {
      const checked = form.querySelector('input[name="' + name + '"]:checked');
      if (!checked) errors.push(name);
    });

    const rgpd = form.elements['consentement_rgpd'];
    if (!rgpd || !rgpd.checked) errors.push('consentement_rgpd');

    return errors;
  }

  function markError(field, message) {
    if (!field) return;
    field.classList.add('has-error');
    const group = field.closest('.form-group');
    if (!group) return;
    let errEl = group.querySelector('.form-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'form-error';
      group.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  function clearErrors(form) {
    form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
    form.querySelectorAll('.form-group .form-error').forEach((el) => el.remove());
    const global = document.getElementById('form-error-global');
    if (global) {
      global.hidden = true;
      global.textContent = '';
    }
  }

  function showGlobalError(message) {
    const global = document.getElementById('form-error-global');
    if (!global) return;
    global.hidden = false;
    global.textContent = message;
    global.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* === SUBMIT =========================================================== */

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;

    const honeypot = form.elements['_honeypot'];
    if (honeypot && honeypot.value.trim() !== '') {
      window.location.href = REDIRECT_ON_SUCCESS;
      return;
    }

    const errors = validate(form);
    if (errors.length > 0) {
      const missing = errors.filter((e) => QUESTION_NAMES.indexOf(e) !== -1);
      if (missing.length > 0) {
        showGlobalError('Merci de répondre aux ' + missing.length + ' question(s) restante(s).');
      } else if (errors.indexOf('consentement_rgpd') !== -1) {
        showGlobalError('Le consentement RGPD est obligatoire pour recevoir le rapport.');
      } else {
        showGlobalError('Merci de compléter les champs requis.');
      }
      return;
    }

    const payload = buildPayload(form);
    setLoading(form, true);

    const result = await postWithRetry(payload);
    if (result.ok) {
      window.location.href = REDIRECT_ON_SUCCESS;
      return;
    }

    setLoading(form, false);
    showGlobalError(
      result.message ||
        'Envoi impossible pour le moment. Vous pouvez réessayer ou nous écrire à contact@syacademy.fr.'
    );
  }

  function buildPayload(form) {
    const data = {
      prenom: form.elements['prenom'].value.trim(),
      nom: form.elements['nom'].value.trim(),
      email: form.elements['email'].value.trim(),
      fonction: form.elements['fonction'].value,
      taille_entreprise: form.elements['taille_entreprise'].value,
      answers: QUESTION_NAMES.map((name) => {
        const checked = form.querySelector('input[name="' + name + '"]:checked');
        return checked ? parseInt(checked.value, 10) : 0;
      }),
      consentement_rgpd: !!form.elements['consentement_rgpd'].checked,
      consentement_marketing: !!(form.elements['consentement_marketing'] && form.elements['consentement_marketing'].checked),
      utm_source: form.elements['utm_source'].value,
      utm_medium: form.elements['utm_medium'].value,
      utm_campaign: form.elements['utm_campaign'].value,
      submitted_at: new Date().toISOString(),
      page_url: window.location.href,
      referrer: document.referrer || null,
      _honeypot: ''
    };

    return data;
  }

  /* === POST + RETRY ===================================================== */

  async function postWithRetry(payload) {
    const attempts = 1 + RETRY_DELAYS.length;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await postOnce(payload);
        if (response.ok) return { ok: true };
        if (response.status < 500 && response.status !== 408 && response.status !== 429) {
          return { ok: false, message: 'Réponse refusée par le serveur (' + response.status + ').' };
        }
      } catch (err) {
        if (i === attempts - 1) {
          return { ok: false, message: 'Connexion impossible. Vérifiez votre réseau et réessayez.' };
        }
      }
      const delay = RETRY_DELAYS[i];
      if (delay) await sleep(delay);
    }
    return { ok: false };
  }

  function postOnce(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit'
    }).finally(() => clearTimeout(timer));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* === UI LOADING STATE ================================================= */

  function setLoading(form, isLoading) {
    const btn = document.getElementById('diagnostic-submit');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    const spinner = btn.querySelector('.btn-spinner');
    const label = btn.querySelector('.btn-label');
    if (spinner) spinner.hidden = !isLoading;
    if (label) label.textContent = isLoading ? 'Envoi en cours…' : 'Envoyer mes réponses';
  }
})();
