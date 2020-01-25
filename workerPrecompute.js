function debug(...params) {
  console.debug(...params);
}

// This doesn't work inside the async fn, and it also
// expects `window` so we give it a dummy one.
const window = {};
importScripts("https://unpkg.com/umap-js@1.3.0/lib/umap-js.js");
const UMAP = window.UMAP;


async function main() {
  debug('e:importing...');
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.5.1/dist/tf.min.js');
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');
  importScripts('https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js');

  // "gather" doesn't appear to be implemented in wasm in 1.5.1
  // see https://github.com/tensorflow/tfjs/pull/2601
  //
  // importScripts('./tfjs-dist/tf.min.js');
  // importScripts('./tfjs-backend-wasm-dist/index.js');
  // debug('e:setting path...');
  // tf.wasm.setWasmPath('./tfjs-backend-wasm-dist/tfjs-backend-wasm.wasm');
  // debug('e:using wasm...');
  await tf.setBackend('cpu');

  // Import all ImageNet classes, so we can project them and fit them into UMAP
  // space all at once.  This keeps the umap transformation stable as we discover
  // new mobile net predictions.
  debug('e:loading imagenet classes...');
  importScripts('./imagenet_classes.js');
  
  debug('e:loading use model...');
  const model = await use.load();

  debug('e:projecting all class names to embeddings...');
  const texts = _.flatMap(Object.values(IMAGENET_CLASSES), className => className.split(',').map(t => t.trim()));
  const embeddings = await Promise.all(texts.slice(0, 200).map(async text => {
    console.log('embedding text...', text);
    const embeddingTensor = await model.embed([text]);
    console.log('fetching data...', text);
    return embeddingTensor.dataSync();
  }));
  console.log('DONE!', embeddings.length);
  console.log(JSON.stringify({texts, embeddings}));
}

debug('e:main...');
try {
  main();
} catch (err) {
  debug('worker error:', err);
  self.postMessage(err);
}

