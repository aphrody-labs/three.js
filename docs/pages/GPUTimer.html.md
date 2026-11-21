# GPUTimer

Measures the GPU time of the render and compute passes issued between [GPUTimer#begin](GPUTimer.html#begin) and [GPUTimer#end](GPUTimer.html#end), from the start of the first pass to the end of the last one.

Requires the `timestamp-query` feature in WebGPU. Otherwise the results are `null`.

## Code Example

```js
const timer = new GPUTimer( renderer );
timer.begin();
renderer.render( scene, camera );
const { delta } = await timer.end();
```

## Constructor

### new GPUTimer( renderer : Renderer )

Constructs a new GPU timer.

**renderer**

The renderer whose passes are timed. Must be initialized before [GPUTimer#begin](GPUTimer.html#begin) is called.

## Properties

### .renderer : Renderer

The renderer whose passes are timed.

## Methods

### .begin()

Starts timing the passes the renderer issues.

### .end() : Promise.<?{start: ?number, end: ?number, delta: number}> (async)

Stops timing and returns the GPU timing of the passes issued since [GPUTimer#begin](GPUTimer.html#begin). The timer can begin a new measurement before the result is read.

*   `start`: The GPU timestamp of the start of the first pass.
*   `end`: The GPU timestamp of the end of the last pass.
*   `delta`: The time between them, `0` without any pass.

The timestamps can only be compared with each other, and are `null` without any pass. The result is `null` when the backend doesn't support timing.

**Returns:** The GPU timing in milliseconds.

## Source

[src/renderers/common/GPUTimer.js](https://github.com/mrdoob/three.js/blob/master/src/renderers/common/GPUTimer.js)