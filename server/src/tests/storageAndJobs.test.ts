import { LocalStorageAdapter, S3StorageAdapter, getStorageAdapter } from '../services/storage/storageAdapter.js';
import { globalJobQueue } from '../services/jobs/jobQueue.js';

export async function runStorageAndJobsTest(): Promise<void> {
  console.log('--- Storage & Background Jobs Unit Test ---');

  // 1. Test Local Storage Adapter
  const localAdapter = new LocalStorageAdapter();
  const fileData = await localAdapter.uploadFile({
    filename: 'test_doc.txt',
    buffer: Buffer.from('SC Lab Portal Test Content'),
    mimeType: 'text/plain',
  });

  if (!fileData.url.startsWith('/uploads/')) {
    throw new Error('Local storage adapter generated invalid URL format!');
  }
  console.log('  [PASS] LocalStorageAdapter upload and file URL generation');

  await localAdapter.deleteFile(fileData.filepath);
  console.log('  [PASS] LocalStorageAdapter file deletion');

  // 2. Test S3 Storage Adapter
  const s3Adapter = new S3StorageAdapter();
  const s3FileData = await s3Adapter.uploadFile({
    filename: 's3_doc.txt',
    buffer: Buffer.from('S3 Content'),
    mimeType: 'text/plain',
  });

  if (!s3FileData.url.includes('.s3.')) {
    throw new Error('S3StorageAdapter generated invalid S3 URL!');
  }
  console.log('  [PASS] S3StorageAdapter upload URL generation');

  // 3. Test Non-blocking Job Queue
  let jobExecuted = false;
  globalJobQueue.registerHandler('TEST_EMAIL', async (payload: { to: string }) => {
    if (payload.to === 'test@example.com') {
      jobExecuted = true;
    }
  });

  const startTime = Date.now();
  const jobId = globalJobQueue.enqueue('TEST_EMAIL', { to: 'test@example.com' });
  const enqueueTime = Date.now() - startTime;

  if (enqueueTime > 50) {
    throw new Error(`Job enqueueing blocked request handler! Took ${enqueueTime}ms`);
  }
  if (!jobId) {
    throw new Error('JobQueue failed to return a valid job ID!');
  }
  console.log('  [PASS] Non-blocking JobQueue enqueue time (< 50ms)');

  // Wait briefly for asynchronous setImmediate queue processing
  await new Promise(resolve => setTimeout(resolve, 50));
  if (!jobExecuted) {
    throw new Error('Asynchronous background job was not executed by JobQueue!');
  }
  console.log('  [PASS] Asynchronous background job processing');
}
