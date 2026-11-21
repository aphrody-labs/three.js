# TimestampQueryPool

Abstract base class of a timestamp query pool. While GPU timers are active, the backend allocates queries for its render and compute calls. Each query keeps the timers that were active when it was allocated and adds its timestamps to them once it is read back.

## Constructor

### new TimestampQueryPool( maxQueries : number ) (abstract)

Creates a new timestamp query pool.

**maxQueries**

Maximum number of queries this pool can hold.

Default is `256`.

## Properties

### .isDisposed : boolean

Whether the pool has been disposed or not.

Default is `false`.

### .maxQueries : number

Maximum number of queries this pool can hold.

Default is `256`.

### .timers : Set.<Object>

The active GPU timers.

## Methods

### ._releaseTimers( timers : Array.<Object>, lost : boolean ) (protected)

Releases the timers of a query once it is read back, and resolves the ended timers without pending queries.

**timers**

The timers returned by [TimestampQueryPool#\_retainTimers](TimestampQueryPool.html#_retainTimers).

**lost**

Whether the query couldn't be read back.

### ._retainTimers() : Array.<Object> (protected)

Returns the active timers for a new query, `null` without active timers.

**Returns:** The timers.

### .beginTimer() : Object

Starts a GPU timer. It measures the queries allocated until [TimestampQueryPool#endTimer](TimestampQueryPool.html#endTimer).

**Returns:** The timer.

### .dispose() (abstract)

Dispose of the query pool.

### .endTimer( timer : Object ) : Promise.<Object>

Ends the given GPU timer.

**timer**

The timer returned by [TimestampQueryPool#beginTimer](TimestampQueryPool.html#beginTimer).

**Returns:** A Promise that resolves with the timer once all its queries are read back.

### .getDuration( timer : Object ) : number (abstract)

Returns the GPU time of the given timer in milliseconds.

**timer**

The timer, ended and resolved.

**Returns:** The GPU time, or `null` if queries couldn't be read back.

### .resolveQueries() (abstract)

Reads back the queries that are ready.

## Source

[src/renderers/common/TimestampQueryPool.js](https://github.com/mrdoob/three.js/blob/master/src/renderers/common/TimestampQueryPool.js)