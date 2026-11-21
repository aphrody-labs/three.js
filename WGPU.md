# WebGPU backend and a future Rust/wasm wgpu backend

Facts about the current JS code (line numbers refer to this checkout) and where they map onto `wgpu` / `naga` v30.0.2.
`docs/` is jsdoc output (`package.json` script `build-docs`), hence this file at the repository root.

## Validation tooling

| Script | Purpose |
| --- | --- |
| `scripts/capture-wgsl.ts` | Serves `examples/`, `src/` and an in-memory `Bun.build` of `src/Three.WebGPU.js` (`/build/three.webgpu.js`, `/build/three.tsl.js` re-exporting `TSL` of the same bundle), drives headless Chrome over CDP, hooks `GPUDevice.prototype.createShaderModule`, `createBindGroupLayout`, `createPipelineLayout`, `create{Render,Compute}Pipeline[Async]` and records WGSL, layouts, `getCompilationInfo()` messages, validation error scopes, `uncapturederror`, console and uncaught exceptions for every `examples/webgpu_*.html`. |
| `scripts/validate-wgsl.ts` | Uploads the deduplicated modules to a host over `tar | ssh`, runs `naga --bulk-validate` and writes a JSON report (pass/fail, error text, error class, examples). |

```
bun scripts/capture-wgsl.ts --out <dir>
bun scripts/validate-wgsl.ts --dir <dir> --host fr1
```

Naga CLI validates with all capabilities by default (`naga --capabilities none` rejects `enable f16;`), so a rejection by the default run is a real incompatibility and not a missing device feature.

## Known Naga v30.0.2 limitation

`enable subgroups;` is rejected by the WGSL front end (`naga/src/front/wgsl/parse/directive/enable_extension.rs`, `SUBGROUPS` maps to `UnimplementedEnableExtension::Subgroups`): "this enable-extension specifies standard functionality which is not yet implemented in Naga". Naga accepts subgroup builtins and functions without the directive (the same module minus the `enable subgroups;` line validates), Tint requires it. Upstream: gfx-rs/wgpu#8202 (subgroup functionality should require the extension), #5555 (subgroup tracking), #7474 (the change that makes Naga reject the directive). The node builder emits the directive only when a shader really uses a subgroup builtin or function (`WGSLNodeBuilder.enableSubGroups`, `WGSLNodeBuilder.js:1835`, called from `getSubgroupSize` :1694, `getInvocationSubgroupIndex` :1707, `getSubgroupIndex` :1720 and `SubgroupFunctionNode.js:85`). In the example corpus only `webgpu_compute_reduce` does.

## Backend interface vs wgpu

`src/renderers/common/Backend.js` is the abstract interface; `src/renderers/webgpu/WebGPUBackend.js` is the only implementation. Each row lists what the WebGPU implementation calls and the wgpu counterpart.

