function setJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readRawBody(req, maxBytes = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('요청 파일이 너무 큽니다.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJsonBody(req, maxBytes = 100 * 1024) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return readRawBody(req, maxBytes).then((buffer) => JSON.parse(buffer.toString('utf8') || '{}'));
}

module.exports = { setJson, readRawBody, readJsonBody };
