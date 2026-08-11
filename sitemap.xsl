<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:html="http://www.w3.org/TR/REC-html40" xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Inter AI Study Buddy — Sitemap</title>
  <meta name="robots" content="noindex"/>
  <style>
    body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:40px}
    .card{max-width:720px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 10px 40px -10px rgba(79,70,229,.15)}
    h1{font-size:22px;margin:0 0 6px}
    p{color:#64748b;font-size:13px;margin:0 0 16px;line-height:1.6}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;padding:8px;border-bottom:1px solid #e2e8f0}
    td{padding:10px 8px;border-bottom:1px solid #f1f5f9}
    a{color:#4f46e5;text-decoration:none;font-weight:600}
    a:hover{text-decoration:underline}
    .badge{display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px}
  </style>
</head>
<body>
  <div class="card">
    <h1>📚 Inter AI Study Buddy — Sitemap</h1>
    <p>This page is for <b>Google Search Console</b> — not for students. Students, please go to <a href="https://mahicouragw.github.io/Help-studies-fish/">Home Page</a>. <br/>Google uses this file to find all pages. You don't need to read all URLs.</p>
    <p><span class="badge">No need to click Add files / Enter / Done — just close this tab and open Home</span></p>
    <table>
      <tr><th>URL</th><th>Priority</th></tr>
      <xsl:for-each select="sitemap:urlset/sitemap:url">
        <tr>
          <td><a><xsl:attribute name="href"><xsl:value-of select="sitemap:loc"/></xsl:attribute><xsl:value-of select="sitemap:loc"/></a></td>
          <td><xsl:value-of select="sitemap:priority"/></td>
        </tr>
      </xsl:for-each>
    </table>
    <p style="margin-top:16px">✔️ If you see this nice table, sitemap is working! Close this and open <a href="https://mahicouragw.github.io/Help-studies-fish/">Inter AI Study Buddy</a>.</p>
  </div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
