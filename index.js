const express = require('express')
const path = require('path')
const request = require('request');
const unesc = require('unescape');
const extractor = require('unfluff');

const PORT = process.env.PORT || 5000

let ddg_q1 = (qs, hd, dbg, callback) => {
  let rrg = /<a class="result__snippet".*href="(.+?)".*>(.+?)<\/a>/g;
  let headers = { 'User-Agent': hd['user-agent'], 'Accept-Language': hd['accept-language'] }
  request(
    {
      'url': 'https://duckduckgo.com/html?q=' + encodeURIComponent(qs),
      'headers': headers // hope it will help to not get banned by DDG =)
    },
    (error, response, body) => {
      let result = {}
      let m = rrg.exec(body);
      let loadtext = false;
      if(m) {
        let href = m[1];
        let text = m[2];
        let plaintext = unesc(text.replace(/<b>(.*?)<\/b>/g, '$1'));
        result['response'] = plaintext;
        result['href'] = href;
        loadtext = true;
      } 
      if(!m || dbg) {
        result['ddg_response'] = response;
      }

      if(!result.href) {
        callback(result);
      } else {
        request(result.href, (error, response, body) => {
          if(!error) {
            data = extractor(body);
            result.longtext = data.text;
          } else {
            result['long_response'] = response;
          }
          callback(result);
        });
      }
    }
  );
};

let setCORS = (res) => {
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
  .get('/short-thought', (req, res) => {
    let q = req.query.q;
    let dbg = req.query.debug === '1';
    ddg_q1(q, req.headers, dbg, (a) => {
      res.status(200).json(a);
    });
  })
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
