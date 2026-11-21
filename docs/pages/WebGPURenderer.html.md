*Inheritance: Renderer →*

# WebGPURenderer

This renderer targets the WebGPU API.

The renderer initializes asynchronously: call `await renderer.init()` before using `render()`, or define the animation loop with `setAnimationLoop()` which waits for the initialization.

## Constructor

### new WebGPURenderer( parameters : WebGPURenderer~Options )

Constructs a new WebGPU renderer.

**parameters**

The configuration parameter.

## Properties

### .isWebGPURenderer : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

### .library : StandardNodeLibrary

The generic default value is overwritten with the standard node library for type mapping.

**Overrides:** [Renderer#library](Renderer.html#library)

## Type Definitions

### .Options

WebGPURenderer options.

**logarithmicDepthBuffer**  
boolean

Whether logarithmic depth buffer is enabled or not. Ignored when a reversed depth buffer is in use.

Default is `false`.

**reversedDepthBuffer**  
boolean

Whether reversed depth buffer is enabled or not.

Default is `false`.

**alpha**  
boolean

Whether the default framebuffer (which represents the final contents of the canvas) should be transparent or opaque.

Default is `true`.

**depth**  
boolean

Whether the default framebuffer should have a depth buffer or not.

Default is `true`.

**stencil**  
boolean

Whether the default framebuffer should have a stencil buffer or not.

Default is `false`.

**antialias**  
boolean

Whether MSAA as the default anti-aliasing should be enabled or not. MSAA is disabled on devices running in WebGPU compatibility mode.

Default is `false`.

**samples**  
number

The number of MSAA samples. When `antialias` is `true`, `4` samples are used by default. A value other than `0` overwrites the default and enables MSAA even without `antialias`. The WebGPU backend only supports `4` samples (higher values are clamped to `4`).

Default is `0`.

**canvas**  
HTMLCanvasElement | OffscreenCanvas

The canvas the renderer draws its output to. If not provided, a new canvas is created.

**context**  
GPUCanvasContext

An existing rendering context of `canvas`.

**powerPreference**  
string

A hint for the GPU adapter selection, either `'low-power'` or `'high-performance'`.

**requiredLimits**  
Object

The device limits to request. If the adapter cannot provide them, the initialization fails.

Default is `{}`.

**device**  
GPUDevice

An existing GPU device to use instead of requesting a new one. `powerPreference` and `requiredLimits` are ignored in this case, and the device is not destroyed when the renderer is disposed.

**outputType**  
number

Texture type for output to canvas. Either `UnsignedByteType` or `HalfFloatType` (extended range, for HDR displays); other types are not supported. By default, device's preferred format is used; other formats may incur overhead.

**outputBufferType**  
number

Defines the type of output buffers. The default `HalfFloatType` is recommend for best quality. To save memory and bandwidth, `UnsignedByteType` might be used. This will reduce rendering quality though.

Default is `HalfFloatType`.

## Source

[src/renderers/webgpu/WebGPURenderer.js](https://github.com/mrdoob/three.js/blob/master/src/renderers/webgpu/WebGPURenderer.js)