# RayTracedRadiosity

Approximates diffuse global illumination with ray traced radiosity, as a source of irradiance for [LightMapper](LightMapper.html). Every sample casts cosine-distributed rays from each point through a [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) BVH of the scene, and looks up the light leaving the hit surfaces in a light map of the bounces. Emissive surfaces and the sky are also sampled directly with shadow rays, so small area lights and suns converge quickly.

The bounces are cached in a light map that `update()` solves iteratively, so the meshes need light map UVs in `uv1`, e.g. generated with [unwrapUVs](global.html#unwrapUVs). Meshes without them block light but do not reflect it.

The scene is collected by `update()`: call it again after changing the scene or the lighting and create new samplers afterwards. The direct light of directional, point and spot lights is left to the materials, like with the other irradiance sources, but the cached bounces include it with shadow rays, so their indirect light is baked. The light of emissive surfaces is baked, since materials do not light each other, and so is the light of an equirectangular or cube texture in `scene.background`, scaled by `scene.backgroundIntensity`; background colors are ignored. Only the colors of the materials are used, texture maps are ignored and all surfaces are opaque. Other lights, and skinned, instanced and batched meshes are ignored.

This class can only be used with [WebGPURenderer](WebGPURenderer.html) and a WebGPU backend. Requires `three-mesh-bvh` 0.9.18 or later.

## Code Example

```js
const radiosity = new RayTracedRadiosity();
radiosity.update( renderer, scene );
const lightMapper = new LightMapper( renderer, size, rayTracedRadiosityIrradiance( radiosity ) );
```

## Import

RayTracedRadiosity is an addon, and must be imported explicitly, see [Installation#Addons](https://threejs.org/manual/#installation#addons).

```js
import { RayTracedRadiosity, rayTracedRadiosityIrradiance } from 'three/addons/lighting/RayTracedRadiosity.js';
```

## Constructor

### new RayTracedRadiosity( options : Object )

Constructs a new ray traced radiosity solver.

**options**

The options.

**rays**

The number of rays cast per point and sample.

Default is `8`.

**bounces**

The number of iterations used to solve the cached bounces. Each iteration adds one bounce, `0` disables the cache.

Default is `16`.

**cacheSamples**

The number of samples accumulated into the bounce cache after the iterations.

Default is `32`.

**cacheSize**

The size of the bounce cache light map in texels.

Default is `256`.

## Properties

### .bias : number

World space distance that rays start above the receiving face, to avoid hitting it.

Default is `0.001`.

### .bounces : number

The number of iterations used to solve the cached bounces.

Default is `16`.

### .cacheSamples : number

The number of samples accumulated into the bounce cache after the iterations.

Default is `32`.

### .cacheSize : number

The size of the bounce cache light map in texels.

Default is `256`.

### .rays : number

The number of rays cast per point and sample. It can change between samples, e.g. to keep the frame rate of a progressive bake: the samples continue the same sequences of rays.

Default is `8`.

## Methods

### .dispose()

Frees all internal resources.

### .update( renderer : WebGPURenderer, scene : Scene )

Collects the meshes of the scene, builds the BVH and solves the cached bounces. Call this again after changing the scene or the lighting.

**renderer**

The renderer.

**scene**

The scene.

## Source

[examples/jsm/lighting/RayTracedRadiosity.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/lighting/RayTracedRadiosity.js)