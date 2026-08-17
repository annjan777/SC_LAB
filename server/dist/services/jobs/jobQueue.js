export class JobQueue {
    handlers = new Map();
    queue = [];
    isProcessing = false;
    registerHandler(type, handler) {
        this.handlers.set(type, handler);
    }
    enqueue(type, payload) {
        const jobId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job = {
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
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0)
            return;
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job)
                break;
            const handler = this.handlers.get(job.type);
            if (!handler) {
                console.warn(`[JOB QUEUE WARN] No handler registered for job type: ${job.type}`);
                continue;
            }
            try {
                job.attempts++;
                await handler(job.payload);
                console.log(`[JOB QUEUE SUCCESS] Processed job ${job.id} (${job.type})`);
            }
            catch (err) {
                console.error(`[JOB QUEUE ERROR] Job ${job.id} (${job.type}) failed on attempt ${job.attempts}:`, err.message);
                if (job.attempts < 3) {
                    // Re-queue for retry
                    this.queue.push(job);
                }
            }
        }
        this.isProcessing = false;
    }
    getPendingCount() {
        return this.queue.length;
    }
}
export const globalJobQueue = new JobQueue();
