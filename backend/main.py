"""FastAPI backend exposing a real PyTorch training loop for the playground.

Run locally: `uvicorn backend.main:app --reload --port 8000`
The Next.js dev server proxies /api/train -> http://localhost:8000/train.
"""

from __future__ import annotations

from typing import Literal

import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


Activation = Literal["ReLU", "Tanh", "Sigmoid", "Linear"]
Dataset = Literal["randn", "circle", "xor", "gaussian", "spiral"]
LossFn = Literal["MSE"]
Optimizer = Literal["SGD"]


class TrainRequest(BaseModel):
    dataset: Dataset
    input_count: int = Field(ge=1, le=8)
    hidden_count: int = Field(ge=1, le=8)
    output_count: int = Field(ge=1, le=8)
    learning_rate: float = Field(gt=0)
    activation: Activation
    loss_fn: LossFn = "MSE"
    optimizer: Optimizer = "SGD"
    batch_size: int = Field(ge=1, le=64)
    epochs: int = Field(ge=1, le=1000, default=100)
    sample_size: int = Field(ge=16, le=4096, default=512)
    seed: int = 0


class TrainResponse(BaseModel):
    loss_curve: list[float]
    final_loss: float


ACTIVATIONS: dict[Activation, type[nn.Module]] = {
    "ReLU": nn.ReLU,
    "Tanh": nn.Tanh,
    "Sigmoid": nn.Sigmoid,
    "Linear": nn.Identity,
}


def sample_dataset(name: Dataset, n: int, d: int, seed: int) -> tuple[torch.Tensor, torch.Tensor]:
    g = torch.Generator().manual_seed(seed)
    if name == "randn":
        x = torch.randn(n, d, generator=g)
        y = (x.sum(dim=1, keepdim=True) > 0).float()
        return x, y
    if name == "circle":
        x = torch.randn(n, d, generator=g)
        y = ((x**2).sum(dim=1, keepdim=True) < d).float()
        return x, y
    if name == "xor":
        x = torch.randn(n, d, generator=g).sign()
        y = (x.prod(dim=1, keepdim=True) > 0).float()
        return x, y
    if name == "gaussian":
        half = n // 2
        a = torch.randn(half, d, generator=g) + 1.5
        b = torch.randn(n - half, d, generator=g) - 1.5
        x = torch.cat([a, b], dim=0)
        y = torch.cat([torch.ones(half, 1), torch.zeros(n - half, 1)], dim=0)
        perm = torch.randperm(n, generator=g)
        return x[perm], y[perm]
    # spiral (use first two dims; pad rest with randn)
    half = n // 2
    t = torch.linspace(0, 4 * np.pi, half)
    r = t / (4 * np.pi)
    x1 = torch.stack([r * torch.cos(t), r * torch.sin(t)], dim=1)
    x2 = torch.stack([-r * torch.cos(t), -r * torch.sin(t)], dim=1)
    base = torch.cat([x1, x2], dim=0)
    if d > 2:
        pad = torch.randn(base.shape[0], d - 2, generator=g) * 0.1
        base = torch.cat([base, pad], dim=1)
    else:
        base = base[:, :d]
    y = torch.cat([torch.ones(half, 1), torch.zeros(base.shape[0] - half, 1)], dim=0)
    perm = torch.randperm(base.shape[0], generator=g)
    return base[perm], y[perm]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/train", response_model=TrainResponse)
def train(req: TrainRequest) -> TrainResponse:
    torch.manual_seed(req.seed)

    x, y = sample_dataset(req.dataset, n=req.sample_size, d=req.input_count, seed=req.seed)

    act = ACTIVATIONS[req.activation]
    model = nn.Sequential(
        nn.Linear(req.input_count, req.hidden_count),
        act(),
        nn.Linear(req.hidden_count, req.output_count),
        act(),
        nn.Linear(req.output_count, 1),
    )

    loss_fn: nn.Module
    if req.loss_fn == "MSE":
        loss_fn = nn.MSELoss()
    else:
        loss_fn = nn.MSELoss()
    opt: torch.optim.Optimizer
    if req.optimizer == "SGD":
        opt = torch.optim.SGD(model.parameters(), lr=req.learning_rate)
    else:
        opt = torch.optim.SGD(model.parameters(), lr=req.learning_rate)

    losses: list[float] = []
    n = x.shape[0]
    for _ in range(req.epochs):
        perm = torch.randperm(n)
        epoch_loss = 0.0
        batches = 0
        for start in range(0, n, req.batch_size):
            idx = perm[start : start + req.batch_size]
            logits = model(x[idx])
            loss = loss_fn(logits, y[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
            epoch_loss += float(loss.item())
            batches += 1
        losses.append(epoch_loss / max(batches, 1))

    return TrainResponse(loss_curve=losses, final_loss=losses[-1])
