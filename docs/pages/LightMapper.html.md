# LightMapper

Bakes indirect diffuse irradiance into a light map. The irradiance is defined by a function that returns a TSL node for a world-space position and normal, e.g. a prepared [RayTracedRadiosity](RayTracedRadiosity.html) via `rayTracedRadiosityIrradiance()`.

Meshes need light map UVs in the `uv1` attribute, e.g. generated with [unwrapUVs](global.html#unwrapUVs). Each sample rasterizes the meshes in UV space with a sub-texel jitter and accumulates the result. The function also receives the sample index, so stochastic sources can vary their samples and converge as they accumulate. Call `update()` once per frame to bake progressively, or pass a sample count to bake at once. Samples accumulate in float precision with the 'float32-blendable' renderer feature. Without it, they accumulate in half float precision with jittered weights, up to 1024 samples; further samples are ignored. Keep the source geometry and GI data static while accumulating. Call `reset()` after changing transforms or lighting. Atlas charts need at least three texels of padding; the resolve fills two texels around covered surfaces. The alpha of the light map is its coverage, e.g. for [SeamStitchGenerator](SeamStitchGenerator.html) and [GutterFillGenerator](GutterFillGenerator.html). Irradiance uses linear BT.709/sRGB primaries in lux. Do not include material ambient occlusion, base color, or exposure in the source irradiance. Material occlusion is applied once at runtime. Keep any contributions included in the bake out of runtime diffuse lighting to avoid counting them twice. The `variance` and `guides` options also bake the inputs of a denoiser like [DenoiseNode](DenoiseNode.html): the noise of each texel and the surface that it lies on, see [LightMapper#getTextureNode](LightMapper.html#getTextureNode).

This class can only be used with [WebGPURenderer](WebGPURenderer.html).

## Code Example

```js
const radiosity = new RayTracedRadiosity();
radiosity.update( renderer, scene );
const lightMapper = new LightMapper( renderer, size, rayTracedRadiosityIrradiance( radiosity ) );
lightMapper.addObjects( meshes );
lightMapper.update( 64 );
material.lightMap = lightMapper.texture;
```

## Import

LightMapper is an addon, and must be imported explicitly, see [Installation#Addons](https://threejs.org/manual/#installation#addons).

```js
import { LightMapper } from 'three/addons/lighting/LightMapper.js';
```

## Constructor

### new LightMapper( renderer : WebGPURenderer, size : number, irradianceNode : function, options : Object )

Constructs a new light mapper.

**renderer**

The renderer.

**size**

The light map size in texels.

**irradianceNode**

Returns the irradiance for a world-space position, normal and sample index.

**options**

Bake options.

**lights**

Direct lights to include in the diffuse bake. Render their shadows in the source scene first and disable shadow updates during the UV bake.

Default is `[]`.

**variance**

Whether to also estimate the noise of each texel into [LightMapper#varianceTexture](LightMapper.html#varianceTexture). Requires the 'float32-blendable' renderer feature.

Default is `false`.

**guides**

Whether to also rasterize the surface of each texel into [LightMapper#positionTexture](LightMapper.html#positionTexture) and [LightMapper#normalTexture](LightMapper.html#normalTexture).

Default is `false`.

## Properties

### .irradianceNode : function

The source of indirect irradiance.

### .normalTexture : Texture (readonly)

The world-space normal of the surface of each texel. Only with the `guides` option, else `null`.

### .positionTexture : Texture (readonly)

The world-space position of the surface of each texel, with the index of its chart + 1 in alpha, or 0 in alpha for texels without a surface. A chart is a set of triangles that are connected in the light map. Only with the `guides` option, else `null`.

### .renderer : WebGPURenderer

The renderer.

### .samples : number (readonly)

The number of accumulated samples.

Default is `0`.

### .size : number

The light map size in texels.

### .texture : Texture

The baked light map. It stores linear diffuse irradiance in lux, without baked albedo, material ambient occlusion, or display exposure, and uses `uv1`. Values are not divided by pi, matching the runtime light map input. Alpha is the coverage: 1 at the texels with samples, 0 at the padding and elsewhere.

### .varianceTexture : Texture (readonly)

The variance of the luminance of each texel of the light map, the variance of the mean of its samples, in the red channel. Texels without samples are -1. Only with the `variance` option and the 'float32-blendable' renderer feature, else `null`.

## Methods

### .addObjects( objects : Array.<Mesh> )

Adds meshes to the light map. Their geometries must provide `uv1`. Skinned and instanced meshes are not supported.

**objects**

The meshes to add.

### .dispose()

Frees all internal resources.

### .getTexture( name : 'color' | 'variance' | 'position' | 'normal' ) : Texture

Returns a texture of the light mapper: `'color'`, the light map, or the inputs of a denoiser like [DenoiseNode](DenoiseNode.html): `'variance'` with the `variance` option, `'position'` and `'normal'` with the `guides` option.

**name**

The name of the texture.

Default is `'color'`.

**Returns:** The texture.

### .getTextureNode( name : 'color' | 'variance' | 'position' | 'normal' ) : TextureNode

Returns a texture of the light mapper as a texture node, see [LightMapper#getTexture](LightMapper.html#getTexture). The nodes sample the light map UVs, e.g. `material.lightMapNode = lightMapper.getTextureNode()`.

**name**

The name of the texture.

Default is `'color'`.

**Returns:** The texture node.

### .reset()

Discards the accumulated samples.

### .update( samples : number )

Accumulates samples into the light map.

**samples**

The number of samples to add.

Default is `1`.

## Source

[examples/jsm/lighting/LightMapper.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/lighting/LightMapper.js)