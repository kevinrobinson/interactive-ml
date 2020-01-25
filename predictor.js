async function main() {
  console.log('p:importing...');
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.5.1/dist/tf.min.js');
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.js');
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@1.0.0');

  console.log('p:setting path...');
  tf.wasm.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm');

  console.log('p:using wasm...');
  await tf.setBackend('wasm');

  /*
  let img = tf.browser.fromPixels(document.getElementById('img'))
      .resizeBilinear([224, 224])
      .expandDims(0)
      .toFloat();

  let model = await tf.loadGraphModel(
    'https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2',
    {fromTFHub: true});
  const y = model.predict(img);
  */
  console.log('p:loading model...');
  const mobileNet = await mobilenet.load();

  console.log('p:ready!')
  self.addEventListener('message', async e => {
    console.log('p:working...');
    const predictions = await mobileNet.classify(e.data); // capture?
    console.log('p:sending...');
    self.postMessage({type: 'predictions', predictions});
  });  
}

console.log('p:main...');
try {
  main();
} catch (err) {
  console.log('worker error:', err);
  self.postMessage(err);
}