| `Backend` method (`Backend.js`) | WebGPU implementation | wgpu counterpart |
| --- | --- | --- |
| `init` :79 | `navigator.gpu.requestAdapter` (`WebGPUBackend.js:218`, options `powerPreference`, `featureLevel: 'compatibility'`, `xrCompatible`), every supported `GPUFeatureName` is requested (:224-245), `adapter.requestDevice` :247, `device.lost` :263, `device.onuncapturederror` :278 | `Instance::request_adapter(&RequestAdapterOptions)`, `Adapter::request_device(&DeviceDescriptor { required_features: Features, required_limits: Limits })`, `Device::set_device_lost_callback` (`wgpu/src/api/device.rs:681`), `Device::on_uncaptured_error` (:506) |
| `hasFeature` :680 (`WebGPUBackend.js:3046`) | `device.features.has` | `Device::features() -> Features` (`SUBGROUP`, `SHADER_F16`, `DUAL_SOURCE_BLENDING`, `CLIP_DISTANCES`, `FLOAT32_FILTERABLE`, `TIMESTAMP_QUERY`, `EXTERNAL_TEXTURE` exist in `wgpu-types/src/features.rs`) |
| `getContext` :469 (`WebGPUBackend.js:417`) | `canvas.getContext( 'webgpu' )` :340, `context.configure( { device, format, usage, alphaMode, toneMapping } )` :351 | `Surface::configure(&Device, &SurfaceConfiguration)` (`wgpu/src/api/surface.rs:119`); tone mapping is not a separate field, it is encoded in the surface color space enum (`wgpu-types/src/surface.rs:214-237`) |
| `createProgram` :176 (`:2705`) | `device.createShaderModule( { label, code } )`, entry point always `'main'`; one module per stage (`vertex`, `fragment`, `compute`) | `Device::create_shader_module(ShaderModuleDescriptor { source: ShaderSource::Wgsl(..) })`, entry point `main` for each stage |
| `createBindings` :197 / `updateBindings` :208 (`WebGPUBindingUtils.js:119-130`, `createBindGroup` :314) | `createBindGroupLayout( { entries } )` :121, `createBindGroup` | `Device::create_bind_group_layout`, `create_bind_group` |
| `createRenderPipeline` :227 (`WebGPUPipelineUtils.js:71`) | `createPipelineLayout` :203, `createRenderPipeline` :262 or `createRenderPipelineAsync` :291; layout always explicit (never `'auto'`) | `Device::create_pipeline_layout`, `create_render_pipeline`; the async variant has no native counterpart (pipeline creation is synchronous in wgpu, run it on a thread) |
| `createComputePipeline` :237 (`WebGPUPipelineUtils.js:384`) | `createPipelineLayout` :413, `createComputePipeline` :423 / `createComputePipelineAsync` :452 | `Device::create_compute_pipeline` |
| `beginRender` :104 / `finishRender` :114 (`WebGPUBackend.js:875`, `:1407`) | `createCommandEncoder` :1075, `beginRenderPass( descriptor )` :1112, `executeBundles` :1415, `queue.submit` via `submit()` (`WebGPUUtils.js:323`) :1579 | `Device::create_command_encoder`, `CommandEncoder::begin_render_pass`, `RenderPass::execute_bundles`, `Queue::submit` |
| `draw` :145 (`WebGPUBackend.js:2246`, `_draw` :2047) | `setPipeline` :2058, `setBindGroup` :2080, `drawIndexedIndirect` :2196, `drawIndirect` :2222 | same names on `RenderPass`/`RenderBundleEncoder` |
| `beginCompute` :124 / `compute` :166 / `finishCompute` :134 (`:1873`, `:1913`, `:2022`) | `beginComputePass` :1887, `dispatchWorkgroups` :2008, `dispatchWorkgroupsIndirect` :1957 | `CommandEncoder::begin_compute_pass`, `ComputePass::dispatch_workgroups[_indirect]` |
| `createTexture`/`updateTexture` :314/:323, `generateMipmaps` :331, `copyTextureToTexture` :368, `copyFramebufferToTexture` :378 | `device.createTexture`, `queue.copyExternalImageToTexture` (`WebGPUTextureUtils.js:1024`), mipmaps by a render pass with an embedded WGSL module (`WebGPUTexturePassUtils.js:49`, :177), `encoder.copyTextureToTexture` (`WebGPUBackend.js:3137`) | `Device::create_texture`, `Queue::write_texture`, `CommandEncoder::copy_texture_to_texture`; mipmap pass is portable as is |
| `copyTextureToBuffer` :355 (`WebGPUTextureUtils.js:823-857`), `getArrayBufferAsync` :671 (`WebGPUAttributeUtils.js:484-583`) | `createBuffer` + `copyTextureToBuffer`/`copyBufferToBuffer` + `mapAsync( GPUMapMode.READ )` | `Buffer::slice(..).map_async(MapMode::Read, ..)` + `Device::poll(PollType)` (`device.rs:95`) |
| `createAttribute`/`createStorageAttribute`/`createIndirectStorageAttribute` :388-412, `createUniformBuffer` :420 | `device.createBuffer` (`WebGPUAttributeUtils.js:239`), `queue.writeBuffer` (`WebGPUBindingUtils.js:205`, :240) | `Device::create_buffer`, `Queue::write_buffer` |
| `updateSampler` :288 | `device.createSampler` (`WebGPUTextureUtils.js:201`) | `Device::create_sampler` |
| `createTimestampQueryPool` :562, `beginTimer` :570, `resolveTimestamps` :617 | `device.createQuerySet` (`WebGPUTimestampQueryPool.js:259`), `resolveQuerySet` :181, `mapAsync` :190 | `Device::create_query_set(QueryType::Timestamp)`, `CommandEncoder::resolve_query_set`; needs `TIMESTAMP_QUERY` |
| `isOccluded` :633, `getOcclusionData` :641 (`WebGPUBackend.js:1616-1647`) | occlusion `createQuerySet` :904, `resolveQuerySet` :1568, `mapAsync` :1647 | `QueryType::Occlusion`, `RenderPass::begin_occlusion_query` |
| `needsRenderUpdate` :256 / `getRenderCacheKey` :265 | see "Pipeline cache keys" | rebuild trigger for `RenderPipelineDescriptor` |
| `createNodeBuilder` :277 (`WebGPUBackend.js:2692`) | `new WGSLNodeBuilder( object, renderer )` | see next section |

