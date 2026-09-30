    (function () {
      var errorCount = 0;
      function handleFatalError(msg) {
        errorCount++;
        if (errorCount > 3) return;
        console.error('[GlobalErrorHandler]', msg);
        var root = document.getElementById('root');
        if (root && (!root.innerHTML || root.innerHTML.trim().length < 50)) {
          root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:80vh;padding:24px;font-family:system-ui,sans-serif;">' +
            '<div style="text-align:center;max-width:360px;">' +
            '<p style="font-size:18px;font-weight:600;margin-bottom:12px;">頁面載入發生問題</p>' +
            '<p style="font-size:14px;color:#666;margin-bottom:20px;">請重新載入頁面，或返回首頁</p>' +
            '<button id="load-error-retry" style="padding:8px 20px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;margin-right:8px;font-size:14px;">重新載入</button>' +
            '<button id="load-error-home" style="padding:8px 20px;border-radius:8px;border:none;background:#14685B;color:#fff;cursor:pointer;font-size:14px;">返回首頁</button>' +
            '</div></div>';
          document.getElementById('load-error-retry').addEventListener('click', function () { location.reload(); });
          document.getElementById('load-error-home').addEventListener('click', function () { location.href = '/'; });
        }
      }
      window.addEventListener('error', function (e) {
        if (e.message && (e.message.indexOf('Loading chunk') !== -1 || e.message.indexOf('module script') !== -1 || e.message.indexOf('dynamically imported') !== -1)) {
          handleFatalError(e.message);
        }
      });
      window.addEventListener('unhandledrejection', function (e) {
        var msg = e.reason ? (e.reason.message || String(e.reason)) : '';
        if (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('module script') !== -1 || msg.indexOf('dynamically imported') !== -1 || msg.indexOf('Failed to fetch') !== -1) {
          handleFatalError(msg);
        }
      });
    })();
