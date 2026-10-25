import test from 'node:test';
import assert from 'node:assert/strict';
import {validBooking} from '../services/bookings/src/validation.js';
const valid={name:'Pema Dorji',email:'pema@example.com',movieId:1,showtimeId:1,seats:['A1','F10']};
test('accepts a valid reservation',()=>assert.equal(validBooking(valid),true));
test('rejects malformed and duplicate seat selections',()=>{for(const seats of [[],['A1','A1'],['G1'],['A0'],['A11'],[null],Array.from({length:9},(_,i)=>'A'+(i+1))])assert.equal(validBooking({...valid,seats}),false);});
test('rejects invalid customer and showtime details',()=>{for(const patch of [{name:' '},{email:'invalid'},{showtimeId:'1'},{showtimeId:-1},{movieId:null}])assert.equal(validBooking({...valid,...patch}),false);});
