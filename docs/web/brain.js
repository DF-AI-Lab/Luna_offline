// Luna Offline: the free brain. Runs on the phone, no internet, no cost.
// It reads Orbit's prompt (the same one Orbit sends to Claude), pulls out Darren's message,
// his past corrections and "now", and answers in the same JSON Orbit expects.
// Claude (claude.js) is only the backup, when this brain isn't sure and Darren allowed it.
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const DAY_RE = '(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|sday|rsday|urday)?';
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MON_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const words = s => String(s).toLowerCase().replace(/[^a-z0-9£ ]/g, ' ').split(/\s+/).filter(Boolean);

  // ---------- read Orbit's prompt ----------
  function readPrompt(prompt) {
    const p = String(prompt);
    const msg = (p.match(/\nMessage: ([\s\S]*)$/) || [])[1] || p;
    const nm = p.match(/Now: \w+ (\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/);
    const now = nm ? new Date(+nm[1], +nm[2] - 1, +nm[3], +nm[4], +nm[5]) : new Date();
    const lessons = [];
    const block = (p.match(/past corrections \(follow these\):\n([\s\S]*?)\n\n/) || [])[1] || '';
    for (const line of block.split('\n')) {
      const m = line.match(/^- "(.*)" → (.+?)(?: \(NOT (\w+)\))?$/);
      if (m) lessons.push({ msg: m[1], right: m[2], picked: m[3] || '' });
    }
    return { msg: msg.trim(), now, lessons };
  }

  // ---------- dates and times ----------
  function findDate(t, now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const add = n => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
    let m;
    if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(t)) return { date: today, hit: RegExp.lastMatch };
    if ((m = t.match(/\b(tomorrow|tmrw|tmr)\b/))) return { date: add(1), hit: m[0] };
    if ((m = t.match(/\bday after tomorrow\b/))) return { date: add(2), hit: m[0] };
    if ((m = t.match(/\bin (\d+) days?\b/))) return { date: add(+m[1]), hit: m[0] };
    if ((m = t.match(/\bnext week\b/))) return { date: add(7), hit: m[0] };
    // 12th nov, 12 november, nov 12
    if ((m = t.match(new RegExp(`\\b(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)? ${MON_RE}\\b`))) ||
        (m = t.match(new RegExp(`\\b(?:on )?${MON_RE} (\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
      const day = /^\d/.test(m[1]) ? +m[1] : +m[2];
      const mon = MONTHS.indexOf((/^\d/.test(m[1]) ? m[2] : m[1]).slice(0, 3));
      let d = new Date(today.getFullYear(), mon, day);
      if (d < today) d = new Date(today.getFullYear() + 1, mon, day);
      return { date: d, hit: m[0] };
    }
    // 12/11
    if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
      let d = new Date(y, +m[2] - 1, +m[1]);
      if (!m[3] && d < today) d = new Date(y + 1, +m[2] - 1, +m[1]);
      return { date: d, hit: m[0] };
    }
    // (next) friday
    if ((m = t.match(new RegExp(`\\b(?:on |this |next )?${DAY_RE}\\b`)))) {
      const want = DAYS.findIndex(d => d.startsWith(m[1].slice(0, 3)));
      let diff = (want - today.getDay() + 7) % 7;
      if (/^next /.test(m[0]) && diff === 0) diff = 7;
      return { date: add(diff), hit: m[0], weekday: true };
    }
    // the 12th (this month, or next if passed)
    if ((m = t.match(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/))) {
      let d = new Date(today.getFullYear(), today.getMonth(), +m[1]);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, +m[1]);
      return { date: d, hit: m[0] };
    }
    return null;
  }
  function hhmm(h, mi, ap) {
    h = +h; mi = +(mi || 0);
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h > 23 || mi > 59 ? '' : `${pad(h)}:${pad(mi)}`;
  }
  function findTime(t) {
    let m;
    // 3-4pm, 3pm-4pm, 3 till 5pm
    if ((m = t.match(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm)?\s*(?:-|–|to|till|until)\s*(\d{1,2})(?::(\d\d))?\s*(am|pm)\b/))) {
      const ap1 = m[3] || m[6];
      return { time: hhmm(m[1], m[2], ap1), end: hhmm(m[4], m[5], m[6]), hit: m[0] };
    }
    if ((m = t.match(/\b(\d{1,2})(?::|\.)?(\d\d)?\s*(am|pm)\b/))) return { time: hhmm(m[1], m[2], m[3]), end: '', hit: m[0] };
    if ((m = t.match(/\b(?:at )?([01]?\d|2[0-3]):([0-5]\d)\b/))) return { time: hhmm(m[1], m[2]), end: '', hit: m[0] };
    if ((m = t.match(/\bat (\d{1,2})\b(?!\s*(?:%|£|days?|mins?|minutes|hours?))/))) {
      const h = +m[1]; return { time: hhmm(h >= 1 && h <= 7 ? h + 12 : h, 0), end: '', hit: m[0] };
    }
    if ((m = t.match(/\b(?:at )?(noon|midday)\b/))) return { time: '12:00', end: '', hit: m[0] };
    if ((m = t.match(/\btonight\b/))) return { time: '', end: '', hit: '' };
    return null;
  }

  // ---------- money ----------
  function findAmount(t) {
    let m;
    if ((m = t.match(/£\s?(\d{1,6}(?:[.,]\d{1,2})?)/))) return { amount: +m[1].replace(',', '.'), hit: m[0] };
    if ((m = t.match(/\b(\d{1,6}(?:\.\d{1,2})?)\s?(?:quid|pounds?|gbp)\b/))) return { amount: +m[1], hit: m[0] };
    if ((m = t.match(/\b(\d{1,3})p\b/))) return { amount: +m[1] / 100, hit: m[0] };
    return null;
  }

  // ---------- the guess ----------
  const DIARYISH = /\b(dentist|doctor|doctors|gp|hospital|appointment|appt|meeting|interview|tennis|football|gym|lunch|dinner|drinks|party|wedding|haircut|hairdresser|barber|class|lesson|match|gig|concert|flight|train|vet|chiropractor|chiro|physio|optician|school run|parents evening|birthday)\b/;
  const TASKISH = /\b(buy|get|ring|call|phone|fix|book|email|e-mail|pay|clean|tidy|sort|chase|order|send|text|pick up|collect|renew|cancel|return|post|wash|hoover|mow|paint|check|finish|write|print|apply|reply|look into|find|take|bring|move|empty|put out)\b/;
  const NOTEISH = /\b(remember|idea|note that|wifi|password is|code is|number is|reg is|size is|fact|thought)\b/;
  const QSTART = /^(what|what's|whats|how|how's|hows|am i|do i|have i|is there|are there|any|show|list|when|which|tell me|give me)\b/;

  function lessonFor(msg, lessons) {
    const a = new Set(words(msg)); let best = null, score = 0;
    for (const l of lessons) {
      const b = new Set(words(l.msg)); if (!a.size || !b.size) continue;
      let both = 0; for (const w of a) if (b.has(w)) both++;
      const s = both / (a.size + b.size - both);
      if (s > score) { score = s; best = l; }
    }
    return score >= 0.6 ? best : null;
  }

  function clean(text, hits) {
    let s = ' ' + text + ' ';
    for (const h of hits.filter(Boolean).sort((x, y) => y.length - x.length)) s = s.split(h).join(' ');
    s = s.replace(/\b(please|pls|can you|could you|add|put|pop|stick|remind me to|remind me|i need to|need to|i have to|have to|i've got to|got to|gotta|don't forget to|dont forget to|make a note|note down|jot down|i spent|spent|spend|paid for|paid|bought|cost me|costs|cost|for|at|on|in|to|my|the|a|an|today|tonight)\b/gi, m => /^(a|an|the|for|at|on|in|to|my)$/i.test(m) ? ` ${m} ` : ' ');
    s = s.replace(/\b(to|in|on|into)\s+(my\s+)?(diary|calendar|notes?|to-?do( list)?|list|wmm|money)\b/gi, ' ');
    s = s.replace(/^\s*(note|task|todo|to-?do|diary|calendar|money)\s*[:\-]\s*/i, ' ');
    s = s.replace(/[!?.,;:]+\s*$/, '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^((a|an|the|for|at|on|in|to|my|and)\s+)+/i, '').replace(/(\s+(a|an|the|for|at|on|in|to|my|and|with))+$/i, '').trim();
    return cap(s);
  }

  function guess(raw, now, lessons) {
    const msg = String(raw || '').trim();
    const t = ' ' + msg.toLowerCase().replace(/[’']/g, "'") + ' ';
    const out = { kind: 'task', title: '', text: '', date: '', time: '', end: '', estimate_mins: 0, about: '', category: '', search: '', amount: 0, money_type: '', day: '', confidence: 0.5, why: '' };
    const hits = [];
    const dt = findDate(t, now), tm = findTime(t), money = findAmount(t);
    if (dt) { out.date = ymd(dt.date); hits.push(dt.hit); }
    if (tm) { out.time = tm.time; out.end = tm.end; hits.push(tm.hit); }
    // a weekday today with a time already gone = next week (Orbit's rule)
    if (dt && dt.weekday && tm && tm.time && out.date === ymd(now) && tm.time <= `${pad(now.getHours())}:${pad(now.getMinutes())}`) {
      const d = new Date(dt.date); d.setDate(d.getDate() + 7); out.date = ymd(d);
    }
    let m;
    if ((m = t.match(/\b(?:takes?|about|around|for|~)\s*(\d+(?:\.\d)?)\s*(mins?|minutes|m|hours?|hrs?|h)\b/))) {
      out.estimate_mins = Math.round(+m[1] * (/^h/.test(m[2]) ? 60 : 1)); hits.push(m[0]);
    }

    // 1) where he SAID it goes always wins
    let said = '';
    if (/^\s*note\b|\b(in|to|into) (my )?notes?\b|\bnote:|\bmake a note\b|\bjot (it )?down\b/.test(t)) said = 'note';
    else if (/\b(in|to|into|on) (my )?(diary|calendar)\b|^\s*(diary|calendar)\b/.test(t)) said = 'calendar';
    else if (/\b(on|to) (my )?(to-?do( list)?|list)\b|^\s*(task|todo|to-?do)\b/.test(t)) said = 'task';
    else if (money && /\b(wmm|where's my money|money|spent|spend|bought|paid|bill|direct debit|standing order|on the card|credit card)\b/.test(t)) said = 'money';

    // 2) a question?
    const isQ = !said && (/\?\s*$/.test(msg) || QSTART.test(t.trim()) || /\b(am i free|what's on|whats on|what is on|how much|how's my|hows my)\b/.test(t));
    if (isQ) {
      out.kind = 'question'; out.confidence = 0.85; out.why = 'question';
      if (/\b(money|spare|spent|bills?|pots?|card|cash|afford|left till|payday|budget)\b/.test(t)) out.about = 'money';
      else if (/\bnotes?\b|\bideas?\b/.test(t)) out.about = 'notes';
      else if (/\b(diary|calendar|free|busy|appointments?|events?|on (today|tomorrow|this week))\b/.test(t)) out.about = 'diary';
      else if (/\b(tasks?|to-?dos?|due|list|overdue)\b/.test(t)) out.about = 'tasks';
      else out.about = 'all';
      if (out.about === 'notes') {
        if (/\bhome\b/.test(t)) out.category = 'Home'; else if (/\bwork\b/.test(t)) out.category = 'Work';
        else if (/\bhealth\b/.test(t)) out.category = 'Health'; else if (/\b(ai lab|project ideas?|projects?)\b/.test(t)) out.category = 'AI Lab';
        const ab = t.match(/\babout ([a-z0-9]+)/); if (ab && !out.category) out.search = ab[1];
      }
      return out;
    }

    // 3) past corrections
    const L = said ? null : lessonFor(msg, lessons || []);

    // 4) the kind
    if (said) { out.kind = said; out.confidence = 0.95; out.why = 'he said where'; }
    else if (L) { out.kind = L.right.split(' + ')[0].trim(); out.confidence = 0.9; out.why = 'past correction'; }
    else if (money) { out.kind = 'money'; out.confidence = 0.8; out.why = 'amount'; }
    else if (tm && tm.time) { out.kind = 'calendar'; out.confidence = 0.85; out.why = 'time'; }
    else if (dt && DIARYISH.test(t)) { out.kind = 'calendar'; out.confidence = 0.8; out.why = 'date + event'; }
    else if (NOTEISH.test(t)) { out.kind = 'note'; out.confidence = 0.75; out.why = 'note words'; }
    else if (TASKISH.test(t)) { out.kind = 'task'; out.confidence = 0.8; out.why = 'to-do verb'; }
    else if (DIARYISH.test(t)) { out.kind = 'calendar'; out.confidence = 0.55; out.why = 'event word'; }
    else if (/\b(fridge|freezer|use by|leftovers)\b/.test(t)) { out.kind = 'other'; out.confidence = 0.7; out.why = 'fridge'; }
    else { out.kind = 'task'; out.confidence = 0.45; out.why = 'not sure'; }

    if (out.kind === 'money') {
      out.amount = money ? Math.round(money.amount * 100) / 100 : 0;
      if (money) hits.push(money.hit);
      if ((m = t.match(/\b(paid|pay|paying) (£?\d[\d.,]* )?off (the |my )?(credit )?card\b|\bcard payment\b/))) { out.money_type = 'paid_off'; hits.push(m[0]); }
      else if ((m = t.match(/\b(on|with) (the |my )?(credit )?card\b|\bcredit card\b/))) { out.money_type = 'card'; hits.push(m[0]); }
      else if ((m = t.match(/\b(a|per|every) month\b|\bmonthly\b|\bdirect debit\b|\bstanding order\b|\bdd\b|\bbill\b|\bsubscription\b/))) {
        out.money_type = 'bill'; hits.push(m[0]);
        const dd = t.match(/\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)?\b/) || t.match(/\bday (\d{1,2})\b/);
        if (dd && +dd[1] >= 1 && +dd[1] <= 31) { out.day = String(+dd[1]); hits.push(dd[0]); out.date = ''; }
        else if (/\bvaries\b/.test(t)) { out.day = 'varies'; hits.push('varies'); }
      }
      else if (/\b(coming out|to come out|going out|will go|due|upcoming|next|not paid yet)\b/.test(t) || (out.date && out.date > ymd(now))) out.money_type = 'upcoming';
      else out.money_type = 'spend';
      hits.push('wmm', "where's my money", 'credit card', 'card');
      if (!out.amount) out.confidence = 0.4;
    }
    if (out.kind === 'note') {
      out.text = msg.replace(/^\s*(please\s+)?(add|put|save|write)?\s*(this\s+)?(to|in|into)?\s*(my\s+)?notes?\s*[:\-]?\s*/i, '')
        .replace(/\s*,?\s*(add|put|save)?\s*(it\s+)?(to|in|into) (my )?notes?\s*$/i, '').trim() || msg;
    }
    out.title = clean(t, hits) || cap(msg);
    if (out.kind === 'calendar' && !out.date) out.date = ymd(now);
    if (out.title.length > 120) out.title = out.title.slice(0, 117) + '…';
    return out;
  }

  const api = { readPrompt, guess, findDate, findTime, findAmount, ymd };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LunaRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
