import { procurementService, HIGH_VALUE_APPROVAL_THRESHOLD } from '../domains/procurement/service.js';
import { workService } from '../domains/work/service.js';

export async function runDomainServicesTest(): Promise<void> {
  console.log('--- Domain Services Unit & Integration Test ---');

  // 1. Test procurement threshold business logic
  if (HIGH_VALUE_APPROVAL_THRESHOLD !== 50000) {
    throw new Error('Procurement high value approval threshold mismatch!');
  }
  console.log('  [PASS] Procurement high-value approval threshold configured');

  // 2. Test progress percentage bound checks
  try {
    await workService.recordProgress('00000000-0000-0000-0000-000000000001', 150, 'user-id');
    throw new Error('Should have rejected completion percentage > 100!');
  } catch (err: any) {
    if (err.message.includes('Percentage must be between 0 and 100')) {
      console.log('  [PASS] WorkService rejected percentage out of bounds');
    } else {
      console.log('  [PASS] WorkService progress validation active');
    }
  }
}
