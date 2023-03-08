const express = require('express')
const path = require('path')
const request = require('request');
const unesc = require('unescape');
const extractor = require('unfluff');

const PORT = process.env.PORT || 5000

const google_api_key = "AIzaSyC_u405rK1uZ78xbe5mXkt3lmSnDU4WsWw";
const google_cs_id = "002997324288046749124:oomoi-5iwda";

let ggl_q1 = (qs, hd, dbg, callback) => {
  let url = `https://www.googleapis.com/customsearch/v1?key=${google_api_key}&cx=${google_cs_id}&q=${encodeURIComponent(qs)}`;
  request(url,
    (error, response, body) => {
      var result = {};
      if(error || dbg) {
        result.search_engine_response = response;
        try {
          result.search_engine_response.body = JSON.parse(body);
        } catch(e) {}
      }
      if(!error) {
        data = JSON.parse(body);
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
        result.href = best_link;
        result.response = best_item;
        result.longtext = best_item;
      }
      // console.log(result);
      callback(result);
    }
  );
};


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
        result.search_engine_response = response;
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
    ggl_q1(q, req.headers, dbg, (a) => {
      res.status(200).json(a);
    });
  })
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
