# Info

This renderer module provides a series of statistical information about the GPU memory and the rendering process. Useful for debugging and monitoring.

## Constructor

### new Info()

Constructs a new info component.

## Properties

### .autoReset : boolean

Whether frame related metrics should automatically be reset at the start of each animation frame or not. The renderer runs its internal animation loop once `render()` or `compute()` has been called, even when the app manages its own animation loop. When set to `false`, the app must call `renderer.info.reset()` manually.

Default is `true`.

### .calls : number (readonly)

The number of render and compute calls since the app has been started.

Default is `0`.

### .compute : Object (readonly)

Compute related metrics.

**calls**  
number

The number of compute calls since the app has been started.

**frameCalls**  
number

The number of compute calls of the current frame.

### .frame : number (readonly)

The current frame ID. This ID is managed by `NodeFrame`.

Default is `0`.

### .memory : Object (readonly)

Memory related metrics.

**attributes**  
number

The number of active attributes.

**attributesSize**  
number

The memory size of active attributes in bytes.

**geometries**  
number

The number of active geometries.

**indexAttributes**  
number

The number of active index attributes.

**indexAttributesSize**  
number

The memory size of active index attributes in bytes.

**indirectStorageAttributes**  
number

The number of active indirect storage attributes.

**indirectStorageAttributesSize**  
number

The memory size of active indirect storage attributes in bytes.

**programs**  
number

The number of active programs.

**programsSize**  
number

The memory size of active programs in bytes.

**readbackBuffers**  
number

The number of active readback buffers.

**readbackBuffersSize**  
number

The memory size of active readback buffers in bytes.

**renderTargets**  
number

The number of active renderTargets.

**storageAttributes**  
number

The number of active storage attributes.

**storageAttributesSize**  
number

The memory size of active storage attributes in bytes.

**textures**  
number

The number of active textures.

**texturesSize**  
number

The memory size of active textures in bytes.

**uniformBuffers**  
number

The number of active uniform buffers.

**uniformBuffersSize**  
number

The memory size of active uniform buffers in bytes.

**total**  
number

The total memory size in bytes.

### .render : Object (readonly)

Render related metrics.

**calls**  
number

The number of render calls since the app has been started.

**frameCalls**  
number

The number of render calls of the current frame.

**drawCalls**  
number

The number of draw calls of the current frame.

**triangles**  
number

The number of rendered triangle primitives of the current frame.

**points**  
number

The number of rendered point primitives of the current frame.

**lines**  
number

The number of rendered line primitives of the current frame.

## Methods

### .createAttribute( attribute : BufferAttribute )

Tracks a regular attribute memory explicitly.

**attribute**

The attribute to track.

### .createIndexAttribute( attribute : BufferAttribute )

Tracks an index attribute memory explicitly.

**attribute**

The index attribute to track.

### .createIndirectStorageAttribute( attribute : BufferAttribute )

Tracks an indirect storage attribute memory explicitly.

**attribute**

The indirect storage attribute to track.

### .createProgram( program : ProgrammableStage )

Tracks program memory explicitly, updating counts and byte tracking.

**program**

The program to track.

### .createReadbackBuffer( readbackBuffer : ReadbackBuffer )

Tracks a readback buffer memory explicitly.

**readbackBuffer**

The readback buffer to track.

### .createStorageAttribute( attribute : BufferAttribute )

Tracks a storage attribute memory explicitly.

**attribute**

The storage attribute to track.

### .createTexture( texture : Texture, options : Object )

Tracks texture memory explicitly, updating counts and byte tracking.

**texture**

**options**

The texture's size and level information.

### .createUniformBuffer( uniformBuffer : UniformBuffer )

Tracks a uniform buffer memory explicitly.

**uniformBuffer**

The uniform buffer to track.

### .destroyAttribute( attribute : BufferAttribute )

Tracks attribute memory explicitly, updating counts and byte tracking.

**attribute**

### .destroyProgram( program : Object )

Tracks program memory explicitly, updating counts and byte tracking.

**program**

The program to track.

### .destroyReadbackBuffer( readbackBuffer : ReadbackBuffer )

Tracks a readback buffer memory explicitly.

**readbackBuffer**

The readback buffer to track.

### .destroyTexture( texture : Texture )

Tracks texture memory explicitly, updating counts and byte tracking.

**texture**

### .destroyUniformBuffer( uniformBuffer : UniformBuffer )

Tracks a uniform buffer memory explicitly.

**uniformBuffer**

The uniform buffer to track.

### .dispose()

Performs a complete reset of the object.

### .reset()

Resets frame related metrics.

### .update( object : Object3D, count : number, instanceCount : number )

This method should be executed per draw call and updates the corresponding metrics.

**object**

The 3D object that is going to be rendered.

**count**

The vertex or index count.

**instanceCount**

The instance count.

### .updateTexture( texture : Texture, options : Object )

Updates the tracked memory of a texture when its default texture is replaced with the loaded one.

**texture**

**options**

The texture's size and level information.

## Source

[src/renderers/common/Info.js](https://github.com/mrdoob/three.js/blob/master/src/renderers/common/Info.js)