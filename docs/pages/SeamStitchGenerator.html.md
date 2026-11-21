# SeamStitchGenerator

Stitches the seams of a baked map, e.g. of a light map or an ambient occlusion map. Where a smooth surface is cut into two charts of the UV atlas, bilinear filtering on both sides of the cut reads different texels, so the map shows a discontinuity. This finds the mesh edges whose two triangles meet in 3D, with similar normals, but lie at different places of the atlas, and solves a least-squares problem for the texels around them: the bilinear samples along both sides of each seam should be equal, while the texels change as little as possible, the texels outside the charts more freely than the covered ones. The solver runs damped Jacobi iterations on the GPU and keeps each texel within the values that its seams sample on both sides.

The coverage of the map is read from its alpha: texels with an alpha above zero are covered, e.g. in a light map of [LightMapper](LightMapper.html). The stitched map has the covered and the stitched texels in alpha, 1, and 0 elsewhere, so [GutterFillGenerator](GutterFillGenerator.html) can fill the gutters around them.

Finding the seams runs on the CPU, so [SeamStitchGenerator#setGeometry](SeamStitchGenerator.html#setGeometry) is called once per atlas, then the generator can stitch many maps of it. Like PMREMGenerator, the caller owns the results.

Instanced and skinned meshes are not supported. This class can only be used with [WebGPURenderer](WebGPURenderer.html) and a WebGPU backend.

## Code Example

```js
const seamStitch = new SeamStitchGenerator( renderer );
seamStitch.setGeometry( scene );
const gutterFill = new GutterFillGenerator( renderer );
const stitched = seamStitch.generate( lightMapper.texture );
const filled = gutterFill.generate( stitched.texture );
material.lightMap = filled.texture;
```

## Import

SeamStitchGenerator is an addon, and must be imported explicitly, see [Installation#Addons](https://threejs.org/manual/#installation#addons).

```js
import { SeamStitchGenerator } from 'three/addons/utils/SeamStitchGenerator.js';
```

## Constructor

### new SeamStitchGenerator( renderer : WebGPURenderer )

Constructs a new seam stitch generator.

**renderer**

The renderer.

## Properties

### .channel : number

The UV channel of the atlas, like [Texture#channel](Texture.html#channel): 1 for `uv1`. The seams are found again when it changes.

Default is `1`.

### .iterations : number

The number of Jacobi iterations.

Default is `64`.

### .renderer : WebGPURenderer

The renderer.

## Methods

### .dispose()

Frees all internal resources.

### .generate( source : Texture, renderTarget : RenderTarget ) : RenderTarget

Stitches the seams of a map of the atlas.

**source**

The map, with an alpha above zero at its covered texels, e.g. a light map of [LightMapper](LightMapper.html).

**renderTarget**

The render target of the stitched map, resized to the map. The map must not be its texture. By default, a new half float render target.

Default is `null`.

**Returns:** The render target of the stitched map, with the UV channel of the atlas.

### .setGeometry( scene : Object3D | Array.<Mesh> )

Finds the seams of the meshes that share the atlas. Call it again when the meshes or their UVs change.

**scene**

The meshes, or an object whose meshes share the atlas.

## Source

[examples/jsm/utils/SeamStitchGenerator.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/SeamStitchGenerator.js)