// const tf = window.tf;
const _ = window._;
// const mobilenet = window.mobilenet;
// const tmImage = window.tmImage;


function inferMobileNet(tmImageModel, raster) {
  const tfModel = tmImageModel.model;
  const seq = tf.sequential();
  seq.add(_.first(tfModel.layers)); // mobilenet embeddings only
  return seq.predict(capture(raster));
}

// copied
function capture(rasterElement) {
  return tf.tidy(() => {
    const pixels = tf.browser.fromPixels(rasterElement);

    // crop the image so we're using the center square
    const cropped = cropTensor(pixels);

    // Expand the outer most dimension so we have a batch size of 1
    const batchedImage = cropped.expandDims(0);

    // Normalize the image between -1 and a1. The image comes in between 0-255
    // so we divide by 127 and subtract 1.
    return batchedImage.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
  });
}

// copied
function cropTensor(img) {
  const size = Math.min(img.shape[0], img.shape[1]);
  const centerHeight = img.shape[0] / 2;
  const beginHeight = centerHeight - (size / 2);
  const centerWidth = img.shape[1] / 2;
  const beginWidth = centerWidth - (size / 2);
  return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
}

function renderPredictions(tick, predictionsSnapshots) {
  const threshold = 0.80;
  const el = document.querySelector('.CameraPredictions');
  const texts = _.flatMap(predictionsSnapshots, snapshot => {
    const {tick, predictions} = snapshot;
    return _.flatMap(predictions, prediction => {
      const {className, probability} = prediction;
      return (probability >= threshold) ? [className] : [];
    })
  });
  el.innerHTML = `<div>
    <div>tick: ${tick}, snapshots: ${predictionsSnapshots.length}</div>
    <pre>${texts.join("\n")}</pre>
  </div>`;
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
    predictor
  } = params;

  let tick = 0;
  let predictionsSnapshots = [];

  async function loop() {
    tick += 1;

    webcam.update();

    if (tick % 100 === 0) {
      const imageData = webcam.canvas.getContext('2d').getImageData(0, 0, 400, 300);
      predictor.postMessage(imageData);
    }
    
    requestAnimationFrame(loop);
  }

  // start processes
  // predictor.addEventListener('error', err => console.log('err:', err));
  predictor.addEventListener('message', e => {
    const predictions = e.data;
    predictionsSnapshots.push({predictions, tick});
    renderPredictions(tick, predictionsSnapshots);
  });
  loop();
}

export async function main() {
  console.log('making...');
  const predictor = new Worker('predictor.js');

  console.log('okay...');
  const webcam = await createWebcam();

  startLoop({
    webcam,
    predictor
  });
}