// Terms used across the series. `episode` = the series-1 episode that introduces it (links to that post when published).
// Numbers are the series' own measurements (Qwen3.8-27B BF16, vLLM 0.31, 1x H100 SXM).

export type Term = { term: string; id: string; def: string; episode?: number };

export const GLOSSARY: Term[] = [
  { term: 'Token', id: 'token', episode: 1, def: 'The unit an LLM reads and writes: a word or a piece of one. The tokenizer (on the CPU) turns text into token IDs; the series uses 512-token prompts.' },
  { term: 'Kernel', id: 'kernel', episode: 1, def: 'One function launched on the GPU, such as a matrix multiply or a normalization. One decode step of Qwen3.8-27B is 902 kernels run one after another.' },
  { term: 'SM (Streaming Multiprocessor)', id: 'sm', episode: 1, def: 'The GPU’s independent processing unit. An H100 SXM has 132; a kernel spreads its work across them in blocks (CTAs).' },
  { term: 'Tensor Core', id: 'tensor-core', episode: 1, def: 'Matrix-multiply units inside each SM (528 on an H100 SXM). They provide the 989 TFLOP/s of dense BF16 compute.' },
  { term: 'GEMM', id: 'gemm', episode: 1, def: 'General matrix multiply. The projections and MLPs of every layer are GEMMs; at batch 1 they take about 93% of decode GPU time.' },
  { term: 'HBM', id: 'hbm', episode: 2, def: 'High Bandwidth Memory, the GPU’s main memory. The H100 SXM has 80 GB of HBM3 at 3.35 TB/s; the model’s weights live here.' },
  { term: 'KV cache', id: 'kv-cache', episode: 1, def: 'The keys and values of every previous token, saved in GPU memory so decode only processes the newest token instead of re-reading the whole prompt.' },
  { term: 'Prefill', id: 'prefill', episode: 2, def: 'The prompt phase: all prompt tokens go through the model together in one pass. 512 tokens took 54.3 ms end to end, about 46% of the H100’s compute peak: compute-bound.' },
  { term: 'Decode', id: 'decode', episode: 2, def: 'Generating one token at a time, each needing a full pass over the weights. 20.55 ms per token at batch 1, 74% of peak memory bandwidth: memory-bound.' },
  { term: 'Arithmetic intensity', id: 'arithmetic-intensity', episode: 2, def: 'FLOPs done per byte read from memory. Decode at batch 1 does ~1 FLOP per byte; prefill of 512 tokens ~490.' },
  { term: 'Roofline / balance point', id: 'roofline', episode: 2, def: 'A plot of achievable FLOP/s against arithmetic intensity. Below the balance point (989 TFLOP/s ÷ 3.35 TB/s ≈ 295 FLOP/byte) memory is the limit; above it, compute is.' },
  { term: 'Bandwidth floor', id: 'bandwidth-floor', episode: 2, def: 'The fastest a memory-bound step can possibly be: bytes it must read ÷ peak bandwidth. 51.2 GB ÷ 3.35 TB/s ≈ 15.3 ms per decode token.' },
  { term: 'Batching', id: 'batching', def: 'Decoding many sequences in the same step, so the weights read from memory are shared by all of them. Batch 32 measured 25.1 ms per step vs 20.5 ms at batch 1.' },
  { term: 'CUDA graphs vs eager', id: 'cuda-graphs', def: 'Eager mode launches every kernel from Python; a CUDA graph records a whole decode step once and replays it with one launch. At batch 1: 20.7 ms (graphs) vs 60.5 ms (eager) per step with identical GEMM times.' },
  { term: 'FULL vs PIECEWISE graphs', id: 'piecewise-graphs', def: 'vLLM runs pure decode as one full graph; prefill runs as graph pieces with attention and Gated DeltaNet ops launched eagerly in between, leaving small launch gaps.' },
  { term: 'Async scheduling', id: 'async-scheduling', def: 'The CPU prepares and launches step N+1 while the GPU is still running step N, so host time hides behind GPU time (97.4% GPU busy during decode).' },
  { term: 'Split-K', id: 'split-k', def: 'Splitting a GEMM’s reduction dimension across SMs, then adding the partial results in a small reduce kernel. Used to keep all 132 SMs busy on skinny decode GEMMs.' },
  { term: 'CTA / grid size', id: 'cta', def: 'A CTA (thread block) runs on one SM; the grid is how many CTAs a kernel launches. A kernel with a grid of 1 can use at most 1 of 132 SMs.' },
  { term: 'Kernel fusion', id: 'fusion', def: 'Combining several small kernels into one so data stays on-chip and launch overhead disappears. torch.compile does this inside vLLM’s CUDA graphs.' },
  { term: 'Hybrid model (Gated DeltaNet)', id: 'hybrid', def: 'Qwen3.8-27B mixes 48 linear-attention (Gated DeltaNet) layers, which keep a fixed-size recurrent state, with 16 full-attention layers, which keep a growing KV cache.' },
  { term: 'Nsight Systems / Nsight Compute', id: 'nsight', def: 'NVIDIA’s profilers. Nsight Systems shows the timeline (what ran when, CPU and GPU); Nsight Compute dissects one kernel (bytes moved, SM usage, grid size).' },
  { term: 'BF16', id: 'bf16', def: 'A 16-bit floating-point format: 2 bytes per weight. 25.6B GEMM parameters × 2 bytes = 51.2 GB read per decode step.' },
];
