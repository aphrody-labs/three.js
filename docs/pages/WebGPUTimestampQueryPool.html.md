*Inheritance: TimestampQueryPool →*

# WebGPUTimestampQueryPool

Manages a pool of WebGPU timestamp queries for GPU timers. Each pass writes a begin and an end timestamp, a timer measures from the earliest begin to the latest end of its passes.

Only one readback is in flight. When the query set is full meanwhile, it waits for its own readback and the following passes continue in another query set, so no query is dropped.

## Constructor

### new WebGPUTimestampQueryPool( device : GPUDevice, maxQueries : number )

Creates a new WebGPU timestamp query pool.

**device**

The WebGPU device to create queries on.

**maxQueries**

Maximum number of queries of a query set.

Default is `4096`.

## Properties

### .currentQueryIndex : number

How many queries of the current query set are allocated.

Default is `0`.

### .freeQuerySets : Array.<GPUQuerySet>

The query sets that were read back and can be reused.

### .fullQuerySets : Array.<{querySet: GPUQuerySet, queryTimers: Map.<number, Array.<Object>>, queryCount: number}>

The full query sets waiting for their readback.

### .pendingResolve : Promise

The readback in flight, `null` if there is none.

Default is `null`.

### .querySet : GPUQuerySet

The query set the passes write to.

### .queryTimers : Map.<number, Array.<Object>>

The timers of each allocated query pair of the current query set, by the index of its first query.

## Methods

### .allocateQueries() : number

Allocates a pair of queries for the active timers.

**Returns:** The index of the first query in [WebGPUTimestampQueryPool#querySet](WebGPUTimestampQueryPool.html#querySet), or `null` without active timers.

### .dispose() : Promise (async)

Dispose of the query pool.

**Overrides:** [TimestampQueryPool#dispose](TimestampQueryPool.html#dispose)

**Returns:** A Promise that resolves when the dispose has been executed.

### .getDuration( timer : Object ) : number

Returns the GPU time of the given timer, from the earliest begin to the latest end of its passes.

**timer**

The timer, ended and resolved.

**Overrides:** [TimestampQueryPool#getDuration](TimestampQueryPool.html#getDuration)

**Returns:** The GPU time in milliseconds, or `null` if queries couldn't be read back.

### .resolveQueries()

Reads back the oldest full query set, or the current one. Only one readback is in flight, queries allocated meanwhile are read back with the next ones.

**Overrides:** [TimestampQueryPool#resolveQueries](TimestampQueryPool.html#resolveQueries)

## Source

[src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js](https://github.com/mrdoob/three.js/blob/master/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js)