## WGSLNodeBuilder output = naga::Module input

- Render objects produce two WGSL strings (`_getWGSLVertexCode` `WGSLNodeBuilder.js:2784`, `_getWGSLFragmentCode` :2826), compute objects one (`_getWGSLComputeCode` :2866). Each is a self-contained module with entry point `main`; the vertex/fragment pair does not share a module. Assembled in `buildCode` :2507.
- Section order of a module: signature comment, `enable` directives (`getDirectives` :1813, set filled by `enableDirective` :1800 for `subgroups`, `clip_distances` :1850, `f16` and `dual_source_blending` :1868), fragment only `diagnostic( off, derivative_uniformity );` (:289-295, skipped on Firefox/Deno), structs, uniforms, varyings, vars, codes, entry point.
- Naga entry point: `naga::front::wgsl::parse_str(&str) -> Result<Module, ParseError>` (`naga/src/front/wgsl/mod.rs:86`), then `naga::valid::Validator::new(ValidationFlags, Capabilities).validate(&module)`. Capabilities relevant to the generator: `SHADER_FLOAT16`, `DUAL_SOURCE_BLENDING`, `CLIP_DISTANCES`, `SUBGROUP`, `TEXTURE_EXTERNAL`, `MULTIVIEW`, `IMMEDIATES` (`naga/src/valid/mod.rs:88-187`). They must be derived from the same device features the builder consults through `renderer.hasFeature`, e.g. `float32-filterable` at `WGSLNodeBuilder.js:2723`.
- Result of the capture over `examples/webgpu_*.html`: 1907 distinct modules, 1905 pass `naga --bulk-validate` (v30.0.2); the two failures are the `enable subgroups;` limitation above. Chrome reported zero validation errors and zero `getCompilationInfo()` messages over 7251 recorded pipelines.

## Bind group layout derivation

- Group and binding numbers are assigned by the node builder, not by the backend: one WGSL `@group` per binding group sorted by `groupNode.order` (`NodeBuilder.sortBindingGroups`, `NodeBuilder.js:860-871`), `@binding` incremented per uniform in `getUniforms` (`WGSLNodeBuilder.js:2263-2300`). A texture takes a `_sampler` binding followed by the texture binding when `_getTextureBindingTypes` (:2397) returns a sampler type; buffers use `_getBufferBindingTypes` (:2485).
- The backend derives `GPUBindGroupLayoutEntry` from the same `BindGroup`/`Binding` objects, in the same order: `WebGPUBindingUtils._createLayoutEntries` (:420), `binding: index` per entry in `bindGroup.bindings`, `visibility` from `Binding.visibility` (`Binding.js:32-43`).
  - uniform/storage buffers: `buffer.type` `uniform` (default) / `storage` / `read-only-storage` from `binding.access` and visibility (:437-466); no `minBindingSize`, no dynamic offsets are set.
  - storage textures: `storageTexture { format, access, viewDimension }` (:470-499).
  - sampled textures: `texture { sampleType, viewDimension, multisampled }` (:503-580), `sampleType` from texture type: `depth`, `sint`, `uint`, `unfilterable-float` (multisampled, normalized short types, or no `float32-filterable`), `float`.
  - samplers: `sampler.type` `comparison` / `non-filtering` / `filtering` (:581-596).
  - there is no `externalTexture` layout entry; `importExternalTexture` is used when filling a bind group (:332-334).
