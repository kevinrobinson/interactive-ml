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

// bounds are precomputed with map, so that the
// scale doesn't jump over time
const bounds = [
  [-2.5845954360958383, 5.083864345107571],
  [1.8873721575352675, 5.083864345107571],
  [-2.5845954360958383, 0.49011926855316595],
  [1.8873721575352675, 0.49011926855316595],
];
function plotText(scatterGL, xys, texts) {
  const points = xys.concat(bounds);
  const metadata = points.map((xy, index) => {
    const color = (index >= xys.length) ? 'rbga(0,0,0,0)' : '';
    return {
      label: texts[index] || '',
      color,
    };
  });
  const dataset = new ScatterGL.Dataset(points, metadata);
  scatterGL.setPointColorer(i => dataset.metadata[i].color);
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

function renderCameraPredictions(tick, predictionsSnapshots, selectionTextIndexes, knobs) {
  const {predictionThreshold} = knobs;
  const el = document.querySelector('.CameraPredictions');
  const prediction = _.last(predictionsSnapshots).predictions[0];
  el.innerHTML = `<div>
    <pre>tick: ${tick}, snapshots: ${predictionsSnapshots.length}</pre>
    <pre>${prediction.probability.toFixed(2)}:  ${prediction.className}</pre>
    <pre>${selectionTextIndexes.join(' ')}</pre>
  </div>`;
}

function renderTextThumbnails(thumbnailsEl, texts, selectionTextIndexes) {
  thumbnailsEl.innerHTML = '';
  const indexes = {};
  texts.forEach((text, index) => indexes[text] = index);
  _.sortBy(texts).forEach(text => {
    const index = indexes[text];
    const textEl = document.createElement('div');
    textEl.classList.add('Text');
    if (selectionTextIndexes.indexOf(index) !== -1) {
      textEl.classList.add('Text-selected');
    }
    textEl.setAttribute('data-index', index);
    textEl.textContent = text;
    thumbnailsEl.appendChild(textEl);
  });
}

function updateImageThumbnails(thumbnailsEl, imageEls, selectionImageIndexes) {
  imageEls.forEach((canvasEl, index) => {
    if (selectionImageIndexes.indexOf(index) === -1) {
      canvasEl.classList.remove('ImageThumbnail-selected');
    } else {
      canvasEl.classList.add('ImageThumbnail-selected');
    }
  });
}

function addImage(index, tick, imageData, predictions, knobs) {
  const {scaleThumbnail} = knobs;
  
  // Put raw image data
  const snapshot = document.createElement('canvas');
  snapshot.width = 400;
  snapshot.height = 300;
  snapshot.getContext('2d').putImageData(imageData, 0, 0);

  // Scale it down
  const width = Math.round(400 * scaleThumbnail);
  const height = Math.round(300 * scaleThumbnail);
  const thumbnailEl = document.createElement('canvas');
  thumbnailEl.classList.add('ImageThumbnail');
  thumbnailEl.setAttribute('data-index', index);
  thumbnailEl.width = width;
  thumbnailEl.height = height;
  thumbnailEl.style.width = `${width}px`;
  thumbnailEl.style.height = `${height}px`;
  const ctx = thumbnailEl.getContext('2d');
  ctx.drawImage(snapshot, 0, 0, width, height);

  const thumbnailsEl = document.querySelector('.ImageThumbnails');
  thumbnailsEl.appendChild(thumbnailEl);

  return thumbnailEl;
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


class App {
  constructor() {
    this.webcam = null;
    this.predictor = null;
    this.textProjector = null;
    this.scatterGL = null;

    this.tick = 0;
    this.images = [];
    this.predictionsSnapshots = [];
    this.texts = [];
    this.textsQueued = {};

    this.selectionTextIndexes = [];
    this.selectionImageIndexes = [];

    this.knobs = {
      initialTicksBeforePrediction: 100,
      ticksPerPrediction: 20,
      predictionThreshold: 0.05,
      scaleThumbnail: 0.15,
      webcamWarmupTicks: 100
    };

    this.textThumbnailsEl = document.querySelector('.TextsThumbnails');
    this.imageThumbnailsEl = document.querySelector('.ImageThumbnails');

    this.loop = this.loop.bind(this);
    this.onTextProjectedMessage = this.onTextProjectedMessage.bind(this);
    this.onPredictionMessage = this.onPredictionMessage.bind(this);   
    this.onTextScatterClick = this.onTextScatterClick.bind(this);
    this.onTextThumbnailClicked = this.onTextThumbnailClicked.bind(this);
    this.onImageThumbnailClicked = this.onImageThumbnailClicked.bind(this);
  }

  async start() {
    console.log('spinning up workers...');
    this.predictor = new Worker('workerPredictor.js');
    this.textProjector = new Worker('workerTextProjector.js');

    console.log('starting webcam...');
    this.webcam = await createWebcam();

    console.log('adding projector...')
    const el = document.querySelector('.TextsProjection');
    this.scatterGL = new ScatterGL(el, {
      showLabelsOnHover: false,
      onClick: this.onTextScatterClick,
      // onHover: this.onTextScatterHover,
      // onSelect: this.onTextScatterSelect,
    });
    this.scatterGL.setDimensions(2);
    const dataset = new ScatterGL.Dataset([[0,0]]);
    this.scatterGL.render(dataset);

    // event listeners
    this.predictor.addEventListener('message', this.onPredictionMessage);
    this.textProjector.addEventListener('message', this.onTextProjectedMessage);
    this.textThumbnailsEl.addEventListener('click', this.onTextThumbnailClicked);
    this.imageThumbnailsEl.addEventListener('click', this.onImageThumbnailClicked);

    // kick off main loop
    this.loop();
  }

  postImageForPrediction() {
    const imageData = this.webcam.canvas.getContext('2d').getImageData(0, 0, 400, 300);
    this.predictor.postMessage({
      imageData,
      tick: this.tick
    });
  }

  onTextThumbnailClicked(e) {
    const textIndex = parseInt(e.target.dataset.index, 10);
    this.selectionTextIndexes = [textIndex];
    this.updateSelection();
  }

  onImageThumbnailClicked(e) {
    const imageIndex = parseInt(e.target.dataset.index, 10);
    console.log('e', e, imageIndex);
    this.selectionImageIndexes = [imageIndex];
    this.updateSelection();
  }

  onTextScatterClick(textIndex) {
    this.selectionTextIndexes = [textIndex];
    this.updateSelection();
  }

  onTextProjectedMessage(e) {
    const xys = e.data;
    plotText(this.scatterGL, xys, this.texts);
  }

  onPredictionMessage(e) {
    const payload = e.data;
    this.predictionsSnapshots.push({
      predictions: payload.predictions,
      tick: payload.tick
    });

    // track what texts we've seen, queue embeddings for new text
    const predictedTexts = flatTexts(payload.predictions, this.knobs);
    const newTexts = predictedTexts.filter(text => this.textsQueued[text] === undefined);
    newTexts.forEach(text => {
      this.texts.push(text);
      this.textsQueued[text] = true;
    });

    // update UI, track elements, post to text
    renderCameraPredictions(payload.tick, this.predictionsSnapshots, this.selectionTextIndexes, this.knobs);
    const thumbnailEl = addImage(this.images.length, payload.tick, payload.imageData, payload.predictions, this.knobs);
    this.images.push(thumbnailEl);
    this.textProjector.postMessage(this.texts);
    this.updateSelection();
  }

  loop() {
    this.tick += 1;
    this.webcam.update();

    const shouldGrabImage = (
      (this.tick > this.knobs.initialTicksBeforePrediction) &&
      (this.tick % this.knobs.ticksPerPrediction === 0)
    );
    if (shouldGrabImage) {
      this.postImageForPrediction();
    }
    
    requestAnimationFrame(this.loop);
  }

  updateSelection() {
    renderTextThumbnails(this.textThumbnailsEl, this.texts, this.selectionTextIndexes);
    updateImageThumbnails(this.imageThumbnailsEl, this.images, this.selectionImageIndexes);
  }
}


export function main() {
  const app = new App();
  app.start();
}