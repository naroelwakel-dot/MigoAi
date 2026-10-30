import { writeFileSync } from 'node:fs';

const out = [];
const log = (...a) => out.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));

async function j(url, opt = {}, ms = 20000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: c.signal });
    const txt = await r.text();
    return { status: r.status, body: txt.slice(0, 800) };
  } catch (e) {
    return { error: String(e) };
  } finally {
    clearTimeout(t);
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

(async () => {
  log('date', new Date().toISOString());

  log('== JollyMax flow ==');
  const gw = await j('https://api.jollymax.com/aggregate-pay-gate/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Referer': 'https://www.jollymax.com/', 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*' },
    body: JSON.stringify({
      terminalType: 'PC_H5', accessTokenType: 'access_token', bizType: 'userLogin',
      deviceId: 'ddd05e88be7640ffbc949adc705b5cee', loginType: 'visitor',
      loginInfo: { country: 'tr', language: 'en', deviceType: 'mobile' },
      version: '1.0', domain: 'www.jollymax.com'
    })
  });
  log('gateway', gw);
  let token = null;
  try { token = JSON.parse(gw.body).data.token; } catch {}
  log('token?', !!token);
  if (token) {
    for (const id of ['5942485795', '51234567890']) {
      const r = await j('https://topup-center.shoplay365.com/shareit-topup-center/order/check-uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Referer': 'https://www.jollymax.com/', 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*' },
        body: JSON.stringify({
          token, userId: id, appId: 'APP20220811034444301', country: 'tr',
          language: 'en', appAlias: 'pubg', goodsId: 'G20230718123400139',
          payTypeId: '698832', domain: 'www.jollymax.com'
        })
      });
      log('check-uid', id, r);
    }
  }

  log('== isan (free) ==');
  log('ff', await j('https://api.isan.eu.org/nickname/freefire?id=123456789', { headers: { 'User-Agent': UA } }));
  log('ml', await j('https://api.isan.eu.org/nickname/ml?id=1114917746&zone=13486', { headers: { 'User-Agent': UA } }));
  log('pubg', await j('https://api.isan.eu.org/nickname/pubg?id=5942485795', { headers: { 'User-Agent': UA } }));

  log('== rapidapi id-game-checker (existing key) ==');
  const KEY = '04c7fee3aamshd0586dcb6ccc650p1d66f2jsne4624799cc03';
  const rh = { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'id-game-checker.p.rapidapi.com' };
  log('pubgm-global', await j('https://id-game-checker.p.rapidapi.com/pubgm-global?id=5942485795', { headers: rh }));
  log('pubgm', await j('https://id-game-checker.p.rapidapi.com/pubgm?id=5942485795', { headers: rh }));

  log('== done ==');
  const text = out.join('\n') + '\n';
  try { writeFileSync('probe-results.txt', text); } catch (e) { console.log('write fail', e); }
  console.log(text);
})();
