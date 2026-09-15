export const invitationLanding = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>WeChurch 測試邀請</title><style>body{margin:0;background:#f8faf9;color:#203638;font:16px system-ui}main{max-width:420px;margin:12vh auto;padding:24px}h1{font-size:26px}p{line-height:1.7}button{width:100%;min-height:48px;border:0;border-radius:6px;background:#176c60;color:white;font:inherit}button:disabled{opacity:.5}</style><script src="/__staging/invite.js" defer></script></head><body><main><h1>一起測試 WeChurch</h1><p>B 測試站，與正式站資料分開。請使用測試內容，不填寫真實牧養隱私。</p><form method="post" action="/__staging/access"><input type="hidden" name="ticket"><input type="hidden" name="group"><button disabled>接受邀請，開始測試</button></form><p id="status" role="status">正在確認邀請連結…</p><noscript>請啟用 JavaScript，或向邀請人索取測試邀請碼。</noscript></main></body></html>`;

// Tokens stay in the fragment, outside access logs and referrer headers.
export const invitationScript = `const params=new URLSearchParams(location.hash.slice(1));
history.replaceState(null,'',location.pathname);
const ticket=params.get('ticket')||'',group=params.get('group')||'';
if(/^\\d{13}\\.[a-f0-9]{64}$/.test(ticket)&&Number(ticket.split('.')[0])>Date.now()&&(!group||/^[a-f0-9]{48}$/.test(group))){
document.querySelector('[name=ticket]').value=ticket;document.querySelector('[name=group]').value=group;
document.querySelector('button').disabled=false;document.querySelector('#status').textContent='請使用自己的帳號；小組加入仍需小組長確認。';
}else{document.querySelector('#status').textContent='邀請連結無效或已過期，請向邀請人索取新連結。';}`;
