*Inheritance: EventDispatcher → Node →*

# DenoiseNode

Denoises the noisy output of a screen-space effect, e.g. AO, GI or reflections, or a texture, e.g. a light map, with the edge-aware à-trous wavelet filter of SVGF. In screen space, `temporalDenoise()` also accumulates the input in time. In texture space, the filter is guided by textures of the world-space position and normal.

SVGF delivers high quality but is designed for desktop-class hardware and its cost can be very noticeable on mobile devices. Performance-restricted use cases should avoid per-frame denoising with this node and rely on the basic denoising of TAA instead, see [TRAANode](TRAANode.html). [BilateralBlurNode](BilateralBlurNode.html) is a performant alternative as well. Both come at the cost of lower denoise quality.

The noise of the input should be independent between neighboring pixels. Samples that are correlated across pixels, e.g. one sequence shifted by a smooth function of the pixel coordinates, leave structure such as bands that neither the accumulation in time nor the edge-aware filter removes. A low-discrepancy sequence in time, rotated by a random or stratified offset per pixel ( Cranley-Patterson rotation ), works well.

References:

*   [https://research.nvidia.com/publication/2017-07\_spatiotemporal-variance-guided-filtering-real-time-reconstruction-path-traced](https://research.nvidia.com/publication/2017-07_spatiotemporal-variance-guided-filtering-real-time-reconstruction-path-traced)
*   [https://github.com/NVIDIA-RTX/NRD](https://github.com/NVIDIA-RTX/NRD)

## Code Example

```js
// SSGI, accumulated in time before TRAA: GI in rgb and AO in alpha
const denoised = temporalDenoise( vec4( giPass.getGINode().rgb, giPass.getAONode().r ), { depth, normal, camera, velocity, alpha: true } );
// SSR: lobe-aware, with the roughness and the hit distance of each pixel
const denoised = temporalDenoise( ssrPass, { depth, normal, camera, velocity, roughness, hitDistance } );
// SSR with coverage in alpha: texels without coverage do not darken the radiance
const denoised = temporalDenoise( reflections, { depth, normal, camera, velocity, coverage: true } );
// a light map, filtered once when the bake is done, with its coverage in alpha
const denoiseNode = denoise( lightMapper.getTextureNode( 'color' ), {
	position: lightMapper.getTextureNode( 'position' ),
	normal: lightMapper.getTextureNode( 'normal' ),
	variance: lightMapper.getTextureNode( 'variance' ),
	quality: 'quality',
	coverage: true
} );
denoiseNode.autoUpdate = false;
material.lightMapNode = denoiseNode;
```

## Import

DenoiseNode is an addon, and must be imported explicitly, see [Installation#Addons](https://threejs.org/manual/#installation#addons).

```js
import { denoise, temporalDenoise } from 'three/addons/tsl/display/DenoiseNode.js';
```

## Constructor

### new DenoiseNode( inputNode : TextureNode, options : Object )

Constructs a new denoise node.

**inputNode**

The noisy input.

**options**

The guides and options.

Default is `{}`.

**depth**

Screen space: the depth of the scene.

Default is `null`.

**normal**

Screen space: the view-space normals of the scene, a node with `sample( uv )`, else they are reconstructed from the depth. Texture space: the world-space normal of each texel.

Default is `null`.

**camera**

Screen space: the camera the scene is rendered with.

Default is `null`.

**position**

Texture space: the world-space position of each texel, with the id of its surface in alpha, 0 without a surface.

Default is `null`.

**variance**

Texture space: the variance of the luminance of each texel in red, negative without data.

Default is `null`.

**velocity**

Screen space, temporal: the velocity of the scene.

Default is `null`.

**roughness**

Screen space, reflections: the roughness of the scene, a node with `sample( uv )`.

Default is `null`.

**hitDistance**

Screen space, reflections: the hit distance of each pixel of the input, a node with `sample( uv )`, with `roughness`.

Default is `null`.

**alpha**

Screen space: whether alpha is a second signal to filter, e.g. AO next to GI.

Default is `false`.

**coverage**

Whether the input has its coverage in alpha: radiance in screen space, a map in texture space, e.g. a light map of `LightMapper`.

Default is `false`.

**temporal**

Screen space: whether to accumulate the input in time, see `temporalDenoise()`.

Default is `false`.

**quality**

The preset of the filter.

Default is `'fast'`.

## Properties

### .alpha : boolean (readonly)

Whether alpha is a second signal to filter, e.g. AO next to GI. Otherwise the alpha of the output is 1, or with `temporal` the weight of the current frame in the history, `1 / history length`, which damps the feedback of multi-bounce reflections where the history is short, see [SSRNode#setHistory](SSRNode.html#setHistory).

### .autoUpdate : boolean

Whether the node filters every frame in which it is used. Otherwise it filters once when [DenoiseNode#textureNeedsUpdate](DenoiseNode.html#textureNeedsUpdate) is set, e.g. when a light map is baked.

Default is `true`.

### .camera : Camera

Screen space: the camera the scene is rendered with.

### .coverage : boolean (readonly)

Whether the input has its coverage in alpha. In screen space, the input is radiance: the node filters the radiance weighted by coverage, so that texels without coverage do not darken it, and returns the radiance with the filtered coverage in alpha. In texture space, texels with an alpha of 0 have no data, like texels without a variance, and the output keeps the coverage in alpha, 1 or 0, e.g. for `SeamStitchGenerator` and `GutterFillGenerator`.

### .depthNode : TextureNode

Screen space: the depth of the scene.

### .hitDistanceNode : Node.<float>

Screen space, reflections: the hit distance of each pixel of the input.

### .inputNode : TextureNode

The noisy input.

### .isDenoiseNode : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

### .iterations : number

The number of filter passes. The filter spans `3^iterations` texels with the `'fast'` preset, and `2^(iterations + 1) - 1` texels with the `'quality'` preset.

Default is `2`.

### .luminancePhi : UniformNode.<float>

How many standard deviations of the noise luminance differences may span before texels stop being averaged. Higher values remove more noise and blur more detail.

### .maxFrames : UniformNode.<float>

Temporal: the maximum length of the history in frames. Longer histories have less noise and more lag.

### .normalNode : Node.<vec3>

The view-space normals of the scene in screen space, the world-space normal of each texel in texture space.

### .normalPhi : UniformNode.<float>

The exponent of the normal similarity weight.

### .planePhi : UniformNode.<float>

The sine of the angle to the tangent plane at which neighbors lose most of their weight.

### .positionNode : TextureNode

Texture space: the world-space position of each texel, with the id of its surface in alpha.

### .quality : 'fast' | 'quality' (readonly)

The preset of the filter, `'fast'` or `'quality'`.

### .relativeNoise : UniformNode.<float>

Texture space without a variance: the relative noise of the texels, the standard deviation of their luminance over their luminance.

### .roughnessNode : Node.<float>

Screen space, reflections: the roughness of the scene.

### .temporal : boolean (readonly)

Whether the node accumulates the input in time.

### .textureNeedsUpdate : boolean

Whether the node filters in the next frame in which it is used, also when `autoUpdate` is off. It is reset once the node has filtered.

Default is `true`.

### .updateBeforeType : string

The `updateBeforeType` is set to `NodeUpdateType.FRAME` since the node filters once per frame in `updateBefore()`.

Default is `'frame'`.

**Overrides:** [Node#updateBeforeType](Node.html#updateBeforeType)

### .varianceNode : TextureNode

Texture space: the variance of the luminance of each texel in red, negative without data.

### .velocityNode : Node.<vec2>

Screen space, temporal: the velocity of the scene.

## Methods

### .dispose()

Frees internal resources. This method should be called when the node is no longer required.

**Overrides:** [Node#dispose](Node.html#dispose)

### .getTexture() : Texture

Returns the denoised result as a texture, e.g. the history of multi-bounce reflections.

**Returns:** The denoised result.

### .getTextureNode() : PassTextureNode

Returns the denoised result as a texture node.

**Returns:** The denoised result.

### .reset()

Forgets the history, e.g. after a camera cut.

### .setSize( width : number, height : number )

Sets the size of the internal render targets, the size of the input.

**width**

The width.

**height**

The height.

### .setup() : PassTextureNode

This method is used to setup the effect's TSL code.

**Overrides:** [Node#setup](Node.html#setup)

**Returns:** The denoised result.

### .updateBefore( frame : NodeFrame )

Filters the input, once per frame if `autoUpdate` is on, else if `textureNeedsUpdate` is set.

**frame**

The current node frame.

**Overrides:** [Node#updateBefore](Node.html#updateBefore)

## Source

[examples/jsm/tsl/display/DenoiseNode.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/tsl/display/DenoiseNode.js)