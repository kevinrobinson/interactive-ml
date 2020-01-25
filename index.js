const tf = window.tf;
const _ = window._;
const mobilenet = window.mobilenet;
const tmImage = window.tmImage;


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
  const {webcam} = params;

  function loop() {
    webcam.update();
    requestAnimationFrame(loop);
  }

  loop();
}

export async function main() {
  // const webcam = await createWebcam();
  // startLoop({webcam});

  // const mobileNet = await mobilenet.load();
  // const predictions = await mobileNet.classify(webcam.canvas);
  // console.log('predictions', predictions);
}
