const NAVER_SEARCH_URL = 'https://en.dict.naver.com/api3/enko/search';
const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function collectMeans(item) {
  const groups = [];
  if (item?.expOnly) {
    try {
      const parsed = JSON.parse(item.expOnly);
      groups.push(...(parsed?.meansRevisionCollector || []));
    } catch (_) {}
  }
  groups.push(...(item?.meansCollector || []));

  return groups.flatMap(group => (group?.means || []).map(mean => ({
    meaning: stripHtml(mean.showMeanBeginner || mean.value),
    example: stripHtml(mean.exampleOri),
    exampleKo: stripHtml(mean.exampleTrans),
    level: String(mean.meanLevel || mean.examLevel || ''),
  }))).filter(row => row.meaning);
}

function scoreMean(mean) {
  let score = 0;
  if (mean.example && mean.exampleKo) score += 6;
  if (mean.level === 'beginner') score += 5;
  if (mean.level === 'intermediate') score += 3;
  if (mean.meaning.length <= 28) score += 2;
  return score;
}

function pickEntry(items, query) {
  const normalized = query.toLowerCase();
  return [...items].sort((a, b) => {
    const aExact = String(a.handleEntry || '').toLowerCase() === normalized ? 1 : 0;
    const bExact = String(b.handleEntry || '').toLowerCase() === normalized ? 1 : 0;
    return (bExact - aExact) || Number(b.documentQuality || 0) - Number(a.documentQuality || 0);
  })[0];
}

async function googleTranslate(text, target = 'ko') {
  const url = new URL(GOOGLE_TRANSLATE_URL);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('dt', 'ex');
  url.searchParams.set('q', text);
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!response.ok) throw new Error('Google lookup failed');
  const data = await response.json();
  const translated = (data?.[0] || []).map(row => row?.[0] || '').join('').trim();
  const examples = (data?.[13]?.[0] || [])
    .map(row => stripHtml(row?.[0]))
    .filter(example => example && example.length <= 140);
  return { translated, examples };
}

async function lookupGoogle(word) {
  const meaningResult = await googleTranslate(word, 'ko');
  const example = meaningResult.examples.find(item => item.toLowerCase().includes(word)) || meaningResult.examples[0] || '';
  let exampleKo = '';
  if (example) {
    try {
      exampleKo = (await googleTranslate(example, 'ko')).translated;
    } catch (_) {}
  }
  if (!meaningResult.translated && !example) return null;
  return {
    word,
    meaningKo: meaningResult.translated || '',
    example,
    exampleKo,
    source: 'google',
  };
}

async function lookupNaver(word) {
  const url = new URL(NAVER_SEARCH_URL);
  url.searchParams.set('query', word);
  url.searchParams.set('m', 'pc');
  url.searchParams.set('range', 'all');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('shouldSearchVlive', 'false');

  const naverRes = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://en.dict.naver.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });
  if (!naverRes.ok) throw new Error('Naver lookup failed');

  const data = await naverRes.json();
  const items = data?.searchResultMap?.searchResultListMap?.WORD?.items || [];
  const entry = pickEntry(items, word);
  const means = collectMeans(entry).sort((a, b) => scoreMean(b) - scoreMean(a));
  const best = means[0];
  if (!best) return null;
  return {
    word,
    meaningKo: best.meaning,
    example: best.example || '',
    exampleKo: best.exampleKo || '',
    source: 'naver',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const word = String(req.query.word || '').trim().toLowerCase();
  if (!/^[a-z][a-z'-]{0,40}$/.test(word)) {
    return res.status(400).json({ error: 'Invalid word' });
  }

  try {
    let result = null;
    try {
      result = await lookupNaver(word);
    } catch (_) {}
    if (!result || !result.meaningKo || !result.example || !result.exampleKo) {
      let googleResult = null;
      try {
        googleResult = await lookupGoogle(word);
      } catch (_) {}
      result = {
        word,
        meaningKo: result?.meaningKo || googleResult?.meaningKo || '',
        example: result?.example || googleResult?.example || '',
        exampleKo: result?.exampleKo || googleResult?.exampleKo || '',
        source: result?.source && googleResult?.source ? 'naver+google' : result?.source || googleResult?.source || '',
      };
    }
    if (!result.meaningKo && !result.example) return res.status(404).json({ error: 'Word not found' });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(502).json({ error: 'Lookup failed' });
  }
};
