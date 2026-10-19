// The series roadmap shown on /series/llm-inference-gpu.
// Published parts come from src/content/posts (matched by `part`); this file only describes the plan.
// Order and titles are a working draft from series-plan.md: edit freely, nothing else depends on them.

export type Arc = { id: string; name: string; blurb: string };
export type PlannedPart = { part: number; arc: string; title: string; concept: string };

export const SERIES = {
  id: 'llm-inference-gpu',
  title: 'LLM inference through the lens of a GPU',
  short: 'LLM inference on a GPU',
  blurb:
    'One model (Qwen3.8-27B, BF16), one engine (vLLM 0.31), one H100. Each part explains one idea with a number I measured, the source file it came from, and a notebook that reproduces it.',
};

export const ARCS: Arc[] = [
  { id: 'token', name: 'One token, end to end', blurb: 'No background needed.' },
  { id: 'system', name: 'The system around the GPU', blurb: 'CPU, scheduling, batching.' },
  { id: 'kernels', name: 'Inside the kernels', blurb: 'Nsight Compute, kernel by kernel.' },
  { id: 'method', name: 'Behind the scenes', blurb: 'How the measurements were made.' },
];

export const PLAN: PlannedPart[] = [
  { part: 1, arc: 'token', title: 'A model is a loop of kernels', concept: 'Layers → kernels; the CPU dispatches, the GPU runs them on 132 SMs.' },
  { part: 2, arc: 'token', title: 'Prefill vs decode', concept: 'Compute-bound vs memory-bound; arithmetic intensity and the roofline.' },
  { part: 3, arc: 'system', title: '32 users for barely more than the price of one', concept: 'Batching: the weights are read once and shared by every sequence.' },
  { part: 4, arc: 'system', title: 'Batch 128: where the free lunch ends', concept: 'Effective bandwidth falls from ~75% to ~49% of peak. An open question.' },
  { part: 5, arc: 'token', title: 'Predicting decode time from config.json alone', concept: 'Napkin math: bytes read per token ÷ memory bandwidth.' },
  { part: 6, arc: 'token', title: 'Where the other 5 ms go', concept: 'The decode-step waterfall: explaining every millisecond.' },
  { part: 7, arc: 'system', title: 'Same kernels, 3x slower', concept: 'CUDA graphs vs eager: when the CPU dispatcher becomes the bottleneck.' },
  { part: 8, arc: 'system', title: 'The GPU idles 0.5 ms per step', concept: 'Async scheduling: the CPU prepares step N+1 while the GPU runs step N.' },
  { part: 9, arc: 'kernels', title: 'Anatomy of a decode GEMM', concept: 'Skinny matrices, split-K, and reading a cuBLAS kernel name.' },
  { part: 10, arc: 'kernels', title: 'Two kernels that use 1 of 132 SMs', concept: 'Grid size, occupancy and why fusion matters.' },
  { part: 11, arc: 'kernels', title: "This model isn't all attention", concept: 'Hybrid models: 48 Gated DeltaNet layers + 16 full-attention layers.' },
  { part: 12, arc: 'kernels', title: 'The hybrid tax at batch 32', concept: 'A recurrent-state kernel that reads ~100 MB per call.' },
  { part: 13, arc: 'kernels', title: 'A 223K-token KV cache, yet a cap of 358 users', concept: 'What really limits concurrency.' },
  { part: 14, arc: 'method', title: 'Profiling an H100 for $31', concept: 'Predict → measure → explain → deep-dive, on a Spot VM.' },
  { part: 15, arc: 'method', title: 'Re-ran everything on a fresh machine: within 0.6%', concept: 'Pinned versions, environment capture, sha256 manifests.' },
  { part: 16, arc: 'method', title: 'The whole series in one picture', concept: 'Recap cheat-sheet, and season 2: FP8.' },
];

export const TOTAL_PARTS = PLAN.length;
