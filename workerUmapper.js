// This doesn't work inside the async fn, and it also
// expects `window` so we give it a dummy one.
console.debug('u:importing...');
const window = {};
importScripts("https://unpkg.com/umap-js@1.3.0/lib/umap-js.js");
const UMAP = window.UMAP;
console.debug('u:imported');


async function main() {  
  // let umap = new UMAP();
  let calls = 0;
  console.debug('u:ready!')

  self.addEventListener('message', async e => {
    const {type} = e.data;
    console.log('UUUU: i hear you');
    // if (type === 'reset') {
    //   umap = new UMAP();
    //   return;
    // }

    if (type === 'fit') {
      console.debug('u:fitting...', e.data.embeddings.length);
      const umap = new UMAP();
      const fit = umap.fit(e.data.embeddings);
      console.log("FITu", fit);
      self.postMessage({
        type: 'fit',
        value: fit
      });
      return;
    }

    // if (type === 'fit') {
    //   calls += 1;
    //   if (calls === 1) {
    //     console.debug('u:fitting...', e.data.embeddings);
    //     const fit = umap.fit(e.data.embeddings);
    //     console.log("FITu", fit);
    //     self.postMessage({
    //       type: 'fit',
    //       value: fit
    //     });
    //   } else {
    //     console.debug('u:tranforming...', e.data.embeddings);
    //     const transformed = umap.transform(e.data.embeddings);
    //     console.log("TRANSFORMu", transformed);
    //     self.postMessage({
    //       type: 'fit',
    //       value: tranformed
    //     });
    //   }
    //   return;
    // }

    // if (type === 'transform') {
    //   console.debug('u:transforming...');
    //   self.postMessage({
    //     type: 'transform',
    //     value: umap.transform(e.data.embeddings)
    //   });
    //   return;
    // }
  });
}

console.debug('u:main...');
try {
  main();
} catch (err) {
  console.debug('worker error:', err);
  self.postMessage(err);
}