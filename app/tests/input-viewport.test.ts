import test from 'node:test';
import assert from 'node:assert/strict';
import { inputRevealDelta, inputViewportFrame } from '../lib/input-viewport';

test('keyboard viewport follows height and browser pan without treating pinch zoom as a keyboard', () => {
  assert.deepEqual(inputViewportFrame({height:420,offsetTop:120,scale:1},true),{height:420,top:120,compact:true});
  assert.deepEqual(inputViewportFrame({height:844,offsetTop:-2,scale:1},true),{height:844,top:0,compact:false});
  assert.equal(inputViewportFrame({height:420,offsetTop:0,scale:2},true),null);
  assert.equal(inputViewportFrame({height:420,offsetTop:0,scale:1},false)?.compact,false);
  assert.equal(inputViewportFrame({height:0,offsetTop:0,scale:1},true),null);
  assert.equal(inputViewportFrame({height:420,offsetTop:NaN,scale:1},true),null);
});

test('a hidden form field is revealed by the smallest scroll and visible fields stay put', () => {
  assert.equal(inputRevealDelta(428,552,174,385),167);
  assert.equal(inputRevealDelta(200,244,174,385),0);
  assert.equal(inputRevealDelta(140,184,174,385),-34);
  assert.equal(inputRevealDelta(300,800,174,385),126);
  assert.equal(inputRevealDelta(300,800,400,380),0);
});
