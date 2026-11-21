*Inheritance: EventDispatcher → Node → InputNode → UniformNode → BufferNode → StorageBufferNode →*

# StorageStructNode

A storage buffer bound as a single struct instead of an array of elements. This allows the struct's last member to be a runtime-sized array, whose length follows the size of the bound buffer. A typical use is a queue with an atomic length ahead of its elements.

The node is only supported with the WebGPU backend.

## Code Example

```js
const Queue = struct( {
	length: { type: 'uint', atomic: true },
	elements: 'array<u32>'
}, 'Queue' );
const queue = storageStruct( new THREE.StorageBufferAttribute( new Uint32Array( count + 1 ), 1 ), Queue );
```

## Constructor

### new StorageStructNode( value : StorageBufferAttribute, structType : Struct )

Constructs a new storage struct node.

**value**

The buffer data.

**structType**

The struct type of the buffer.

## Properties

### .isStorageStructNode : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

## Source

[src/nodes/accessors/StorageStructNode.js](https://github.com/mrdoob/three.js/blob/master/src/nodes/accessors/StorageStructNode.js)