const fs = require('fs');
const {UMAP} = require('umap-js');
// const _ = require('lodash');
// const tf = require('@tensorflow/tfjs');
// const use = require('@tensorflow-models/universal-sentence-encoder');
// require('@tensorflow/tfjs-node');


function main() {
  console.log('loading...');
  const texts = JSON.parse(fs.readFileSync('./texts.json').toString());
  const embeddings = JSON.parse(fs.readFileSync('./embeddings.json').toString());
  
  console.log('fitting...');
  const umap = new UMAP();
  const xys = umap.fit(embeddings);

  console.log('writing...');
  const map = {};
  xys.forEach((xy, index) => map[texts[index]] = xy)
  fs.writeFileSync('./map.json', JSON.stringify(map));
  console.log('Done.');

  // console.log('transforming...');
  // const transformed = umap.transform(embeddings.slice(300));

  // console.log('Done.', texts.length, embeddings.length, fit.length, transformed.length);
  // console.log('fitting...');
  // const umap = new UMAP();
  // const fit = umap.fit(embeddings.slice(0, 300));

  // console.log('transforming...');
  // const transformed = umap.transform(embeddings.slice(300));

  // console.log('Done.', texts.length, embeddings.length, fit.length, transformed.length);
}
main();
