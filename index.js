const express = require('express')
const path = require('path')
const unesc = require('unescape');
// const extractor = require('unfluff');
const settings = require('./settings');

const PORT = process.env.PORT || 5000

const ggl_q1 = async (qs, hd, dbg) => {
  const url = `https://www.googleapis.com/customsearch/v1?key=${settings.google_api_key}&cx=${settings.google_cs_id}&q=${encodeURIComponent(qs)}`;
  let response;
  try {
    response = await fetch(url);
  }
  catch(error) {
    return {};
  }

  const data = await response.json();
  var best_item = "";
  var best_link = "";
  for(var itm of data.items) {
    let s = itm.snippet.replace(/\s+/g, ' ');;
    let l = itm.link;
    if(s.length > best_item.length) {
      best_item = s;
      best_link = l;
    }
  }

  const result = {
    href: best_link,
    response: best_item,
    longtext: best_item
  };

  // console.log(result);
  // callback(result);

  return result;
};


const ddg_q1 = async (qs, hd, dbg) => {
  const rrg = /<a class="result__snippet".*href="(.+?)".*>(.+?)<\/a>/g;
  const headers = { 'User-Agent': hd['user-agent'], 'Accept-Language': hd['accept-language'] };
  const url = 'https://duckduckgo.com/html?q=' + encodeURIComponent(qs);

  let response;
  try {
    response = await fetch(url, { headers })
  }
  catch(error) {
    return {};
  }

  const body = await response.text();
  const m = rrg.exec(body);
  let loadtext = false;
  let result = {};
  if(m) {
    const href = m[1];
    const text = m[2];
    const plaintext = unesc(text.replace(/<b>(.*?)<\/b>/g, '$1'));
    result['response'] = plaintext;
    result['href'] = href;
    loadtext = true;
  } 
  if(!m || dbg) {
    result.search_engine_response = response;
  }

  if (!result.href) {
    return result;
  }

  let response2;
  try {
    await fetch(result.href);
  }
  catch(error) {
    return result;
  }

  result.longtext = await response2.json();
  
  return result;
};

const setCORS = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");
};

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use((req, res, next) => {
    setCORS(res);
    next();
  })
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/short-thought', async (req, res) => {
    const q = req.query.q;
    const dbg = req.query.debug === '1';
    const a = await ggl_q1(q, req.headers, dbg);
    res.status(200).json(a);
  })
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
