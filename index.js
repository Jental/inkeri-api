const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const request = require('request');
const unesc = require('unescape');

let ddg_q1 = (qs, callback) => {
  let rrg = /<a class="result__snippet" .+?>(.+?)<\/a>/g;
  request('https://duckduckgo.com/html?q=' + encodeURIComponent(qs), (error, response, body) => {
    let m = rrg.exec(body);
    if(m) {
      let text = m[1];
      let plaintext = unesc(text.replace(/<b>(.*?)<\/b>/g, '$1'));
      callback({'response': plaintext});
    } else
      console.log("DDG returned nothing...");
      console.log(body.substring(0,256));
      callback({'ddg_body': body});
  });
}

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', "Origin, X-Requested-With, Content-Type, Accept");
    next();
  })
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/short-thought', (req, res) => {
    let q = req.query.q;
    ddg_q1(q, (r) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(r));
    });
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
