import json
import math
import os
import random
from pathlib import Path

import numpy as np

WEIGHTS_PATH = Path(__file__).parent.parent / 'model' / 'weights.json'


def _random_weight(scale: float) -> float:
    return (random.random() * 2 - 1) * scale


def _tanh(x: float) -> float:
    if x > 20:
        return 1.0
    if x < -20:
        return -1.0
    e2 = math.exp(2 * x)
    return (e2 - 1) / (e2 + 1)


def _tanh_derivative(y: float) -> float:
    return 1 - y * y


def _sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


class NeuralNet:
    def __init__(self, input_size: int = 436, hidden_size: int = 24):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_size = 1

        in_scale = math.sqrt(6) / math.sqrt(input_size + hidden_size)
        hid_scale = math.sqrt(6) / math.sqrt(hidden_size + 1)

        self.W1 = np.array([[_random_weight(in_scale) for _ in range(input_size)] for _ in range(hidden_size)], dtype=np.float64)
        self.b1 = np.zeros(hidden_size, dtype=np.float64)

        self.W2 = np.array([[_random_weight(hid_scale) for _ in range(hidden_size)]], dtype=np.float64)
        self.b2 = np.zeros(1, dtype=np.float64)

        self.mW1 = np.zeros_like(self.W1)
        self.vW1 = np.zeros_like(self.W1)
        self.mb1 = np.zeros_like(self.b1)
        self.vb1 = np.zeros_like(self.b1)
        self.mW2 = np.zeros_like(self.W2)
        self.vW2 = np.zeros_like(self.W2)
        self.mb2 = np.zeros_like(self.b2)
        self.vb2 = np.zeros_like(self.b2)
        self.t = 0

    def forward(self, x: np.ndarray):
        h = np.tanh(self.W1 @ x + self.b1)
        out_sum = float(self.W2 @ h + self.b2[0])
        out = _sigmoid(out_sum)
        return h, out

    def predict(self, x) -> float:
        _, out = self.forward(np.array(x, dtype=np.float64))
        return out

    def train_step(self, x: np.ndarray, y: float, learning_rate: float, l2: float):
        h, out = self.forward(x)
        error = out - y

        dW2 = error * h
        db2 = error

        dHidden = (error * self.W2[0]) * _tanh_derivative(h)
        dW1 = np.outer(dHidden, x)
        db1 = dHidden

        self.t += 1
        beta1 = 0.9
        beta2 = 0.999
        eps = 1e-8
        decay1 = 1 - math.pow(beta1, self.t)
        decay2 = 1 - math.pow(beta2, self.t)

        self._update_weights(self.W1, self.mW1, self.vW1, dW1, l2, learning_rate, beta1, beta2, decay1, decay2, eps)
        self._update_weights(self.W2, self.mW2, self.vW2, dW2.reshape(1, -1), l2, learning_rate, beta1, beta2, decay1, decay2, eps)
        self._update_bias(self.b1, self.mb1, self.vb1, db1, learning_rate, beta1, beta2, decay1, decay2, eps)
        self._update_bias(self.b2, self.mb2, self.vb2, np.array([db2]), learning_rate, beta1, beta2, decay1, decay2, eps)

        eps_loss = 1e-12
        bce = -(y * math.log(out + eps_loss) + (1 - y) * math.log(1 - out + eps_loss))
        l2_loss = float(np.sum(self.W1 * self.W1)) + float(np.sum(self.W2 * self.W2))
        l2_loss = (l2 / 2) * l2_loss
        return {'loss': bce + l2_loss, 'bce': bce}

    def _update_weights(self, W, mW, vW, dW, l2, lr, beta1, beta2, decay1, decay2, eps):
        grad = dW + l2 * W
        mW[:] = beta1 * mW + (1 - beta1) * grad
        vW[:] = beta2 * vW + (1 - beta2) * (grad * grad)
        m_hat = mW / decay1
        v_hat = vW / decay2
        W[:] -= (lr * m_hat) / (np.sqrt(v_hat) + eps)

    def _update_bias(self, b, mb, vb, db, lr, beta1, beta2, decay1, decay2, eps):
        grad = db
        mb[:] = beta1 * mb + (1 - beta1) * grad
        vb[:] = beta2 * vb + (1 - beta2) * (grad * grad)
        m_hat = mb / decay1
        v_hat = vb / decay2
        b[:] -= (lr * m_hat) / (np.sqrt(v_hat) + eps)

    def to_dict(self) -> dict:
        return {
            'architecture': 'mlp',
            'inputSize': self.input_size,
            'hiddenSize': self.hidden_size,
            'outputSize': self.output_size,
            'W1': self.W1.tolist(),
            'b1': self.b1.tolist(),
            'W2': self.W2.tolist(),
            'b2': self.b2.tolist()
        }

    @classmethod
    def from_dict(cls, data: dict):
        net = cls(data.get('inputSize', 436), data.get('hiddenSize', 24))
        if 'W1' in data:
            net.W1 = np.array(data['W1'], dtype=np.float64)
        if 'b1' in data:
            net.b1 = np.array(data['b1'], dtype=np.float64)
        if 'W2' in data:
            net.W2 = np.array(data['W2'], dtype=np.float64)
        if 'b2' in data:
            net.b2 = np.array(data['b2'], dtype=np.float64)
        return net


