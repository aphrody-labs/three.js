*Inheritance: EventDispatcher → Object3D → Mesh →*

# SkyMesh

Represents a skydome for scene backgrounds. Based on [A Practical Analytic Model for Daylight](https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight) aka The Preetham Model, the de facto standard for analytical skydomes.

Note that this class can only be used with [WebGPURenderer](WebGPURenderer.html). When using WebGLRenderer, use Sky.

More references:

*   [http://simonwallner.at/project/atmospheric-scattering/](http://simonwallner.at/project/atmospheric-scattering/)
*   [http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR](http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR)

```js
const sky = new SkyMesh();
sky.scale.setScalar( 10000 );
scene.add( sky );
```

It can be useful to hide the sun disc when generating an environment map to avoid artifacts

```js
// disable before rendering environment map
sky.showSunDisc.value = false;
// ...
// re-enable before scene sky box rendering
sky.showSunDisc.value = true;
```

## Import

SkyMesh is an addon, and must be imported explicitly, see [Installation#Addons](https://threejs.org/manual/#installation#addons).

```js
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
```

## Constructor

### new SkyMesh()

Constructs a new skydome.

## Properties

### .absorptionColor : UniformNode.<vec3>

The wavelengths absorbed by the atmosphere along the path of the sunlight. The default value represents the ozone layer of Earth.

### .absorptionScale : UniformNode.<float>

The strength of atmospheric absorption. Higher values remove more of [SkyMesh#absorptionColor](SkyMesh.html#absorptionColor) from the sunlight and tint the sky in the complementary color.

### .cloudCoverage : UniformNode.<float>

The cloud coverage uniform.

### .cloudDensity : UniformNode.<float>

The cloud density uniform.

### .cloudElevation : UniformNode.<float>

The cloud elevation uniform.

### .cloudScale : UniformNode.<float>

The cloud scale uniform.

### .cloudSpeed : UniformNode.<float>

The cloud speed uniform.

### .isSky : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

**Deprecated:** Use isSkyMesh instead.

### .isSkyMesh : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

### .mieAlbedo : UniformNode.<vec3>

The albedo of aerosol particles, the part of the light they scatter instead of absorbing. White particles absorb nothing, like the haze on Earth. Tinted particles, like the dust on Mars, give the haze their color.

### .mieCoefficient : UniformNode.<float>

The strength of Mie scattering by aerosol particles which controls the intensity of the glow around the sun. Higher values produce a brighter glow.

### .mieColor : UniformNode.<vec3>

The color of Mie scattering which defines the spectrum of the haze around the sun and along the horizon. The default value represents the atmosphere of Earth.

### .mieDirectionalG : UniformNode.<float>

The directionality of Mie scattering which controls the size of the glow around the sun. Values closer to `1` produce a smaller and more concentrated halo.

### .mieDirectionalGSpread : UniformNode.<float>

How much more directional Mie scattering is for blue than for red. Blue uses [SkyMesh#mieDirectionalG](SkyMesh.html#mieDirectionalG) plus this value, red uses it minus this value. Dust grains like those on Mars scatter blue into a tighter halo around the sun, which turns sunsets blue.

### .rayleigh : UniformNode.<float>

The strength of Rayleigh scattering by air molecules which is responsible for the blue color of the sky. Higher values produce a brighter sky.

### .showSunDisc : UniformNode.<float>

Whether to render the solar disc.

### .sunPosition : UniformNode.<vec3>

The sun position uniform.

### .sunSize : UniformNode.<float>

The size of the sun disc relative to the sun seen from Earth.

### .turbidity : UniformNode.<float>

The atmospheric turbidity which controls the amount of haze. Higher values produce a hazier sky.

**Deprecated:** since r188. Multiply [SkyMesh#mieCoefficient](SkyMesh.html#mieCoefficient) by turbidity / 2 instead.

## Methods

### .dispose()

Frees the GPU-related resources allocated by this instance. Call this method whenever the sky is no longer used in your app.

**Overrides:** [Mesh#dispose](Mesh.html#dispose)

## Source

[examples/jsm/objects/SkyMesh.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/objects/SkyMesh.js)