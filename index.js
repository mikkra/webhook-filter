/* eslint-disable indent-legacy, no-process-env */
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const bl = require('bl');
const snekfetch = require('snekfetch');

// Load config and build list of refs to block
const config = JSON.parse(process.env.JSON_CONFIG || fs.readFileSync('./config.json', 'utf8') || '{}');
const PORT = process.env.PORT || 1337;
if(Object.keys(config).length < 1) {
	console.error('Can\'t read config file. Provide JSON_CONFIG env or config.json file.');
	return;
}
const refs = {};
for(const [repo, options] of Object.entries(config.rules)) {
  refs[repo] = options;
}

http.createServer((req, res) => {
  // Make sure all headers are present
  const signature = req.headers['x-hub-signature'];
  const event = req.headers['x-github-event'];
  const id = req.headers['x-github-delivery'];
  if(!signature || !event || !id) {
    res.writeHead(400, { 'Content-type': 'application/json' });
    res.end('{"error":"Invalid request headers."}');
    return;
  }

  req.pipe(bl(async(err, data) => {
    // Handle unknown errors
    if(err) {
      res.writeHead(400, { 'Content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }

    // Make sure the request isn't too large
    if(data.length > 30720) {
      res.writeHead(400, { 'Content-type': 'application/json' });
      res.end('{"error":"Request too large."}');
      return;
    }

    // Parse the data
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch(err2) {
      res.writeHead(400, { 'Content-type': 'application/json' });
      res.end(JSON.stringify({ error: err2.message }));
      return;
    }

    const repo = payload.repository && payload.ref ? payload.repository.full_name : null;

    // Verify the secret

    if(event === 'push' && repo && refs[repo]) {
      const secret = `sha1=${crypto.createHmac('sha1', refs[repo].secret).update(data).digest('hex')}`;
      if(!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(secret))) {
        res.writeHead(400, { 'Content-type': 'application/json' });
        res.end('{"error":"Invalid secret."}');
        return;
      }

      if(refs[repo].branches.some(pattern => payload.ref.match(pattern))) {
        // Forward event to webhook
        try {
          console.info(`Forwarding ${event} event for ${repo}#${payload.ref}: ${payload.after}`);
          await snekfetch.post(refs[repo].webhook, {
            data: payload,
            headers: {
              'content-type': 'application/json',
              'x-github-event': event,
              'x-github-delivery': id
            }
          });
          res.writeHead(200, { 'Content-type': 'application/json' });
          res.end(JSON.stringify({ message: 'Webhook forwarded' }));
        } catch(err2) {
          console.error('Error while forwarding event:', err2);
          res.writeHead(500, { 'Content-type': 'application/json' });
          res.end(JSON.stringify({ error: err2.message }));
          return;
        }
        return;
      }

      console.log(`Skipping ${event} event for ${repo}#${payload.ref}: ${payload.after}`);
      res.writeHead(200, { 'Content-type': 'application/json' });
      res.end('{"message":"Your event/branch is not whitelisted"}');
    }
    res.writeHead(500, { 'Content-type': 'application/json' });
    res.end(JSON.stringify({ error: "Can't read json payload or target ref" }));
  }));
}).listen(PORT, err => {
  if(err) console.error('Error starting HTTP server:', err);
  else console.log(`Listening on port ${PORT}.`);
});

process.on('unhandledRejection', err => {
  console.error('Unhandled Promise rejection:', err);
});
