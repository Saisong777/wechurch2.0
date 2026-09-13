import { useEffect, useState } from 'react';

export function DeploymentBanner() {
  const [staging, setStaging] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/deployment', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(data => { if (active) setStaging(data?.staging === true); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!staging) return null;
  return <aside className="border-b border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs leading-5 text-emerald-950" aria-label="測試環境">B 測試站 · 請使用測試資料，不會同步至正式站</aside>;
}
