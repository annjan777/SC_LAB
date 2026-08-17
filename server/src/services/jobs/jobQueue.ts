export interface BackgroundJob<T = any> {
  id: string;
  type: string;
  payload: T;
  createdAt: Date;
  attempts: number;
}

export type JobHandler<T = any> = (payload: T) => Promise<void>;

export class JobQueue {
  private handlers: Map<string, JobHandler> = new Map();
  private queue: BackgroundJob[] = [];
  private isProcessing = false;

  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  enqueue<T>(type: string, payload: T): string {
    const jobId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: BackgroundJob<T> = {
      id: jobId,
      type,
      payload,
      createdAt: new Date(),
      attempts: 0,
    };

    this.queue.push(job);

    // Trigger processing asynchronously on next tick without blocking current thread
    setImmediate(() => this.processQueue());

    return jobId;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      const handler = this.handlers.get(job.type);
      if (!handler) {
        console.warn(`[JOB QUEUE WARN] No handler registered for job type: ${job.type}`);
        continue;
      }

      try {
        job.attempts++;
        await handler(job.payload);
        console.log(`[JOB QUEUE SUCCESS] Processed job ${job.id} (${job.type})`);
      } catch (err: any) {
        console.error(`[JOB QUEUE ERROR] Job ${job.id} (${job.type}) failed on attempt ${job.attempts}:`, err.message);
        if (job.attempts < 3) {
          // Re-queue for retry
          this.queue.push(job);
        }
      }
    }

    this.isProcessing = false;
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}

export const globalJobQueue = new JobQueue();
