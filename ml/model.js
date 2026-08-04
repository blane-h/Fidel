// ml/model.js
// Small dependency-free neural network used as the drawing-correctness checker.
//
// Architecture:
//   INPUTS (436) -> hidden (24, tanh) -> 1 output (sigmoid)
//
// Training:
//   - Binary cross-entropy loss with L2 regularization
//   - Adam optimizer
//   - Optional train/validation split with early stopping
//
// The trained weights are persisted to JSON so they survive restarts and can be
// shipped to whatever process needs them.

'use strict';

const fs = require('fs');
const path = require('path');

const WEIGHTS_PATH = path.join(__dirname, '..', 'model', 'weights.json');

// ---- Math helpers ------------------------------------------------------------

function randomWeight(scale) {
  return (Math.random() * 2 - 1) * scale;
}

function tanh(x) {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e2 = Math.exp(2 * x);
  return (e2 - 1) / (e2 + 1);
}

function tanhDerivative(y) {
  // y is the tanh output.
  return 1 - y * y;
}

function sigmoid(x) {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

// ---- Network -----------------------------------------------------------------

class NeuralNet {
  constructor(inputSize = 436, hiddenSize = 24) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = 1;

    // Xavier-ish init scaled for tanh.
    const inScale = Math.sqrt(6) / Math.sqrt(inputSize + hiddenSize);
    const hidScale = Math.sqrt(6) / Math.sqrt(hiddenSize + 1);

    this.W1 = Array.from({ length: hiddenSize }, () =>
      Array.from({ length: inputSize }, () => randomWeight(inScale))
    );
    this.b1 = new Array(hiddenSize).fill(0);

    this.W2 = Array.from({ length: 1 }, () =>
      Array.from({ length: hiddenSize }, () => randomWeight(hidScale))
    );
    this.b2 = [0];

    // Adam state.
    this.mW1 = this.zerosLike(this.W1);
    this.vW1 = this.zerosLike(this.W1);
    this.mb1 = new Array(hiddenSize).fill(0);
    this.vb1 = new Array(hiddenSize).fill(0);
    this.mW2 = this.zerosLike(this.W2);
    this.vW2 = this.zerosLike(this.W2);
    this.mb2 = [0];
    this.vb2 = [0];
    this.t = 0;
  }

  zerosLike(matrix) {
    return matrix.map((row) => new Array(row.length).fill(0));
  }

  // Forward pass. Returns { hidden, out } where hidden is the hidden layer
  // activations (needed for backprop) and out is the sigmoid output.
  forward(x) {
    const h = new Array(this.hiddenSize);
    for (let j = 0; j < this.hiddenSize; j += 1) {
      let sum = this.b1[j];
      const w = this.W1[j];
      for (let i = 0; i < this.inputSize; i += 1) {
        sum += w[i] * x[i];
      }
      h[j] = tanh(sum);
    }

    let outSum = this.b2[0];
    for (let j = 0; j < this.hiddenSize; j += 1) {
      outSum += this.W2[0][j] * h[j];
    }

    return { hidden: h, out: sigmoid(outSum) };
  }

  predict(x) {
    return this.forward(x).out;
  }

  // Backprop for a single sample with Adam update. Returns loss contributions.
  trainStep(x, y, learningRate, l2) {
    const { hidden, out } = this.forward(x);
    const error = out - y; // derivative of BCE wrt logit for sigmoid

    const dW2 = new Array(this.hiddenSize);
    for (let j = 0; j < this.hiddenSize; j += 1) {
      dW2[j] = error * hidden[j];
    }
    const db2 = error;

    const dHidden = new Array(this.hiddenSize);
    for (let j = 0; j < this.hiddenSize; j += 1) {
      // dHidden = (error * W2[j]) * tanh'(hidden[j])
      const dz = error * this.W2[0][j];
      dHidden[j] = dz * tanhDerivative(hidden[j]);
    }

    const dW1 = Array.from({ length: this.hiddenSize }, () => new Array(this.inputSize).fill(0));
    for (let j = 0; j < this.hiddenSize; j += 1) {
      for (let i = 0; i < this.inputSize; i += 1) {
        dW1[j][i] = dHidden[j] * x[i];
      }
    }
    const db1 = dHidden.slice();

    // Adam update with L2 weight decay added to gradients.
    this.t += 1;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const eps = 1e-8;
    const decay1 = 1 - Math.pow(beta1, this.t);
    const decay2 = 1 - Math.pow(beta2, this.t);

    this.updateWeights(this.W1, this.mW1, this.vW1, dW1, l2, learningRate, beta1, beta2, decay1, decay2, eps);
    this.updateWeights(this.W2, this.mW2, this.vW2, dW2.map((v) => [v]), l2, learningRate, beta1, beta2, decay1, decay2, eps);
    this.updateBias(this.b1, this.mb1, this.vb1, db1, learningRate, beta1, beta2, decay1, decay2, eps);
    this.updateBias(this.b2, this.mb2, this.vb2, [db2], learningRate, beta1, beta2, decay1, decay2, eps);

    // Return per-sample BCE + L2 for reporting.
    const epsLoss = 1e-12;
    const bce = -(y * Math.log(out + epsLoss) + (1 - y) * Math.log(1 - out + epsLoss));
    let l2Loss = 0;
    for (let j = 0; j < this.hiddenSize; j += 1) {
      for (let i = 0; i < this.inputSize; i += 1) l2Loss += this.W1[j][i] * this.W1[j][i];
    }
    for (let j = 0; j < this.hiddenSize; j += 1) l2Loss += this.W2[0][j] * this.W2[0][j];
    l2Loss += (l2 / 2) * l2Loss;

    return { loss: bce + l2Loss, bce };
  }

  updateWeights(W, mW, vW, dW, l2, lr, beta1, beta2, decay1, decay2, eps) {
    for (let j = 0; j < W.length; j += 1) {
      for (let i = 0; i < W[j].length; i += 1) {
        const grad = dW[j][i] + l2 * W[j][i];
        mW[j][i] = beta1 * mW[j][i] + (1 - beta1) * grad;
        vW[j][i] = beta2 * vW[j][i] + (1 - beta2) * grad * grad;
        const mHat = mW[j][i] / decay1;
        const vHat = vW[j][i] / decay2;
        W[j][i] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
      }
    }
  }

  updateBias(b, mb, vb, db, lr, beta1, beta2, decay1, decay2, eps) {
    for (let j = 0; j < b.length; j += 1) {
      const grad = db[j];
      mb[j] = beta1 * mb[j] + (1 - beta1) * grad;
      vb[j] = beta2 * vb[j] + (1 - beta2) * grad * grad;
      const mHat = mb[j] / decay1;
      const vHat = vb[j] / decay2;
      b[j] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
    }
  }

  // ---- Serialization ----------------------------------------------------------

  toJSON() {
    return {
      architecture: 'mlp',
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      W1: this.W1,
      b1: this.b1,
      W2: this.W2,
      b2: this.b2
    };
  }

  static fromJSON(json) {
    const net = new NeuralNet(json.inputSize, json.hiddenSize);
    if (json.W1) net.W1 = json.W1;
    if (json.b1) net.b1 = json.b1;
    if (json.W2) net.W2 = json.W2;
    if (json.b2) net.b2 = json.b2;
    return net;
  }
}

