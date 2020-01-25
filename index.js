const tf = window.tf;
const _ = window._;
// const tmImage = window.tmImage;

// // copied
// function capture(rasterElement) {
//   return tf.tidy(() => {
//     const pixels = tf.browser.fromPixels(rasterElement);

//     // crop the image so we're using the center square
//     const cropped = cropTensor(pixels);

//     // Expand the outer most dimension so we have a batch size of 1
//     const batchedImage = cropped.expandDims(0);

//     // Normalize the image between -1 and a1. The image comes in between 0-255
//     // so we divide by 127 and subtract 1.
//     return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
//   });
// }

// // copied
// function cropTensor(img) {
//   const size = Math.min(img.shape[0], img.shape[1]);
//   const centerHeight = img.shape[0] / 2;
//   const beginHeight = centerHeight - (size / 2);
//   const centerWidth = img.shape[1] / 2;
//   const beginWidth = centerWidth - (size / 2);
//   return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
// }

function plotText(scatterGL, xys, texts) {
  const metadata = xys.map((xy, index) => {
    return {label: texts[index]};
  });
  const dataset = new ScatterGL.Dataset(xys, metadata);
  scatterGL.render(dataset);
}

function flatTexts(predictions, knobs) {
  const {predictionThreshold} = knobs;
  const textsMaxProbability = {};
  predictions.forEach(prediction => {
    const {className, probability} = prediction;
    const texts = className.split(',').map(s => s.trim());
     texts.forEach(text => {
      if (probability >= predictionThreshold && probability >= (textsMaxProbability[text] || 0)) {
        textsMaxProbability[text] = probability;
      }
    });
  });
  return Object.keys(textsMaxProbability);
}

function renderCameraPredictions(tick, predictionsSnapshots, knobs) {
  const {predictionThreshold} = knobs;
  const el = document.querySelector('.CameraPredictions');
  const prediction = _.last(predictionsSnapshots).predictions[0];
  el.innerHTML = `<div>
    <pre>tick: ${tick}, snapshots: ${predictionsSnapshots.length}</pre>
    <pre>${prediction.probability.toFixed(2)}:  ${prediction.className}</pre>
  </div>`;
}

function renderTextThumbnails(texts) {
  const thumbnailsEl = document.querySelector('.TextsThumbnails');
  thumbnailsEl.innerHTML = '';
  texts.forEach(text => {
    const textEl = document.createElement('div');
    textEl.classList.add('Text');
    textEl.textContent = text;
    thumbnailsEl.appendChild(textEl);
  });
}


function addImage(tick, imageData, predictions, knobs) {
  const {scaleThumbnail} = knobs;
  
  // Put raw image data
  const snapshot = document.createElement('canvas');
  snapshot.width = 400;
  snapshot.height = 300;
  snapshot.getContext('2d').putImageData(imageData, 0, 0);

  // Scale it down
  const thumbnailEl = document.createElement('canvas');
  thumbnailEl.classList.add('ImageThumbnail');
  thumbnailEl.width = 40;
  thumbnailEl.height = 30;
  thumbnailEl.style.width = Math.round(40) + 'px';
  thumbnailEl.style.height = Math.round(30) + 'px';
  const ctx = thumbnailEl.getContext('2d');
  ctx.drawImage(snapshot, 0, 0, 40, 30);

  const thumbnailsEl = document.querySelector('.ImageThumbnails');
  thumbnailsEl.appendChild(thumbnailEl);
}

function addEmbedding(text, embedding) {
  // console.log('addEmbedding', text, embedding);
}


async function createWebcam() {
  // webcam has a square ratio and is flipped by default to match training
  const webcam = new tmImage.Webcam(400, 300, true);
  await webcam.setup();
  webcam.play();
  document.querySelector('.Camera').appendChild(webcam.canvas);
  webcam.update();
  return webcam;
}

function startLoop(params) {
  const {
    webcam,
    predictor,
    textProjector,
    scatterGL
  } = params;
  const knobs = {
    predictionThreshold: 0.05,
    scaleThumbnail: 0.10,
    webcamWarmupTicks: 200
  };
  let sessionTimestamp = (new Date()).getTime();
  let tick = 0;
  let predictionsSnapshots = [];
  let texts = [];
  let textsQueued = {};

  async function loop() {
    tick += 1;

    webcam.update();

    if (tick > knobs.webcamWarmupTicks && tick % 50 === 0) {
      const imageData = webcam.canvas.getContext('2d').getImageData(0, 0, 400, 300);
      predictor.postMessage({imageData, tick});
    }
    
    requestAnimationFrame(loop);
  }

  // start processes
  // MobileNet predictor
  predictor.addEventListener('message', e => {
    const payload = e.data;
    predictionsSnapshots.push({
      predictions: payload.predictions,
      tick: payload.tick
    });

    // track what texts we've seen, queue embeddings for new text
    const predictedTexts = flatTexts(payload.predictions, knobs);
    const newTexts = predictedTexts.filter(text => textsQueued[text] === undefined);
    newTexts.forEach(text => {
      texts.push(text);
      textsQueued[text] = true;
      console.log('SEND text', text);
    });

    // update UI
    renderCameraPredictions(payload.tick, predictionsSnapshots, knobs);
    addImage(payload.tick, payload.imageData, payload.predictions, knobs);
    renderTextThumbnails(texts);
    textProjector.postMessage(texts);
  });

  // Projected text embeddings to UMAP 
  textProjector.addEventListener('message', e => {
    const xys = e.data;
    plotText(scatterGL, xys, texts);
  });

  loop();
}

export async function main() {
  console.log('spinning up workers...');
  const predictor = new Worker('workerPredictor.js');
  const textProjector = new Worker('workerTextProjector.js');
  // const workerPrecompute = new Worker('workerPrecompute.js');

  console.log('starting webcam...');
  const webcam = await createWebcam();

  console.log('adding projector...')
  const el = document.querySelector('.TextsProjection');
  const scatterGL = new ScatterGL(el, {
    onHover: p => console.log('onHover', p),
    onClick: p => console.log('onClick', p),
    onSelect: ps => console.log('onSelect', ps)
  });
  scatterGL.setDimensions(2);
  const dataset = new ScatterGL.Dataset([[0,0]]);
  scatterGL.render(dataset);

  // scatterGL.setTextRenderMode();

  console.log('running loop...');
  startLoop({
    webcam,
    predictor,
    textProjector,
    scatterGL
  });
}