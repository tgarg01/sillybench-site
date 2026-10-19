// The Sillybench studies the posts cite. Numbers are copied from the Sillybench README and run folders;
// each run links to its folder on GitHub (config.json, env/, bench/, nsys/, analysis/, MANIFEST.sha256).

export type Run = {
  id: string;
  date: string;
  kind: string;
  summary: string;
  setup: [string, string][];
  highlights: string[];
};

export const RUNS: Run[] = [
  {
    id: '2026-10-09_qwen3.8-27b_bf16_initial',
    date: '2026-10-09',
    kind: 'Original study',
    summary:
      'The first end-to-end study: benchmark sweep, Nsight Systems traces at batch 1 and 32 (CUDA graphs and eager), and the analysis notebook that every post draws from.',
    setup: [
      ['GPU', '1x NVIDIA H100 80GB HBM3 (SXM), GCP a3-highgpu-1g, Spot'],
      ['Model', 'Qwen/Qwen3.8-27B, BF16 (48 Gated DeltaNet + 16 full-attention layers)'],
      ['Engine', 'vLLM 0.31.0, default settings, max_num_seqs 256, prefix caching off'],
      ['Workload', '512-token prompt; batch 1–256; output 1 and 128 tokens'],
      ['Stack', 'PyTorch 2.13.0+cu130 · driver 580.178.04 · CUDA 12.9 · FlashInfer 0.7.0.post1'],
      ['Profilers', 'Nsight Systems 2025.1.3 · Nsight Compute 2025.2.0'],
    ],
    highlights: [
      'Batch-1 decode: 20.55 ms per token (vllm bench latency), 1.34x the 15.4 ms bandwidth floor',
      'GEMMs are 94% of decode GPU time; large GEMMs stream weights at 82–86% of peak bandwidth',
      'CUDA graphs vs eager at batch 1: 20.7 vs 60.5 ms per step, same GEMM times',
      'Prefill, 512 tokens: 45 ms of GPU time (~59% of BF16 peak on GEMM FLOPs)',
    ],
  },
  {
    id: '2026-10-13_qwen3.8-27b_bf16_repro',
    date: '2026-10-13',
    kind: 'Full reproduction',
    summary:
      'The whole pipeline re-run from a brand-new Spot VM (fresh image, fresh install, fresh model download) with the same pinned versions, plus a second session of Nsight Compute deep dives.',
    setup: [
      ['GPU', '1x NVIDIA H100 80GB HBM3 (SXM), GCP a3-highgpu-1g, Spot, new VM'],
      ['Same as', 'the original study: model, engine, versions and workload'],
      ['Added', '18 targeted ncu deep dives + metric sweeps of every kernel at B=1 and B=32'],
      ['Integrity', '140/140 files verified against MANIFEST.sha256 after transfer'],
    ],
    highlights: [
      'Decode latency within 0.6% of the original at every batch size (1 to 256)',
      'Peaks derived from the GPU itself: 3.35 TB/s HBM3, 989 BF16 TFLOP/s, 132 SMs',
      'Big decode GEMMs read weights at 2.6–2.8 TB/s, whether batch is 1 or 32',
      'RMSNorm and gdn.in_proj_ba run on 1 and 6 CTAs: ~0.5 ms per step on a few SMs',
    ],
  },
];

export const REPRO_TABLE: { batch: number; original: number; repro: number; diff: string; tps: string }[] = [
  { batch: 1, original: 20.55, repro: 20.54, diff: '-0.1%', tps: '49' },
  { batch: 8, original: 21.94, repro: 21.97, diff: '+0.1%', tps: '364' },
  { batch: 32, original: 25.19, repro: 25.1, diff: '-0.4%', tps: '1,275' },
  { batch: 64, original: 29.67, repro: 29.7, diff: '+0.1%', tps: '2,155' },
  { batch: 128, original: 59.46, repro: 59.12, diff: '-0.6%', tps: '2,165' },
  { batch: 256, original: 97.82, repro: 97.9, diff: '+0.1%', tps: '2,615' },
];