// ---- Training helpers ----------------------------------------------------------

// Accuracy and a confusion matrix for a dataset (list of {x, y}).
function evaluate(net, dataset) {
  let correct = 0;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const sample of dataset) {
    const p = net.predict(sample.x);
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === sample.y) correct += 1;
    if (pred === 1 && sample.y === 1) tp += 1;
    if (pred === 1 && sample.y === 0) fp += 1;
    if (pred === 0 && sample.y === 0) tn += 1;
    if (pred === 0 && sample.y === 1) fn += 1;
  }
  return {
    accuracy: dataset.length ? correct / dataset.length : 0,
    tp,
    fp,
    tn,
    fn,
    total: dataset.length
  };
}

// Find a decision threshold that maximizes balanced accuracy on validation data.
function bestThreshold(net, dataset) {
  if (!dataset.length) return 0.5;
  const scored = dataset.map((s) => ({ p: net.predict(s.x), y: s.y }));
  let bestScore = -1;
  let bestT = 0.5;
  for (let t = 0.05; t <= 0.95; t += 0.025) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const s of scored) {
      const pred = s.p >= t ? 1 : 0;
      if (pred === 1 && s.y === 1) tp += 1;
      if (pred === 1 && s.y === 0) fp += 1;
      if (pred === 0 && s.y === 0) tn += 1;
      if (pred === 0 && s.y === 1) fn += 1;
    }
    const tpr = (tp + fn) === 0 ? 0 : tp / (tp + fn);
    const tnr = (tn + fp) === 0 ? 0 : tn / (tn + fp);
    const balanced = (tpr + tnr) / 2;
    if (balanced > bestScore) {
      bestScore = balanced;
      bestT = t;
    }
  }
  return bestT;
}

