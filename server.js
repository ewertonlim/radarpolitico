const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Normalize URL path and prevent directory traversal
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath.split('?')[0]);

  // Check if file is outside of project directory
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Acesso proibido');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Arquivo não encontrado');
      } else {
        res.writeHead(500);
        res.end(`Erro interno do servidor: ${err.code}`);
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`📡 Radar Político — Servidor de Desenvolvimento`);
  console.log(`🚀 Rodando localmente em: http://localhost:${PORT}`);
  console.log(`👉 Pressione Ctrl+C para encerrar o servidor`);
  console.log(`==================================================`);
});
