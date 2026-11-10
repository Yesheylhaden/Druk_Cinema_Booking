import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,normalizeEmail,validPassword,sessionToken,digest} from '../services/auth/src/security.js';
import {safeDestination} from '../frontend/src/frontendAuth.js';
test('passwords have salted hashes and reject incorrect passwords',async()=>{
 const first=await hashPassword('Correct horse 123'),second=await hashPassword('Correct horse 123');
 assert.notEqual(first,second);assert.ok(!first.includes('Correct horse'));
 assert.equal(await verifyPassword('Correct horse 123',first),true);
 assert.equal(await verifyPassword('Wrong password',first),false);
 assert.equal(await verifyPassword('anything','corrupt'),false);
});
test('validates password limits and normalizes email',()=>{assert.equal(normalizeEmail(' PEMA@Example.com '),'pema@example.com');for(const p of [null,'short','x'.repeat(129)])assert.equal(validPassword(p),false);assert.equal(validPassword('a'.repeat(8)),true);});
test('accepts only opaque session cookies',()=>{const token='a'.repeat(64);assert.equal(sessionToken('other=value; druk_session='+token),token);assert.equal(sessionToken('druk_session=forged'),null);assert.equal(sessionToken(),null);assert.notEqual(digest(token),token);});
test('return destinations cannot redirect away from the app',()=>{for(const value of ['https://evil.example','//evil.example','javascript:alert(1)','/login?next=//evil.example','/movie/0','/movie/1/evil',null])assert.equal(safeDestination(value),'/');for(const value of ['/','/movies','/my-list','/movie/12'])assert.equal(safeDestination(value),value);});
