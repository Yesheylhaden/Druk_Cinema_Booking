import test from 'node:test';
import assert from 'node:assert/strict';
import {demoPaymentsEnabled} from '../services/bookings/src/payment-mode.js';
test('demo payments require explicit enablement and are disabled in production',()=>{
 assert.equal(demoPaymentsEnabled({}),false);
 assert.equal(demoPaymentsEnabled({DEMO_PAYMENTS:'false'}),false);
 assert.equal(demoPaymentsEnabled({DEMO_PAYMENTS:'true',NODE_ENV:'development'}),true);
 assert.equal(demoPaymentsEnabled({DEMO_PAYMENTS:'true',NODE_ENV:'production'}),false);
});