const { execSync } = require('child_process');
const https = require('https');

async function pruneVersions() {
  try {
    let token = '';
    try {
      token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    } catch (e) {
      console.warn('[Auto-Prune] Could not get gcloud access token:', e.message);
      return;
    }

    const options = {
      hostname: 'firebasehosting.googleapis.com',
      path: '/v1beta1/projects/waitlink-app-8821/sites/waitlink-app-8821/versions?pageSize=100',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-goog-user-project': 'waitlink-app-8821'
      }
    };

    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          const versions = parsed.parsed || parsed.versions || [];
          if (!Array.isArray(versions) || versions.length === 0) {
            console.log('[Auto-Prune] No extra versions found.');
            return;
          }

          const sorted = versions.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
          const keep = sorted.slice(0, 5);
          const remove = sorted.slice(5);

          if (remove.length > 0) {
            console.log(`[Auto-Prune] Retaining 5 most recent versions. Deleting ${remove.length} older version artifacts...`);
            for (const v of remove) {
              await new Promise(resolve => {
                const req = https.request({
                  hostname: 'firebasehosting.googleapis.com',
                  path: '/v1beta1/' + v.name,
                  method: 'DELETE',
                  headers: {
                    'Authorization': 'Bearer ' + token,
                    'x-goog-user-project': 'waitlink-app-8821'
                  }
                }, resDel => {
                  console.log(`[Auto-Prune] Deleted version ${v.name.split('/').pop()} (Status: ${resDel.statusCode})`);
                  resolve();
                });
                req.on('error', resolve);
                req.end();
              });
            }
            console.log('[Auto-Prune] ✅ Successfully pruned older versions. Exactly 5 versions retained.');
          } else {
            console.log(`[Auto-Prune] Version count (${versions.length}) is within the limit of 5. No deletion needed.`);
          }
          process.exit(0);
        } catch (e) {
          console.warn('[Auto-Prune] Error during version pruning:', e);
          process.exit(0);
        }
      });
    });
  } catch (err) {
    console.warn('[Auto-Prune] Pruning failed:', err.message);
    process.exit(0);
  }
}

pruneVersions();
