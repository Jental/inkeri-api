const express = require('express')
const path = require('path')
const unesc = require('unescape');
// const extractor = require('unfluff');
const openai = require('openai');
const settings = require('./settings');

const PORT = process.env.PORT || 5000;

const openAIconf = new openai.Configuration({
  apiKey: settings.OPENAI_API_KEY,
});
const openAIclient = new openai.OpenAIApi(openAIconf);

const ggl_q1 = async (qs, hd, dbg) => {
  const url = `https://www.googleapis.com/customsearch/v1?key=${settings.google_api_key}&cx=${settings.google_cs_id}&q=${encodeURIComponent(qs)}`;
  let response;
  try {
    response = await fetch(url);
  }
  catch(error) {
    return { error };
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
    return { error };
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

let chatMessages = [];

const openai_send_message = async (message, temperature) => {
  chatMessages.push({
    role: 'user',
    content: message
  });

  console.log('openai_send_message: all:', chatMessages);

  const completion = await openAIclient.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: chatMessages,
    temperature
  });

  for (const choise of completion.data.choices) {
    console.log('choise:', choise.message);;
  }

  if (!completion.data.choices.length) {
    console.log('no choises', completion.data);
    return null;
  }

  const resp = completion.data.choices[0].message;
  if (!resp) {
    console.log('no response', completion.data.choices[0]);
    return null;
  }

  chatMessages.push(resp);

  return resp.content;
}

const openai_init = async (isFemale, name) => {
  chatMessages = [];

  if (isFemale) {
    await openai_send_message('Отвечай в женском роде', 0);
  }

  if (name) {
    await openai_send_message('Представляйся как ' + name, 0);
  }
}

const openai_q1 = async (qs, hd, dbg) => {
  try {
    const resp = await openai_send_message(qs, 0.4);
    
    const result = {
      href: null,
      response: resp,
      longtext: resp
    };

    return result;
  }
  catch(error) {
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      
      return { error: error.response };
    }
  }
}

const setCORS = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");
};

express()
  .use(express.json())
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
  .post('/chat-init', async (req, res) => {
    console.log('chat-init: body:', req.body);
    const isFemale = req.body?.female ?? false;
    const name = req.body?.name ?? null;
    await openai_init(isFemale, name);
    res.status(200).send();
  })
  .get('/chat', async (req, res) => {
    const q = req.query.q;
    const dbg = req.query.debug === '1';
    const a = await openai_q1(q, req.headers, dbg);
    res.status(200).json(a);
  })
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
