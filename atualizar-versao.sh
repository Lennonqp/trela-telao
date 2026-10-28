#!/bin/sh
# Troca o número de versão dos arquivos nas páginas, pra o navegador não usar cópia antiga.
V=$(date +%Y%m%d%H%M)
sed -i -E "s#(src|href)=\"(config\.js|marca\.js|comum\.js|equipe\.js|estilo\.css)(\?v=[0-9]+)?\"#\1=\"\2?v=$V\"#g" index.html telao.html balcao.html bar.html encara.html
echo "Versão $V"