- The cross-check shader declaration vs layout entry is left to the driver: Chrome/Dawn validated all 7251 pipelines without error. A Rust backend would get it from `wgpu` (`Device::create_*_pipeline` validates the naga module against the layout), mapping to `wgpu_types::BindingType::{Buffer, Sampler, Texture, StorageTexture, ExternalTexture}` (`wgpu-types/src/binding.rs:25-180`); `BindGroupLayoutEntry { binding, visibility: ShaderStages, ty, count }` (:327).
- Layouts are cached by `hashString( JSON.stringify( entries ) )` in `_bindGroupLayoutCache` (:83, :110-129); the JSON key is directly reusable as a `HashMap<Vec<BindGroupLayoutEntry>, BindGroupLayout>` key.

## Pipeline cache keys

- `common/Pipelines.js` keeps `programs.{vertex,fragment,compute}` keyed by the WGSL source string (`getForRender` :166-218, `getForCompute` :87-124): identical WGSL shares one shader module (`backend.createProgram`).
- Pipelines are keyed by `_getRenderCacheKey` / `_getComputeCacheKey` (`Pipelines.js:218`, :124) which combine the programs with `Backend.getRenderCacheKey` (`WebGPUBackend.js:2483`): blend and depth/stencil state, `polygonOffset`, `side`, `alphaToCoverage`, negative-scale front face, sample count, color space, color and depth-stencil formats, primitive topology, strip index format, `getVertexBufferLayoutCacheKey` (`WebGPUAttributeUtils.js:431`) and the clipping context key. Every component maps to a field of `wgpu::RenderPipelineDescriptor` (`primitive`, `depth_stencil`, `multisample`, `fragment.targets`, `vertex.buffers`) so the key is a candidate for a `Hash` of that descriptor.
- `needsRenderUpdate` (`WebGPUBackend.js:2412`) compares the same fields against cached values on the render object to decide whether to look up another pipeline.
- Reference counting (`usedTimes`) releases programs and pipelines (`Pipelines.js:136-144`, :234-244).

## Browser-only parts

- Canvas context and presentation: `getContext( 'webgpu' )`, `configure`, `getCurrentTexture` (`WebGPUBackend.js:340-351`, :476-480); `OffscreenCanvas` `setAttribute` guard :345. wgpu equivalent is a `Surface` created from a raw window handle.
- External textures and video: `importExternalTexture` (`WebGPUBindingUtils.js:334`), `copyExternalImageToTexture` and `ImageBitmap`/`VideoFrame` sources (`WebGPUTextureUtils.js:134-137`, :1024).
- XR: `xrCompatible` adapter option (`WebGPUBackend.js:215`), `setXRRenderTargetTextures` from `XRGPUBinding` (:298-312), external MSAA and view descriptors (:538-660).
- Timestamp queries need `timestamp-query` (`WebGPUBackend.js:389`); in wgpu they are the `TIMESTAMP_QUERY` feature, with inside-pass writes behind `TIMESTAMP_QUERY_INSIDE_PASSES`.
- Asynchronous pipeline creation (`createRenderPipelineAsync`, `createComputePipelineAsync`) and `device.lost`/`onuncapturederror` promise/callback shapes are JS API shaped; wgpu reports them through error scopes/callbacks on the `Device`.
- `adapter.features` is filtered by `GPUFeatureName` (`WebGPUBackend.js:224`); a wgpu backend requests `Features` from `Adapter::features()` the same way.