def evaluate(net: NeuralNet, dataset: list) -> dict:
    correct = 0
    tp = fp = tn = fn = 0
    for sample in dataset:
        p = net.predict(sample['x'])
        pred = 1 if p >= 0.5 else 0
        if pred == sample['y']:
            correct += 1
        if pred == 1 and sample['y'] == 1:
            tp += 1
        if pred == 1 and sample['y'] == 0:
            fp += 1
        if pred == 0 and sample['y'] == 0:
            tn += 1
        if pred == 0 and sample['y'] == 1:
            fn += 1
    return {
        'accuracy': correct / len(dataset) if dataset else 0,
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn, 'total': len(dataset)
    }


def best_threshold(net: NeuralNet, dataset: list) -> float:
    if not dataset:
        return 0.5
    scored = [{'p': net.predict(s['x']), 'y': s['y']} for s in dataset]
    best_score = -1
    best_t = 0.5
    t = 0.05
    while t <= 0.95:
        tp = fp = tn = fn = 0
        for s in scored:
            pred = 1 if s['p'] >= t else 0
            if pred == 1 and s['y'] == 1:
                tp += 1
            if pred == 1 and s['y'] == 0:
                fp += 1
            if pred == 0 and s['y'] == 0:
                tn += 1
            if pred == 0 and s['y'] == 1:
                fn += 1
        tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
        tnr = tn / (tn + fp) if (tn + fp) > 0 else 0
        balanced = (tpr + tnr) / 2
        if balanced > best_score:
            best_score = balanced
            best_t = t
        t += 0.025
    return best_t


def shuffle_dataset(array: list) -> list:
    arr = list(array)
    for i in range(len(arr) - 1, 0, -1):
        j = random.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def train_model(dataset: list, options: dict = None) -> dict:
    if options is None:
        options = {}
    epochs = int(options.get('epochs', 2000))
    learning_rate = float(options.get('learningRate', 0.005))
    l2 = float(options.get('l2', 1e-4))
    val_fraction = float(options.get('valFraction', 0.15))
    early_stop = bool(options.get('earlyStop', True))
    hidden_size = int(options.get('hiddenSize', 24))

    if not dataset or len(dataset) < 2:
        raise Exception('Not enough data to train. Need at least 2 labeled samples.')

    positives = shuffle_dataset([s for s in dataset if s['y'] == 1])
    negatives = shuffle_dataset([s for s in dataset if s['y'] == 0])

    if not positives or not negatives:
        raise Exception('Need at least one correct and one incorrect sample to train.')

    def take_val(arr):
        return max(1, min(len(arr) - 1, round(len(arr) * val_fraction)))

    val_pos = positives[:take_val(positives)]
    val_neg = negatives[:take_val(negatives)]
    train_pos = positives[take_val(positives):]
    train_neg = negatives[take_val(negatives):]
    train_set = shuffle_dataset(train_pos + train_neg)
    val_set = val_pos + val_neg

    net = NeuralNet(len(dataset[0]['x']), hidden_size)

    best_val_loss = float('inf')
    patience = 0
    best_net_state = None

    batch_size = min(32, max(4, len(train_set) // 4))

    for epoch in range(epochs):
        train_set = shuffle_dataset(train_set)
        loss_sum = 0.0
        bce_sum = 0.0
        count = 0

        for start in range(0, len(train_set), batch_size):
            batch = train_set[start:start + batch_size]
            for sample in batch:
                r = net.train_step(np.array(sample['x'], dtype=np.float64), sample['y'], learning_rate, l2)
                loss_sum += r['loss']
                bce_sum += r['bce']
                count += 1

        epoch_loss = loss_sum / count if count else 0
        epoch_bce = bce_sum / count if count else 0

        val_loss = 0.0
        for sample in val_set:
            p = net.predict(sample['x'])
            eps_loss = 1e-12
            val_loss += -(sample['y'] * math.log(p + eps_loss) + (1 - sample['y']) * math.log(1 - p + eps_loss))
        val_loss /= len(val_set)

        if early_stop and val_loss < best_val_loss - 1e-4:
            best_val_loss = val_loss
            best_net_state = net.to_dict()
            patience = 0
        elif early_stop:
            patience += 1
            if patience >= 40:
                if best_net_state:
                    net = NeuralNet.from_dict(best_net_state)
                break
        else:
            if epoch == epochs - 1:
                best_net_state = net.to_dict()

    if best_net_state:
        net = NeuralNet.from_dict(best_net_state)

    train_eval = evaluate(net, train_set)
    val_eval = evaluate(net, val_set)
    threshold = best_threshold(net, val_set)
    final_eval = evaluate(net, dataset)

    return {
        'net': net,
        'threshold': threshold,
        'train': train_eval,
        'val': val_eval,
        'final': final_eval,
        'sampleCount': len(dataset)
    }


def save_model(net: NeuralNet, metadata: dict):
    WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        'savedAt': __import__('datetime').datetime.now().isoformat(),
        'metadata': metadata or {},
        'net': net.to_dict()
    }
    WEIGHTS_PATH.write_text(json.dumps(payload))


def load_model():
    if not WEIGHTS_PATH.exists():
        return None
    try:
        payload = json.loads(WEIGHTS_PATH.read_text())
        net = NeuralNet.from_dict(payload['net'])
        net.threshold = payload.get('metadata', {}).get('threshold', 0.5)
        net.metadata = payload.get('metadata', {})
        return net
    except Exception:
        return None