// Shuffle a dataset in place (Fisher-Yates).
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Train the network. Returns metrics describing the fit.
// Options:
//   epochs       - max epochs
//   learningRate - Adam base lr
//   l2           - L2 regularization strength
//   valFraction  - fraction held out for validation / threshold selection
//   earlyStop    - stop when validation loss stops improving
function trainModel(dataset, options = {}) {
  const {
    epochs = 2000,
    learningRate = 0.005,
    l2 = 1e-4,
    valFraction = 0.15,
    earlyStop = true
  } = options;

  if (!dataset || dataset.length < 2) {
    throw new Error('Not enough data to train. Need at least 2 labeled samples.');
  }

  // Separate positive/negative so the validation split keeps class balance.
  const positives = shuffle(dataset.filter((s) => s.y === 1));
  const negatives = shuffle(dataset.filter((s) => s.y === 0));

  if (positives.length === 0 || negatives.length === 0) {
    throw new Error('Need at least one correct and one incorrect sample to train.');
  }

  const takeVal = (arr) => Math.max(1, Math.min(arr.length - 1, Math.round(arr.length * valFraction)));

  const valPos = positives.splice(0, takeVal(positives));
  const valNeg = negatives.splice(0, takeVal(negatives));

  const trainSet = shuffle([...positives, ...negatives]);
  const valSet = [...valPos, ...valNeg];

  const net = new NeuralNet(
    dataset[0].x.length,
    options.hiddenSize || 24
  );

  let bestValLoss = Infinity;
  let patience = 0;
  let bestNet = null;

  // Mini-batch size ~32, defaulting to full batch for tiny datasets.
  const batchSize = Math.min(32, Math.max(4, Math.floor(trainSet.length / 4)));

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    shuffle(trainSet);
    let lossSum = 0;
    let bceSum = 0;
    let count = 0;

    for (let start = 0; start < trainSet.length; start += batchSize) {
      const batch = trainSet.slice(start, start + batchSize);
      for (const sample of batch) {
        const r = net.trainStep(sample.x, sample.y, learningRate, l2);
        lossSum += r.loss;
        bceSum += r.bce;
        count += 1;
      }
    }

    const epochLoss = count ? lossSum / count : 0;
    const epochBce = count ? bceSum / count : 0;

    // Validate.
    let valLoss = 0;
    for (const sample of valSet) {
      const epsLoss = 1e-12;
      const p = net.predict(sample.x);
      valLoss += -(sample.y * Math.log(p + epsLoss) + (1 - sample.y) * Math.log(1 - p + epsLoss));
    }
    valLoss /= valSet.length;

    if (earlyStop && valLoss < bestValLoss - 1e-4) {
      bestValLoss = valLoss;
      bestNet = net.toJSON();
      patience = 0;
    } else if (earlyStop) {
      patience += 1;
      if (patience >= 40) {
        if (bestNet) {
          net.importWeights(bestNet);
        }
        break;
      }
    } else if (epoch === epochs - 1) {
      bestNet = net.toJSON();
    }

    if (epoch % 100 === 0) {
      console.log(`[ml] epoch ${epoch}: trainLoss=${epochLoss.toFixed(4)} bce=${epochBce.toFixed(4)} valLoss=${valLoss.toFixed(4)}`);
    }
  }

  if (bestNet) {
    net.importWeights(bestNet);
  }

  const trainEval = evaluate(net, trainSet);
  const valEval = evaluate(net, valSet);
  const threshold = bestThreshold(net, valSet);
  const finalEval = evaluate(net, dataset);

  return {
    net,
    threshold,
    train: trainEval,
    val: valEval,
    final: finalEval,
    sampleCount: dataset.length
  };
}

// Convenience addition: import raw weights to a net instance.
NeuralNet.prototype.importWeights = function importWeights(json) {
  if (json.W1) this.W1 = json.W1;
  if (json.b1) this.b1 = json.b1;
  if (json.W2) this.W2 = json.W2;
  if (json.b2) this.b2 = json.b2;
};

// ---- Persistence -------------------------------------------------------------

function saveModel(net, metadata) {
  fs.mkdirSync(path.dirname(WEIGHTS_PATH), { recursive: true });
  const payload = {
    savedAt: new Date().toISOString(),
    metadata: metadata || {},
    net: net.toJSON()
  };
  fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(payload), 'utf8');
  return payload;
}

function loadModel() {
  if (!fs.existsSync(WEIGHTS_PATH)) {
    return null;
  }
  try {
    const payload = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
    const net = NeuralNet.fromJSON(payload.net);
    net.threshold = payload.metadata?.threshold ?? 0.5;
    net.metadata = payload.metadata || {};
    return net;
  } catch (_error) {
    return null;
  }
}

module.exports = {
  NeuralNet,
  trainModel,
  evaluate,
  bestThreshold,
  saveModel,
  loadModel,
  WEIGHTS_PATH
};
